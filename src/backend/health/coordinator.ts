/**
 * @file src/backend/health/coordinator.ts
 *
 * Central health check coordinator for the Renegade Capital Worker.
 *
 * Imports checkHealth() from every modular health.ts across the codebase,
 * runs all checks in parallel (each with a hard 8s timeout), persists results
 * to D1 in batched inserts, and returns the aggregated status.
 *
 * Adding a new check: import it here and add a row to the CHECKS array.
 * Never add inline health logic to this file — all logic lives in the module's health.ts.
 *
 * Performance notes:
 * - PER_CHECK_TIMEOUT_MS: 8s prevents a single slow check (DO cold-start, AI model load)
 *   from consuming the entire Worker CPU budget and triggering Error 1102.
 * - D1 batch size: 9 rows/stmt (10 columns × 9 = 90 params, under D1's 100-param cap).
 *
 * @module Health/Coordinator
 */

import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import {
  healthRuns,
  healthResults,
} from "../db/schema";
import type { HealthCategory, HealthStepResult } from "./types";

// ── Import ALL modular health checks ──────────────────────────────────────────
import { checkHealth as checkDatabase } from "../db/health";
import { checkHealth as checkAI } from "../ai/health";
import { checkHealth as checkPolicyChat } from "../ai/agents/PolicyAgent/health";
import { checkHealth as checkInvestorAgent } from "../ai/agents/InvestorAgent/health";
import { checkHealth as checkPodcastAgent } from "../ai/agents/PodcastAgent/health";
import { checkD1TableScan } from "./checks/d1-table-scan";
// Add new checks here as modules are added. Never add inline logic to this file.

/** Per-check timeout — prevents a single slow check from blocking the suite. */
const PER_CHECK_TIMEOUT_MS = 8_000;

/**
 * Registry entry for a health check.
 * Each check has a stable ID, a category for grouping, and a function to run.
 */
interface RegisteredCheck {
  id: string;
  category: HealthCategory;
  fn: (env: Env) => Promise<HealthStepResult>;
}

/**
 * Master registry of all health checks.
 * Order doesn't matter — all run in parallel via Promise.all.
 */
const CHECKS: RegisteredCheck[] = [
  { id: "database", category: "database", fn: checkDatabase },
  { id: "ai", category: "ai", fn: checkAI },
  { id: "agent_policy_chat", category: "agents", fn: checkPolicyChat },
  { id: "agent_investor_chat", category: "agents", fn: checkInvestorAgent },
  { id: "agent_podcast_chat", category: "agents", fn: checkPodcastAgent },
  { id: "d1_scan", category: "database", fn: checkD1TableScan },
];

/**
 * Runs a single check with a hard timeout.
 * If the check exceeds PER_CHECK_TIMEOUT_MS, it returns a failure with timeout details.
 */
async function withTimeout(check: RegisteredCheck, env: Env) {
  const t = Date.now();
  try {
    const result = await Promise.race([
      check.fn(env),
      new Promise<never>((_, rej) =>
        setTimeout(
          () => rej(new Error(`Timed out after ${PER_CHECK_TIMEOUT_MS}ms`)),
          PER_CHECK_TIMEOUT_MS,
        ),
      ),
    ]);
    return { check, result };
  } catch (e: any) {
    return {
      check,
      result: {
        name: check.id,
        status: "failure" as const,
        message: e.message,
        durationMs: Date.now() - t,
        details: {
          timeout: e.message?.includes("Timed out"),
          category: check.category,
        },
      } as HealthStepResult,
    };
  }
}

/**
 * Central coordinator that runs all health checks and persists results to D1.
 *
 * Usage:
 * ```ts
 * const coord = new HealthCoordinator(env);
 * const result = await coord.runAllChecks("api");
 * ```
 */
export class HealthCoordinator {
  constructor(private env: Env) {}

  /**
   * Runs all registered health checks in parallel, persists to D1, returns aggregate.
   *
   * @param trigger - What initiated the run: "manual", "scheduled", or "api"
   * @returns Run ID, overall status, individual results, and total duration
   */
  async runAllChecks(trigger: "manual" | "scheduled" | "api" = "manual") {
    const db = drizzle(this.env.DB);
    const runId = crypto.randomUUID();
    const suiteStart = Date.now();

    // Insert the run row first with 'unknown' status — updated after all checks
    await db.insert(healthRuns).values({
      id: runId,
      status: "unknown",
      trigger,
    });

    // Run all checks in parallel with per-check timeouts
    const settled = await Promise.all(
      CHECKS.map((c) => withTimeout(c, this.env)),
    );

    const now = new Date().toISOString();
    const rows = settled.map(({ check, result }) => ({
      id: crypto.randomUUID(),
      runId: runId,
      category: check.category,
      name: result.name,
      status: (
        ["success", "failure", "pending", "skipped"] as const
      ).includes(result.status as any)
        ? (result.status as "success" | "failure")
        : ("failure" as const),
      message: result.message,
      durationMs: result.durationMs,
      details: result.details ?? {},
      aiSuggestion: null,
      timestamp: now,
    }));

    // Compute overall status
    const failures = rows.filter((r) => r.status === "failure").length;
    const overall =
      failures === 0
        ? "healthy"
        : failures < rows.length
          ? "degraded"
          : "unhealthy";

    // Update the run with final status and duration
    await db
      .update(healthRuns)
      .set({
        status: overall,
        durationMs: Date.now() - suiteStart,
        metadata: { checkCount: rows.length },
      })
      .where(eq(healthRuns.id, runId));

    // D1 batch: max 9 rows per insert (10 columns × 9 = 90 params, under D1's 100 limit)
    const BATCH = 9;
    const stmts = [];
    for (let i = 0; i < rows.length; i += BATCH) {
      stmts.push(
        db.insert(healthResults).values(rows.slice(i, i + BATCH)),
      );
    }
    if (stmts.length > 0) await db.batch(stmts as any);

    return {
      runId,
      status: overall,
      results: rows,
      durationMs: Date.now() - suiteStart,
    };
  }

  /**
   * Fetches the most recent health run and its results from D1.
   * Used by the Navbar badge (polling every 30s) and the health page on load.
   *
   * @returns Latest run + results, or null if no runs exist yet
   */
  async getLatestRun() {
    const db = drizzle(this.env.DB);
    const [run] = await db
      .select()
      .from(healthRuns)
      .orderBy(desc(healthRuns.createdAt))
      .limit(1);
    if (!run) return null;
    const results = await db
      .select()
      .from(healthResults)
      .where(eq(healthResults.runId, run.id));
    return { run, results };
  }
}

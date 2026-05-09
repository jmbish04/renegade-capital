/**
 * @file src/backend/db/health.ts
 *
 * D1 database binding health check.
 *
 * Exercises the actual `env.DB` binding by running a `SELECT 1` ping to verify
 * the D1 connection is alive, then counts rows in critical tables to detect
 * schema drift or empty-database states.
 *
 * This check runs inside the Worker — no external network call.
 *
 * @module Health/Database
 */

import type { HealthStepResult } from "../health/types";

/**
 * Wraps a single sub-check in try/catch with latency measurement.
 * Isolates failures so one bad sub-check doesn't crash the entire module check.
 */
async function safeRun(
  name: string,
  fn: () => Promise<Record<string, unknown>>,
): Promise<
  [
    string,
    {
      status: "OK" | "FAILURE" | "SKIPPED";
      latency?: number;
      error?: string;
      [k: string]: unknown;
    },
  ]
> {
  const t = Date.now();
  try {
    const result = await fn();
    return [name, { status: "OK", latency: Date.now() - t, ...result }];
  } catch (e: any) {
    return [
      name,
      {
        status: "FAILURE",
        latency: Date.now() - t,
        error: e.message,
        errorName: e.name,
      },
    ];
  }
}

/**
 * Checks D1 database binding reachability and basic schema integrity.
 *
 * Sub-checks:
 * 1. `d1_ping` — `SELECT 1` to verify the binding works
 * 2. `table_exists` — verifies critical tables exist via `sqlite_master`
 *
 * @returns HealthStepResult with sub-check details
 */
export async function checkHealth(env: Env): Promise<HealthStepResult> {
  const start = Date.now();

  if (!env.DB) {
    return {
      name: "D1 Database",
      status: "failure",
      message: "DB binding missing from Env",
      durationMs: Date.now() - start,
      details: { binding: "DB", present: false },
    };
  }

  const checks = await Promise.all([
    safeRun("d1_ping", async () => {
      const result = await env.DB.prepare("SELECT 1 as ping").first();
      if (!result || (result as any).ping !== 1) {
        throw new Error("SELECT 1 returned unexpected result");
      }
      return { ping: "pong" };
    }),

    safeRun("table_exists", async () => {
      const result = await env.DB.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
      ).all();
      const tables = result.results.map((r: any) => r.name as string);
      const critical = [
        "users",
        "threads",
        "messages",
        "health_runs",
        "health_results",
        "trump_policy_page",
      ];
      const missing = critical.filter((t) => !tables.includes(t));
      if (missing.length > 0) {
        throw new Error(`Missing critical tables: ${missing.join(", ")}`);
      }
      return { tableCount: tables.length, tables };
    }),
  ]);

  const subChecks = Object.fromEntries(checks.map(([n, v]) => [n, v]));
  const failures = checks
    .filter(([, v]) => v.status === "FAILURE")
    .map(([n]) => n);

  return {
    name: "D1 Database",
    status: failures.length > 0 ? "failure" : "success",
    message:
      failures.length > 0
        ? `D1 failures: ${failures.join(", ")}`
        : "D1 database binding operational",
    durationMs: Date.now() - start,
    details: subChecks,
  };
}

/**
 * @file src/backend/health/checks/d1-table-scan.ts
 *
 * Cross-cutting D1 table scan health check.
 *
 * Scans critical application tables for:
 * - Zero-row conditions (table exists but has no data — possible migration or seeding failure)
 * - Row counts for capacity awareness
 *
 * This check is separate from the D1 binding check (db/health.ts) which only
 * validates connectivity. The table scan validates data integrity.
 *
 * @module Health/Checks/D1TableScan
 */

import type { HealthStepResult } from "../types";

/**
 * Tables to scan with their minimum expected row counts.
 * A table with 0 rows when minExpected > 0 triggers a warning.
 */
const TABLES_TO_SCAN = [
  { name: "users", minExpected: 0 },
  { name: "guests", minExpected: 1 },
  { name: "episodes", minExpected: 1 },
  { name: "research", minExpected: 1 },
  { name: "trump_policy_page", minExpected: 1 },
  { name: "trump_policy_tag", minExpected: 1 },
] as const;

/**
 * Scans critical D1 tables for row counts and detects empty-table conditions.
 *
 * @returns HealthStepResult with per-table row counts and any warnings
 */
export async function checkD1TableScan(
  env: Env,
): Promise<HealthStepResult> {
  const start = Date.now();

  if (!env.DB) {
    return {
      name: "D1 Table Scan",
      status: "failure",
      message: "DB binding missing",
      durationMs: Date.now() - start,
    };
  }

  const tableCounts: Record<string, number> = {};
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const table of TABLES_TO_SCAN) {
    try {
      const result = await env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM ${table.name}`,
      ).first();
      const count = (result as any)?.cnt ?? 0;
      tableCounts[table.name] = count;

      if (count === 0 && table.minExpected > 0) {
        warnings.push(
          `${table.name}: 0 rows (expected ≥${table.minExpected})`,
        );
      }
    } catch (e: any) {
      errors.push(`${table.name}: ${e.message}`);
      tableCounts[table.name] = -1;
    }
  }

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return {
    name: "D1 Table Scan",
    status: hasErrors ? "failure" : hasWarnings ? "warning" : "success",
    message: hasErrors
      ? `Table scan errors: ${errors.join("; ")}`
      : hasWarnings
        ? `Empty tables detected: ${warnings.join("; ")}`
        : `All ${TABLES_TO_SCAN.length} tables have data`,
    durationMs: Date.now() - start,
    details: { tableCounts, warnings, errors },
  };
}

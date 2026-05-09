/**
 * @file src/backend/health/types.ts
 *
 * Shared types for the entire health system.
 * This is the universal contract — all modular health.ts files return HealthStepResult,
 * and the coordinator persists HealthResult rows to D1.
 *
 * Imported by: coordinator.ts, all modular health.ts files, Hono health routes,
 * and the frontend health page.
 *
 * @module Health/Types
 */

/** Overall status of a health run (aggregated from individual check results). */
export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/** Status of an individual health check step. */
export type CheckStatus = "success" | "failure" | "warning" | "SKIPPED";

/**
 * Category classification for health checks.
 * Used for grouping in the frontend and filtering in the coordinator.
 */
export type HealthCategory =
  | "api"
  | "database"
  | "ai"
  | "agents"
  | "providers"
  | "frontend"
  | "auth"
  | "storage"
  | "queue"
  | "custom";

/**
 * Result of a single health check step.
 * Every modular `health.ts` returns this shape from its `checkHealth()` function.
 */
export interface HealthStepResult {
  /** Human-readable name of the check (e.g. "D1 Database", "Workers AI"). */
  name: string;
  /** Whether the check passed, failed, or was skipped. */
  status: CheckStatus;
  /** Descriptive message explaining the result. */
  message: string;
  /** Wall-clock duration of the check in milliseconds. */
  durationMs: number;
  /** Arbitrary key-value details for diagnostics. */
  details?: Record<string, unknown>;
  /** Optional AI-generated root cause analysis and suggested fix. */
  analysis?: { rootCause: string; suggestedFix: string } | null;
}

/**
 * A persisted health run record from D1.
 * One run contains multiple HealthResult rows.
 */
export interface HealthRun {
  id: string;
  status: HealthStatus;
  trigger: "manual" | "scheduled" | "api";
  duration_ms: number;
  created_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * A persisted health result record from D1.
 * Each row corresponds to one HealthStepResult within a run.
 */
export interface HealthResult {
  id: string;
  run_id: string;
  category: HealthCategory;
  name: string;
  status: "success" | "failure" | "pending" | "skipped";
  message?: string;
  details?: Record<string, unknown>;
  duration_ms: number;
  ai_suggestion?: string | null;
  timestamp: string;
}

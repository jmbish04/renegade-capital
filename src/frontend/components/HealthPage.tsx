/**
 * @file src/frontend/components/HealthPage.tsx
 *
 * Full-page health dashboard React island.
 *
 * On mount: fetches latest persisted run from GET /api/health and displays
 * all check results with their status, category, message, and duration.
 *
 * Run Now: POSTs to /api/health/run, clears results, shows skeleton rows while
 * the run is in progress, then renders fresh results on completion.
 *
 * Age display: always shows "results from X minutes ago" at the top.
 *
 * Copy prompt: copies the full run + all results wrapped in a structured
 * coding-agent repair request to the clipboard.
 *
 * All errors use console.error — never window.alert().
 *
 * @module Frontend/Components/HealthPage
 */

import { useState, useEffect, useCallback } from "react";
import { Copy, Check, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ──────────────────────────────────────────────────────────────────

type RunStatus = "healthy" | "degraded" | "unhealthy" | "unknown";
type CheckStatus = "success" | "failure" | "pending" | "skipped";

interface HealthResult {
  id: string;
  run_id?: string;
  runId?: string;
  category: string;
  name: string;
  status: CheckStatus;
  message?: string;
  details?: any;
  duration_ms?: number;
  durationMs?: number;
  timestamp: string;
}

interface HealthRun {
  id: string;
  status: RunStatus;
  trigger: string;
  duration_ms?: number;
  durationMs?: number;
  created_at?: string;
  createdAt?: string;
}

// ─── Status Badge Styling ───────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  healthy: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  degraded: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  unhealthy: "bg-red-500/20 text-red-400 border-red-500/30",
  unknown: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failure: "bg-red-500/20 text-red-400 border-red-500/30",
  pending: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  skipped: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const STATUS_ICON: Record<string, string> = {
  success: "✓",
  failure: "✕",
  pending: "⏳",
  skipped: "—",
  warning: "⚠",
  healthy: "✓",
  degraded: "⚠",
  unhealthy: "✕",
  unknown: "?",
};

// ─── Copy Prompt Builder ────────────────────────────────────────────────────

/**
 * Builds a structured repair prompt for pasting into a coding agent.
 * Contains the full run details plus all failures with their diagnostic JSON.
 */
function buildCopyPrompt(run: HealthRun, results: HealthResult[]): string {
  const createdAt = run.created_at ?? run.createdAt ?? "";
  const durationMs = run.duration_ms ?? run.durationMs ?? 0;
  const failures = results.filter((r) => r.status === "failure");
  return `# Health Check Failure Report
Generated: ${createdAt}
Overall Status: ${run.status.toUpperCase()}
Duration: ${durationMs}ms
Trigger: ${run.trigger}

## Failed Checks (${failures.length}/${results.length})
${failures
  .map(
    (r) => `
### ${r.name} (${r.category})
Status: ${r.status}
Message: ${r.message ?? "No message"}
Duration: ${r.duration_ms ?? r.durationMs ?? 0}ms
Details:
${JSON.stringify(r.details ?? {}, null, 2)}
`,
  )
  .join("\n")}

## All Results
${JSON.stringify(results, null, 2)}

## Request
Please diagnose and fix all health check failures listed above.
For each failure, provide: root cause, specific code fix, and the file(s) to change.`;
}

// ─── Time Helpers ───────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Skeleton Component ─────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-zinc-800 ${className}`}
    />
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function HealthPage() {
  const [run, setRun] = useState<HealthRun | null>(null);
  const [results, setResults] = useState<HealthResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Load latest persisted results on mount ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as any;
          setRun(data.run);
          setResults(data.results ?? []);
        }
      } catch (e: any) {
        console.error("Failed to load health results:", e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Run Now ──
  const runNow = useCallback(async () => {
    setRunning(true);
    setRun(null);
    setResults([]);

    try {
      const res = await fetch("/api/health/run", { method: "POST" });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body}`);
      }
      const data = (await res.json()) as any;
      setRun(data.run);
      setResults(data.results ?? []);
    } catch (e: any) {
      console.error("Health run failed:", e.message);
    } finally {
      setRunning(false);
    }
  }, []);

  // ── Copy Report ──
  const copyPrompt = useCallback(async () => {
    if (!run) return;
    await navigator.clipboard.writeText(buildCopyPrompt(run, results));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [run, results]);

  const createdAt = run?.created_at ?? run?.createdAt ?? "";
  const runDurationMs = run?.duration_ms ?? run?.durationMs ?? 0;
  const age = createdAt ? timeAgo(createdAt) : null;

  // ── Loading State ──
  if (loading) {
    return (
      <div className="space-y-4 p-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-48" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">System Health</h1>
          {age && (
            <p className="text-sm text-zinc-400 flex items-center gap-1.5 mt-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Showing results from {age}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {run && results.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyPrompt}
              className="gap-1.5 border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied!" : "Copy Report"}
            </Button>
          )}
          <Button
            size="sm"
            onClick={runNow}
            disabled={running}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {running ? "Running…" : "Run Now"}
          </Button>
        </div>
      </div>

      {/* ── Overall Status Card ── */}
      {run && (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Overall Status
            </h2>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[run.status] ?? STATUS_BADGE.unknown}`}
            >
              {STATUS_ICON[run.status] ?? "?"} {run.status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-2">
            {results.filter((r) => r.status === "success").length}/
            {results.length} checks passed · {runDurationMs}ms total ·
            triggered by {run.trigger}
          </p>
        </div>
      )}

      {/* ── Running Skeleton ── */}
      {running && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-700/50 bg-zinc-900/50 p-4"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Results ── */}
      {!running && results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => {
            const durMs = r.duration_ms ?? r.durationMs ?? 0;
            return (
              <div
                key={r.id}
                className={`rounded-xl border bg-zinc-900/50 p-4 ${
                  r.status === "failure"
                    ? "border-red-500/30"
                    : "border-zinc-700/50"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-white truncate">
                        {r.name}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-zinc-600 text-zinc-400 capitalize">
                        {r.category}
                      </span>
                    </div>
                    {r.message && (
                      <p className="text-xs text-zinc-400 mt-0.5 truncate">
                        {r.message}
                      </p>
                    )}
                    {r.status === "failure" && r.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors">
                          Show details
                        </summary>
                        <pre className="text-xs bg-zinc-800 rounded-lg p-2 mt-1.5 overflow-auto max-h-48 whitespace-pre-wrap text-zinc-400 border border-zinc-700/50">
                          {JSON.stringify(r.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-500">{durMs}ms</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[r.status] ?? STATUS_BADGE.unknown}`}
                    >
                      {STATUS_ICON[r.status] ?? "?"} {r.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !running && results.length === 0 && (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/50 py-16 text-center">
          <div className="text-4xl mb-4">🏥</div>
          <p className="text-zinc-400 mb-4">No health results yet.</p>
          <Button
            onClick={runNow}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <Play className="size-4" />
            Run first health check
          </Button>
        </div>
      )}
    </div>
  );
}

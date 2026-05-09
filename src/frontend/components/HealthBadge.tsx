/**
 * @file src/frontend/components/HealthBadge.tsx
 *
 * Navbar health status badge — a pulsing dot that reflects the latest health run.
 *
 * Displayed on every page via Header.tsx. Polls /api/health every 30 seconds.
 * Clicking the badge navigates to /health for the full health report.
 *
 * Color mapping:
 *   healthy   → emerald (green)
 *   degraded  → yellow
 *   unhealthy → red
 *   unknown   → grey (no run yet, or fetch failed)
 *
 * @module Frontend/Components/HealthBadge
 */

import { useState, useEffect } from "react";
import { Activity } from "lucide-react";

type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/** Badge dot color mapping per status. */
const DOT_COLOR: Record<HealthStatus, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-yellow-500",
  unhealthy: "bg-red-500",
  unknown: "bg-gray-500",
};

/** Status label color mapping for text. */
const TEXT_COLOR: Record<HealthStatus, string> = {
  healthy: "text-emerald-400",
  degraded: "text-yellow-400",
  unhealthy: "text-red-400",
  unknown: "text-gray-400",
};

/**
 * Pulsing health status badge for the Navbar.
 *
 * Polls `/api/health` every 30 seconds to keep the status
 * indicator current without full-page reloads.
 */
export function HealthBadge() {
  const [status, setStatus] = useState<HealthStatus>("unknown");

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as any;
          setStatus(data?.run?.status ?? "unknown");
        } else if (res.status === 404) {
          // No runs yet — show unknown, not unhealthy
          setStatus("unknown");
        } else {
          setStatus("unhealthy");
        }
      } catch {
        setStatus("unhealthy");
      }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <a
      href="/health"
      className="hover:opacity-80 transition-opacity"
      title={`System: ${status.toUpperCase()}`}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-700/50 bg-zinc-900/50 backdrop-blur-sm shadow-sm">
        <div className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${DOT_COLOR[status]}`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${DOT_COLOR[status]}`}
          />
        </div>
        <span className={`text-[10px] font-medium uppercase ${TEXT_COLOR[status]}`}>
          {status}
        </span>
        <Activity className="h-3 w-3 text-zinc-500" />
      </div>
    </a>
  );
}

/**
 * @file src/backend/ai/health.ts
 *
 * Workers AI native binding health check.
 *
 * Fires a minimal probe to the configured chat model (env.AI_MODEL_CHAT)
 * via the native `env.AI.run()` binding. Validates both the binding and
 * the AI Gateway connectivity in a single call.
 *
 * Uses a 10-token Pong prompt to minimize cost and latency while still
 * exercising the full inference pipeline.
 *
 * @module Health/AI
 */

import type { HealthStepResult } from "../health/types";

/** Minimal prompt that produces a deterministic, short response. */
const PROBE_PROMPT = "Reply with exactly the word: Pong";

/**
 * Checks Workers AI binding reachability by running a minimal inference.
 *
 * Validates:
 * 1. `env.AI` binding is present
 * 2. `env.AI_MODEL_CHAT` env var is configured
 * 3. Model inference returns a non-empty response
 *
 * @returns HealthStepResult with probe response details
 */
export async function checkHealth(env: Env): Promise<HealthStepResult> {
  const start = Date.now();

  if (!env.AI) {
    return {
      name: "Workers AI",
      status: "failure",
      message: "AI binding missing from Env",
      durationMs: Date.now() - start,
      details: { binding: "AI", present: false },
    };
  }

  if (!env.AI_MODEL_CHAT) {
    return {
      name: "Workers AI",
      status: "failure",
      message: "AI_MODEL_CHAT env var not configured",
      durationMs: Date.now() - start,
      details: { envVar: "AI_MODEL_CHAT", present: false },
    };
  }

  try {
    const result = (await env.AI.run(env.AI_MODEL_CHAT as any, {
      messages: [{ role: "user", content: PROBE_PROMPT }],
      max_tokens: 10,
    })) as any;

    const responseText =
      result?.response ??
      result?.result ??
      result?.choices?.[0]?.message?.content ??
      "";

    if (typeof responseText !== "string") {
      return {
        name: "Workers AI",
        status: "failure",
        message: "AI probe returned empty or non-string response",
        durationMs: Date.now() - start,
        details: { model: env.AI_MODEL_CHAT, responseType: typeof responseText },
      };
    }

    return {
      name: "Workers AI",
      status: "success",
      message: "Workers AI inference operational",
      durationMs: Date.now() - start,
      details: {
        model: env.AI_MODEL_CHAT,
        response: responseText.trim().slice(0, 50),
        latencyMs: Date.now() - start,
      },
    };
  } catch (e: any) {
    return {
      name: "Workers AI",
      status: "failure",
      message: `AI probe failed: ${e.message}`,
      durationMs: Date.now() - start,
      details: {
        model: env.AI_MODEL_CHAT,
        errorName: e.name,
        errorStack: e.stack?.slice(0, 500),
      },
    };
  }
}

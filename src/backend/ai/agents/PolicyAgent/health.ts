/**
 * @file src/backend/ai/agents/policy-chat/health.ts
 *
 * PolicyChatAgent Durable Object binding health check.
 *
 * Verifies that the policy_CHAT_AGENT binding is present in the Env.
 * Unlike full agent probes that require @callable RPC, this check validates
 * the wrangler binding configuration is correct — the DO itself is exercised
 * via the AI check (which validates env.AI).
 *
 * @module Health/Agents/PolicyChat
 */

import type { HealthStepResult } from "../../../health/types";
import { getAgentByName } from "agents";

/**
 * Checks that the PolicyAgent DO binding exists in env and can be instantiated.
 *
 * This uses the Agents SDK `getAgentByName` method to verify the binding is
 * properly configured and accessible, rather than manually checking DO methods.
 *
 * @returns HealthStepResult with binding status
 */
export async function checkHealth(env: Env): Promise<HealthStepResult> {
  const start = Date.now();

  if (!env.POLICY_AGENT) {
    return {
      name: "PolicyAgent",
      status: "failure",
      message: "PolicyAgent binding missing from Env",
      durationMs: Date.now() - start,
      details: { binding: "POLICY_AGENT", present: false },
    };
  }

  // Verify the binding is a valid Agent by attempting to get a stub
  try {
    const stub = await getAgentByName(env.POLICY_AGENT as any, "health-probe");

    if (!stub) {
      return {
        name: "PolicyAgent",
        status: "failure",
        message: "Failed to get Agent stub via getAgentByName",
        durationMs: Date.now() - start,
        details: {
          binding: "POLICY_AGENT",
          stubCreated: false,
        },
      };
    }

    return {
      name: "PolicyAgent",
      status: "success",
      message: "PolicyAgent DO binding configured correctly via SDK",
      durationMs: Date.now() - start,
      details: { binding: "POLICY_AGENT", present: true },
    };
  } catch (e: any) {
    return {
      name: "PolicyAgent",
      status: "failure",
      message: `Agent binding probe failed: ${e.message}`,
      durationMs: Date.now() - start,
      details: { errorName: e.name },
    };
  }
}

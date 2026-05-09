import { getAgentByName } from "agents";

/**
 * Validates the health of the InvestorAgent by attempting to resolve its DO binding.
 * We use `getAgentByName` instead of manually inspecting bindings, aligning with SDK patterns.
 */
export async function checkHealth(env: Env) {
  try {
    const t0 = Date.now();
    // Validate we can instantiate the DO reference via the SDK
    const agent = getAgentByName(env.INVESTOR_AGENT, "health-probe");

    if (!agent) {
      throw new Error("SDK getAgentByName returned null/undefined");
    }

    return {
      name: "InvestorAgent Durable Object",
      status: "success" as const,
      message: "Agent binding resolved successfully",
      durationMs: Date.now() - t0,
    };
  } catch (error: any) {
    return {
      name: "InvestorAgent Durable Object",
      status: "failure" as const,
      message: `Failed to resolve agent binding: ${error.message}`,
      durationMs: 0,
    };
  }
}

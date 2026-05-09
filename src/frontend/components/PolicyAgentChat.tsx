"use client";

/**
 * @fileoverview Policy Agent Chat Island
 *
 * Full-page assistant-ui chat for the Policy War Room Agent.
 * Uses AssistantRuntimeProvider + AssistantChatTransport.
 *
 * NOTE: There is no dedicated /api/chat/policy endpoint yet.
 * This island uses /api/chat/investor as a fallback with a policy-oriented
 * system prompt. Update the `api` field once a policy backend endpoint exists.
 *
 * IMPORTANT: Must be mounted with client:only="react" in Astro pages.
 */

import * as React from "react";
import {
  AssistantRuntimeProvider,
} from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AgentThread } from "./AgentThread";

export function PolicyAgentChat() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat/policy",
      body: {
        systemPrompt:
          "You are the Renegade Capital Policy War Room Analyst. You specialize in analyzing the Trump AI Action Plan and its implications for social justice investing, algorithmic accountability, and civil rights. You help users understand policy threats, identify advocacy opportunities, and develop counter-strategies grounded in evidence-based research.",
      },
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AgentThread
        agentName="Policy War Room Analyst"
        agentAvatar="⚔"
        agentAvatarUrl="https://cdn.prod.website-files.com/686ecd0062f779f2ba045e1b/688131302dea1bbeefb0f383_AI%20Action%20Plan%20Cover.png"
        agentAvatarRounded
        agentColor="#ef4444"
        placeholder="Ask about AI policy threats, advocacy strategies, or civil rights implications…"
        emptyDescription="Analyze the Trump AI Action Plan and its implications for social justice. Get evidence-based threat assessments, advocacy strategies, and civil rights impact analysis."
        suggestions={[
          "What are the biggest threats in the Trump AI Action Plan?",
          "How does AI deregulation affect marginalized communities?",
          "What advocacy strategies can counter algorithmic discrimination?",
          "Analyze the impact of rolling back AI safety guardrails",
        ]}
        attribution="Powered by Renegade Capital Policy Intelligence"
      />
    </AssistantRuntimeProvider>
  );
}

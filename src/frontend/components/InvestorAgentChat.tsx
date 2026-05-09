"use client";

/**
 * @fileoverview Investor Agent Chat Island
 *
 * Full-page assistant-ui chat for the Social Justice Investor Agent.
 * Uses AssistantRuntimeProvider + AssistantChatTransport to connect
 * to /api/chat/investor.
 *
 * IMPORTANT: Must be mounted with client:only="react" in Astro pages.
 */

import * as React from "react";
import {
  AssistantRuntimeProvider,
} from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AgentThread } from "./AgentThread";

export function InvestorAgentChat() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat/investor",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AgentThread
        agentName="Social Justice Investor AI"
        agentAvatar="$"
        agentAvatarUrl="https://images.squarespace-cdn.com/content/v1/654be30fc8579e39439aebcf/56486fe4-3dd0-408f-b6a2-fb4444d2da44/TSJI_web2.png?format=500w"
        agentAvatarRounded
        agentColor="#10b981"
        placeholder="Ask about values-aligned investing…"
        emptyDescription="Rooted in Andrea Longton's The Social Justice Investor. Ask about ESG screening, ethical divestment, bridging the wealth gap, or building a values-aligned portfolio."
        suggestions={[
          "Help me find social justice investments",
          "How can I divest from private prisons?",
          "Show me compound growth projections",
          "What are the best ESG-screened ETFs?",
        ]}
        attribution="Powered by the Social Justice Investor philosophy · Andrea Longton"
      />
    </AssistantRuntimeProvider>
  );
}

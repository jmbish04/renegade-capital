"use client";

/**
 * @fileoverview Podcast Agent Chat Island
 *
 * Full-page assistant-ui chat for the Podcast Curator Agent.
 * Uses AssistantRuntimeProvider + AssistantChatTransport to connect
 * to /api/chat/podcast.
 *
 * IMPORTANT: Must be mounted with client:only="react" in Astro pages.
 */

import * as React from "react";
import {
  AssistantRuntimeProvider,
} from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AgentThread } from "./AgentThread";

export function PodcastAgentChat() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat/podcast",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AgentThread
        agentName="Renegade Capital Podcast Curator"
        agentAvatar="RC"
        agentAvatarUrl="https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/26bed561-51cd-46da-a999-c1c0a599a7fe/RC_Icon.png"
        agentColor="#f59e0b"
        placeholder="Ask about podcast guests, episode arcs, or thematic pairings…"
        emptyDescription="I help you find and book visionary guests at the intersection of AI, finance, and social justice. Ask for thematic pairings, narrative arcs, or specific profiles from the Renegade Capital Prospectus."
        suggestions={[
          "Help me brainstorm podcast ideas",
          "Suggest guests on algorithmic bias in lending",
          "Design a 3-episode arc on AI and the racial wealth gap",
          "Find guests who can debate Joy Buolamwini",
        ]}
        attribution="Powered by the Renegade Capital Prospectus"
      />
    </AssistantRuntimeProvider>
  );
}

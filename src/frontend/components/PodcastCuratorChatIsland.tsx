import * as React from 'react';
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AgentThread } from './AgentThread';

export function PodcastCuratorChatIsland() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat/podcast",
    }),
  });

  return (
    <div className="flex h-full flex-col bg-background">
      <AssistantRuntimeProvider runtime={runtime}>
        <AgentThread
          agentName="Renegade Capital Podcast Curator"
          agentAvatar="RC"
          placeholder="Ask about podcast guests, episode arcs, or thematic pairings…"
          emptyDescription="I help you find and book visionary guests at the intersection of AI, finance, and social justice. Ask for thematic pairings, narrative arcs, or specific profiles."
          suggestions={[
            'Help me brainstorm podcast ideas',
            'Suggest guests on algorithmic bias in lending',
            'Design a 3-episode arc on AI and the racial wealth gap'
          ]}
          attribution="Powered by the Renegade Capital Prospectus"
          emptyIcon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          }
        />
      </AssistantRuntimeProvider>
    </div>
  );
}

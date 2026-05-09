import * as React from 'react';
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AgentThread } from './AgentThread';

export function InvestorChatIsland() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat/investor",
    }),
  });

  return (
    <div className="flex h-full flex-col bg-background">
      <AssistantRuntimeProvider runtime={runtime}>
        <AgentThread
          agentName="Social Justice Investor AI"
          agentAvatar="AI"
          placeholder="Ask about values-aligned investing…"
          emptyDescription="Ask me anything about building a values-aligned portfolio, ESG screening, ethical divestment, or bridging the wealth gap."
          suggestions={[
            'Help me find social justice investments',
            'How can I divest from private prisons?',
            'Show me compound growth projections'
          ]}
          attribution="Powered by the Social Justice Investor philosophy · Andrea Longton"
          emptyIcon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
      </AssistantRuntimeProvider>
    </div>
  );
}

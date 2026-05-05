/**
 * @fileoverview Investor Chat Island
 *
 * A React island powered by @assistant-ui/react that connects to the
 * /api/chat/investor endpoint (SocialJusticeInvestorAgent). Uses the
 * Shadcn Default Dark Theme.
 */

import * as React from 'react';
import { AssistantRuntimeProvider, ThreadPrimitive, ComposerPrimitive, MessagePrimitive, ActionBarPrimitive, useAui } from '@assistant-ui/react';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { DefaultChatTransport } from 'ai';
import { SendHorizonalIcon, StopCircleIcon, RefreshCwIcon, CopyIcon } from 'lucide-react';
// 1. Import our newly created utility
import { parseMarkdownToHtml } from '../lib/utils/markdown-parser'; 

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

function useInvestorRuntime() {
  return useChatRuntime({
    transport: new DefaultChatTransport({ api: '/api/chat/investor' }),
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// 2. Create a reusable wrapper component for the markdown parser
function MarkdownText({ text }: { text: string }) {
  // Parse the raw markdown into HTML
  const htmlContent = parseMarkdownToHtml(text);
  
  // Render using dangerouslySetInnerHTML. 
  // NOTE: If you add DOMPurify later, you would wrap `htmlContent` like:
  // __html: DOMPurify.sanitize(htmlContent)
  return (
    <div 
      className="prose prose-sm dark:prose-invert max-w-none" 
      dangerouslySetInnerHTML={{ __html: htmlContent }} 
    />
  );
}


function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end gap-3 px-4 py-2">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
         {/* 3. Pass the raw text through a span for the user message (usually no markdown needed here) */}
        <MessagePrimitive.Parts components={{ Text: (props) => <span>{props.text}</span> }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex gap-3 px-4 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        AI
      </div>
      <div className="flex flex-col gap-1">
        <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
          {/* 4. Inject our MarkdownText component to handle the Assistant's rich text output */}
          <MessagePrimitive.Parts
            components={{
              Text: (props) => <MarkdownText text={props.text} />,
            }}
          />
        </div>
        <ActionBarPrimitive.Root
          hideWhenRunning
          autohide="not-last"
          className="flex items-center gap-1 px-1"
        >
          <ActionBarPrimitive.Copy asChild>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              aria-label="Copy message"
            >
              <CopyIcon className="size-3.5" />
            </button>
          </ActionBarPrimitive.Copy>
          <ActionBarPrimitive.Reload asChild>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              aria-label="Regenerate response"
            >
              <RefreshCwIcon className="size-3.5" />
            </button>
          </ActionBarPrimitive.Reload>
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

function SuggestionButton({ prompt }: { prompt: string }) {
  const aui = useAui();
  return (
    <button
      type="button"
      className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={() => {
        aui.composer().setText(prompt);
        // aui.composer().send(); // Uncomment this line if you want the prompt to send automatically on click
      }}
    >
      {prompt}
    </button>
  );
}

function Thread() {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col bg-background">
      {/* Message viewport */}
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto">
        {/* Empty state */}
        <ThreadPrimitive.Empty>
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
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
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Social Justice Investor AI</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask me anything about building a values-aligned portfolio, ESG screening,
                ethical divestment, or bridging the wealth gap.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'How can I divest from private prisons?',
                'What are the best ESG funds for climate impact?',
                'How do I start impact investing with $1,000?',
              ].map((prompt) => (
                <SuggestionButton key={prompt} prompt={prompt} />
              ))}
            </div>
          </div>
        </ThreadPrimitive.Empty>

        {/* Messages */}
        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      {/* Composer */}
      <div className="border-t border-border bg-background p-4">
        <ComposerPrimitive.Root className="flex items-end gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2">
          <ComposerPrimitive.Input
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="Ask about values-aligned investing…"
            rows={1}
            autoFocus
          />
          <ComposerPrimitive.Cancel asChild>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
              aria-label="Stop"
            >
              <StopCircleIcon className="size-4" />
            </button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
              aria-label="Send"
            >
              <SendHorizonalIcon className="size-4" />
            </button>
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Powered by the Social Justice Investor philosophy · Andrea Longton
        </p>
      </div>
    </ThreadPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Island entry point
// ---------------------------------------------------------------------------

export function InvestorChatIsland() {
  const runtime = useInvestorRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}

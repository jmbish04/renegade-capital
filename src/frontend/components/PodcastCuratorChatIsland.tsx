/**
 * @fileoverview Podcast Curator Chat Island
 *
 * A React island powered by @assistant-ui/react that connects to the
 * /api/chat/podcast endpoint (PodcastGuestAgent). Uses the
 * Shadcn Default Dark Theme.
 */

import * as React from 'react';
import { AssistantRuntimeProvider, ThreadPrimitive, ComposerPrimitive, MessagePrimitive, ActionBarPrimitive, useAui } from '@assistant-ui/react';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { DefaultChatTransport } from 'ai';
import { SendHorizonalIcon, StopCircleIcon, RefreshCwIcon, CopyIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

function usePodcastRuntime() {
  return useChatRuntime({
    transport: new DefaultChatTransport({ api: '/api/chat/podcast' }),
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end gap-3 px-4 py-2">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        <MessagePrimitive.Parts components={{ Text: (props) => <span>{props.text}</span> }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex gap-3 px-4 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        RC
      </div>
      <div className="flex flex-col gap-1">
        <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
          <MessagePrimitive.Parts
            components={{
              Text: (props) => <span className="whitespace-pre-wrap">{props.text}</span>,
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
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Renegade Capital Podcast Curator</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                I help you find and book visionary guests at the intersection of AI, finance, and
                social justice. Ask for thematic pairings, narrative arcs, or specific profiles.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'Suggest guests on algorithmic bias in lending',
                'Design a 3-episode arc on AI and the racial wealth gap',
                'Who should I pair with Ruha Benjamin?',
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
            placeholder="Ask about podcast guests, episode arcs, or thematic pairings…"
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
          Powered by the Renegade Capital Prospectus
        </p>
      </div>
    </ThreadPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Island entry point
// ---------------------------------------------------------------------------

export function PodcastCuratorChatIsland() {
  const runtime = usePodcastRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}

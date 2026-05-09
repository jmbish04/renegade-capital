"use client";

/**
 * @fileoverview Shared AgentThread component
 *
 * A reusable assistant-ui Thread component with support for:
 * - Reasoning/thinking display (collapsible)
 * - Suggestion buttons
 * - Generative tool UI (Charts, DataTables, QuestionFlow, Audio)
 * - Streaming markdown content
 * - Professional dark-theme styling via Shadcn
 *
 * Architecture note: This component MUST be rendered inside an
 * <AssistantRuntimeProvider> which is set up per-agent in the
 * individual chat islands.
 */

import * as React from "react";
import { type FC } from "react";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  useAuiState,
  useAui,
} from "@assistant-ui/react";
import {
  ChevronRight,
  Copy,
  Check,
  RotateCcw,
  Brain,
  ChevronDown,
  Sparkles,
  Bot,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Tool UI components
import { QuestionFlow } from "./tool-ui/question-flow";
import { Chart } from "./tool-ui/chart";
import { DataTable } from "./tool-ui/data-table";
import { Audio } from "./tool-ui/audio";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentThreadProps {
  /** Agent display name */
  agentName: string;
  /** Short agent avatar text (2 chars max) */
  agentAvatar: string;
  /** URL of the agent's avatar image */
  agentAvatarUrl?: string;
  /** Whether to render the avatar fully rounded (circle) — default is rounded-lg */
  agentAvatarRounded?: boolean;
  /** Hex color for agent avatar bg */
  agentColor?: string;
  /** Placeholder text for the composer */
  placeholder?: string;
  /** Suggestion prompts shown in the empty state */
  suggestions?: string[];
  /** Empty state description */
  emptyDescription?: string;
  /** Icon component for the empty state */
  emptyIcon?: React.ReactNode;
  /** Footer attribution text */
  attribution?: string;
  /** Callback for when a source badge is clicked */
  onSourceClick?: (source: any) => void;
}

// ─── Reasoning Block ──────────────────────────────────────────────────────────

const ReasoningBlock: FC<{ part: any }> = ({ part }) => {
  const parts = useAuiState((s: any) => s.message.parts);
  const groupParts = part.indices.map((i: number) => parts[i]);
  const [expanded, setExpanded] = React.useState(false);

  if (groupParts.length === 0) return null;

  // Determine if all tools/reasoning are complete
  const isRunning = groupParts.some(
    (p: any) =>
      (p.type === "tool-call" && !p.result) ||
      (p.type === "reasoning" && !p.isComplete)
  );

  return (
    <div className="mb-3 rounded-lg border border-border/50 bg-muted/30 overflow-hidden max-w-[85%]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Brain className={`size-3.5 ${isRunning ? "animate-pulse text-amber-400" : "text-muted-foreground"}`} />
        <span>{isRunning ? "Thinking…" : "Thought Process"}</span>
        <ChevronDown
          className={`ml-auto size-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-wrap flex flex-col gap-2">
          {groupParts.map((p: any, i: number) => {
            if (p.type === "reasoning") {
              return <div key={i} className="italic text-muted-foreground">{p.text}</div>;
            }
            if (p.type === "tool-call") {
              return <ToolCallRenderer key={i} part={p} />;
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
};

// ─── Source Group ─────────────────────────────────────────────────────────────

const SourceGroup: FC<{ part: any, onSourceClick?: (source: any) => void }> = ({ part, onSourceClick }) => {
  const parts = useAuiState((s: any) => s.message.parts);
  const sourceParts = part.indices.map((i: number) => parts[i]);
  
  if (sourceParts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2 max-w-[85%]">
      {sourceParts.map((p: any, i: number) => (
        <Badge 
          key={i} 
          variant="outline" 
          className="cursor-pointer bg-background/50 hover:bg-muted transition-colors flex items-center gap-1.5"
          onClick={() => {
            if (onSourceClick) {
              onSourceClick(p.source);
            } else if (p.source?.url) {
              window.open(p.source.url, '_blank');
            }
          }}
        >
          <span className="text-xs">📄</span>
          <span>{p.source?.title || "Source"}</span>
        </Badge>
      ))}
    </div>
  );
};

// ─── Tool Call Renderer ───────────────────────────────────────────────────────

const ToolCallRenderer: FC<{ part: any }> = ({ part }) => {
  const { toolName, args, result } = part;
  const aui = useAui();

  if (toolName === "questionFlow" && args) {
    return (
      <QuestionFlow
        steps={args.steps}
        onComplete={(answers) => {
          // Format the answers into a readable summary and send back to the AI
          const lines = Object.entries(answers).map(([stepId, answer]) => {
            const step = args.steps.find((s: any) => s.id === stepId);
            const question = step?.question || stepId;
            return `${question}: ${answer}`;
          });
          const summary = `Here are my answers:\n${lines.join("\n")}`;

          aui.thread().append({
            role: "user",
            content: [{ type: "text", text: summary }],
          });
        }}
      />
    );
  }

  if (toolName === "renderChart" && result) {
    return (
      <Chart
        title={result.title}
        data={result.data}
        xKey={result.xKey}
        series={result.series}
      />
    );
  }

  if (toolName === "renderDataTable" && result) {
    return (
      <DataTable
        title={result.title}
        columns={result.columns}
        data={result.data}
      />
    );
  }

  if (toolName === "renderPodcastMedia" && result) {
    return (
      <Audio
        title={result.title}
        description={result.description}
        src={result.src}
        artwork={result.artwork}
      />
    );
  }

  if (toolName === "systemNotification" && args) {
    const isError = args.isError;
    return (
      <div className={`my-3 p-4 rounded-lg border ${isError ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-amber-500/50 bg-amber-500/10 text-amber-500'} flex items-start gap-3`}>
        {isError ? <RotateCcw className="size-5 shrink-0" /> : <Bot className="size-5 shrink-0 animate-pulse" />}
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">{isError ? "System Failure" : "Model Fallback Initiated"}</p>
          <p className="text-xs opacity-90">{args.message}</p>
        </div>
      </div>
    );
  }

  // Fallback: show tool name and status
  return (
    <div className={`my-2 flex flex-col gap-2 rounded-md border ${result?.error ? 'border-destructive/50 bg-destructive/10' : 'border-border/50 bg-muted/30'} px-3 py-2 text-xs`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Sparkles className="size-3.5" />
        <span className="font-medium">{toolName}</span>
        {!result && <span className="animate-pulse ml-auto">Running…</span>}
        {result && !result.error && <span className="ml-auto text-green-500/80"><Check className="size-3" /></span>}
        {result?.error && <span className="ml-auto text-destructive"><RotateCcw className="size-3" /></span>}
      </div>
      {result?.error && (
        <div className="text-destructive font-medium border-t border-destructive/20 pt-2 mt-1 whitespace-pre-wrap">
          Error: {result.error}
        </div>
      )}
    </div>
  );
};

// ─── User Message ─────────────────────────────────────────────────────────────

const UserMessage: FC = () => (
  <MessagePrimitive.Root className="mb-4 flex justify-end">
    <div className="flex items-start gap-3 max-w-[85%]">
      <div className="rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground leading-relaxed">
        <MessagePrimitive.Content />
      </div>
      <Avatar className="size-8 shrink-0 border border-border/50">
        <AvatarFallback className="bg-primary/10 text-xs">
          <User className="size-3.5" />
        </AvatarFallback>
      </Avatar>
    </div>
  </MessagePrimitive.Root>
);

// ─── Thread Loading Indicator ─────────────────────────────────────────────────

const ThreadLoadingIndicator: FC<{ agentName: string }> = ({ agentName }) => {
  const isRunning = useAuiState((s: any) => s.thread?.isRunning || false);
  if (!isRunning) return null;

  return (
    <div className="flex justify-center py-2 pb-6">
      <span className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-4 py-2 rounded-full border border-border/50 shadow-sm">
        <Sparkles className="size-3.5 animate-pulse text-primary" />
        {agentName} is thinking...
      </span>
    </div>
  );
};

// ─── Assistant Message ────────────────────────────────────────────────────────

const AssistantMessage: FC<{
  avatarText: string;
  avatarUrl?: string;
  avatarRounded?: boolean;
  avatarColor?: string;
  onSourceClick?: (source: any) => void;
}> = ({ avatarText, avatarUrl, avatarRounded, avatarColor, onSourceClick }) => (
  <MessagePrimitive.Root className="mb-4">
    <div className="flex items-start gap-3 max-w-[85%]">
      <Avatar
        className={`size-8 shrink-0 border border-border/50 ${
          avatarRounded ? "rounded-full" : "rounded-lg"
        }`}
      >
        {avatarUrl && (
          <AvatarImage
            src={avatarUrl}
            alt={avatarText}
            className={`object-cover ${
              avatarRounded ? "rounded-full" : "rounded-lg"
            }`}
          />
        )}
        <AvatarFallback
          className={`text-xs font-bold ${
            avatarRounded ? "rounded-full" : "rounded-lg"
          }`}
          style={{
            backgroundColor: avatarColor
              ? `${avatarColor}20`
              : "hsl(var(--primary) / 0.1)",
            color: avatarColor || "hsl(var(--primary))",
          }}
        >
          {avatarText}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex flex-col gap-2 w-full">
          {/* We use MessagePrimitive.Parts directly to control exactly what is shown where */}
          <MessagePrimitive.Parts
            components={{
              Text: ({ text }) => (
                <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm text-foreground leading-relaxed max-w-[85%]">
                  <Markdown
                    className="prose prose-invert prose-sm max-w-none space-y-3 leading-relaxed [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>li]:mb-1 [&>h1]:mb-3 [&>h1]:text-base [&>h1]:font-bold [&>h2]:mb-2 [&>h2]:text-sm [&>h2]:font-semibold [&>h3]:mb-1 [&>h3]:text-sm [&>h3]:font-medium [&>blockquote]:border-l-2 [&>blockquote]:border-primary/30 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:text-muted-foreground [&>pre]:rounded-md [&>pre]:bg-background [&>pre]:p-3 [&>pre]:text-xs [&>code]:rounded [&>code]:bg-background/80 [&>code]:px-1 [&>code]:py-0.5 [&>code]:text-xs"
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  >
                    {text}
                  </Markdown>
                </div>
              ),
              tools: {
                by_name: {
                  questionFlow: (props: any) => <ToolCallRenderer part={props} />,
                  renderChart: (props: any) => <ToolCallRenderer part={props} />,
                  renderDataTable: (props: any) => <ToolCallRenderer part={props} />,
                  renderPodcastMedia: (props: any) => <ToolCallRenderer part={props} />,
                  systemNotification: (props: any) => <ToolCallRenderer part={props} />,
                },
                // Any other tools should ideally be caught by our group-chainOfThought mapping, 
                // but just in case they leak out:
                Fallback: (props: any) => <ToolCallRenderer part={props} />,
              },
            }}
          />
          
          {/* Render Sources */}
          <MessagePrimitive.Parts
            components={{
              Text: () => null, // Ignore text
              tools: { Fallback: () => null }, // Ignore tools
            }}
          />
          <MessagePrimitive.GroupedParts
            groupBy={(part) => part.type === "source" ? "group-source" : null}
          >
            {({ part }: any) => {
              if (part.type === "group-source") {
                return <SourceGroup part={part} onSourceClick={onSourceClick} />;
              }
              return null;
            }}
          </MessagePrimitive.GroupedParts>

          {/* Grouped ChainOfThought renderer for reasoning and background tools */}
          <MessagePrimitive.GroupedParts
            groupBy={(part) => {
              if (part.type === "reasoning") return "group-chainOfThought";
              if (part.type === "tool-call") {
                const interactiveTools = ["questionFlow", "renderChart", "renderDataTable", "renderPodcastMedia", "systemNotification"];
                if (!interactiveTools.includes(part.toolName)) {
                  return "group-chainOfThought";
                }
              }
              return null;
            }}
          >
            {({ part }: any) => {
              if (part.type === "group-chainOfThought") {
                return <ReasoningBlock part={part} />;
              }
              return null;
            }}
          </MessagePrimitive.GroupedParts>
        </div>

        {/* Action bar */}
        <ActionBarPrimitive.Root
          hideWhenRunning
          autohide="not-last"
          className="flex items-center gap-1 px-1"
        >
          <ActionBarPrimitive.Copy asChild>
            <Button variant="ghost" size="icon" className="size-6">
              <Copy className="size-3" />
            </Button>
          </ActionBarPrimitive.Copy>
          <ActionBarPrimitive.Reload asChild>
            <Button variant="ghost" size="icon" className="size-6">
              <RotateCcw className="size-3" />
            </Button>
          </ActionBarPrimitive.Reload>
        </ActionBarPrimitive.Root>
      </div>
    </div>
  </MessagePrimitive.Root>
);

// ─── Main Thread Component ────────────────────────────────────────────────────

export function AgentThread({
  agentName,
  agentAvatar,
  agentAvatarUrl,
  agentAvatarRounded,
  agentColor,
  placeholder = "Send a message…",
  suggestions = [],
  emptyDescription = "How can I help you today?",
  emptyIcon,
  attribution,
  onSourceClick,
}: AgentThreadProps) {
  return (
    <ThreadPrimitive.Root className="flex flex-1 flex-col relative">
      <ThreadPrimitive.Viewport className="flex-1 overflow-auto">
        {/* Empty state */}
        <ThreadPrimitive.Empty>
          <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-16 text-center">
            {/* Agent icon */}
            {agentAvatarUrl ? (
              <img
                src={agentAvatarUrl}
                alt={agentName}
                className={`size-20 object-cover border-2 border-primary/20 shadow-lg shadow-primary/5 ${
                  agentAvatarRounded ? "rounded-full" : "rounded-2xl"
                }`}
              />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 shadow-lg shadow-primary/5">
                {emptyIcon || (
                  <Bot
                    className="size-10"
                    style={{ color: agentColor || "hsl(var(--primary))" }}
                  />
                )}
              </div>
            )}

            {/* Title + description */}
            <div className="max-w-md">
              <h3 className="text-lg font-bold text-foreground mb-2">
                {agentName}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {emptyDescription}
              </p>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {suggestions.map((prompt) => (
                  <ThreadPrimitive.Suggestion
                    key={prompt}
                    prompt={prompt}
                    method="replace"
                    autoSend
                    asChild
                  >
                    <button
                      type="button"
                      className="group relative rounded-full border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:border-primary/30 hover:text-foreground hover:shadow-sm"
                    >
                      <Sparkles className="inline-block size-3 mr-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      {prompt}
                    </button>
                  </ThreadPrimitive.Suggestion>
                ))}
              </div>
            )}
          </div>
        </ThreadPrimitive.Empty>

        {/* Messages */}
        <div className="max-w-3xl mx-auto px-4 py-4">
          <ThreadPrimitive.Messages
            components={{
              UserMessage: UserMessage,
              AssistantMessage: () => (
                <AssistantMessage
                  avatarText={agentAvatar}
                  avatarUrl={agentAvatarUrl}
                  avatarRounded={agentAvatarRounded}
                  avatarColor={agentColor}
                  onSourceClick={onSourceClick}
                />
              ),
            }}
          />
          <ThreadLoadingIndicator agentName={agentName} />
        </div>
      </ThreadPrimitive.Viewport>

      {/* Scroll to bottom */}
      <ThreadPrimitive.ScrollToBottom asChild>
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-24 right-6 size-8 rounded-full shadow-lg border-border/50 bg-background/80 backdrop-blur-sm z-10"
        >
          <ChevronDown className="size-4" />
        </Button>
      </ThreadPrimitive.ScrollToBottom>

      {/* Composer */}
      <div className="border-t border-border bg-background/95 backdrop-blur-sm p-4">
        <ComposerPrimitive.Root className="max-w-3xl mx-auto flex items-end gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 transition-colors focus-within:border-primary/40 focus-within:bg-muted/50">
          <ComposerPrimitive.Input
            autoFocus
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[1.5rem] max-h-[10rem]"
          />
          <ComposerPrimitive.Send asChild>
            <Button
              size="icon"
              className="size-8 shrink-0 rounded-lg"
            >
              <ChevronRight className="size-4" />
            </Button>
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
        {attribution && (
          <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
            {attribution}
          </p>
        )}
      </div>
    </ThreadPrimitive.Root>
  );
}

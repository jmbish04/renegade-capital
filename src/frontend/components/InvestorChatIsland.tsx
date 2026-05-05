/**
 * @fileoverview Investor Chat Island
 *
 * A React island powered by @ai-sdk/react and @assistant-ui/react that connects to the
 * /api/chat/investor endpoint (SocialJusticeInvestorAgent). Supports tool rendering
 * for QuestionFlow and Chart components.
 */

import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { SendHorizonalIcon } from 'lucide-react';
import { QuestionFlow } from '../tool-ui/question-flow';
import { Chart } from '../tool-ui/chart';
import { parseMarkdownToHtml } from '../lib/utils/markdown-parser';

// ---------------------------------------------------------------------------
// Tool rendering components
// ---------------------------------------------------------------------------

function ToolInvocation({ toolName, args, result }: any) {
  if (toolName === 'questionFlow' && args) {
    return <QuestionFlow steps={args.steps} onComplete={(answers) => {
      // Submit answers back to chat
      console.log('QuestionFlow completed:', answers);
    }} />;
  }

  if (toolName === 'renderChart' && result) {
    return (
      <Chart
        title={result.title}
        data={result.data}
        xKey={result.xKey}
        series={result.series}
      />
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function InvestorChatIsland() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat/investor',
    initialMessages: [],
  });

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSuggestion = (text: string) => {
    handleInputChange({ target: { value: text } } as any);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Message viewport */}
      <div className="flex-1 overflow-y-auto">
        {/* Empty state */}
        {messages.length === 0 && (
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
                'Help me find social justice investments',
                'How can I divest from private prisons?',
                'Show me compound growth projections',
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => handleSuggestion(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-4 p-4">
          {messages.map((message) => {
            if (message.role === 'user') {
              return (
                <div key={message.id} className="flex justify-end gap-3">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {message.content}
                  </div>
                </div>
              );
            }

            return (
              <div key={message.id} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  AI
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  {message.content && (
                    <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(message.content) }}
                      />
                    </div>
                  )}

                  {/* Tool invocations */}
                  {message.toolInvocations?.map((tool: any) => (
                    <div key={tool.toolCallId}>
                      <ToolInvocation
                        toolName={tool.toolName}
                        args={tool.args}
                        result={tool.result}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-background p-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about values-aligned investing…"
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={isLoading || !input.trim()}
          >
            <SendHorizonalIcon className="size-4" />
          </Button>
        </form>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Powered by the Social Justice Investor philosophy · Andrea Longton
        </p>
      </div>
    </div>
  );
}

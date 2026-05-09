/**
 * @fileoverview ClashChatModal — Floating chat modal for the Clash page.
 *
 * Connects to the ClashChatAgent Durable Object via WebSocket using
 * the Cloudflare Agents SDK React hooks:
 *   - useAgent() — establishes the WebSocket connection to the DO
 *   - useAgentChat() — provides chat state management
 *
 * useAgentChat API (from @cloudflare/ai-chat/react):
 *   Returns: { messages, sendMessage, clearHistory, setMessages,
 *              status, isStreaming, isServerStreaming, isToolContinuation }
 *   - messages use `msg.parts` (Array<{ type: "text", text: string } | ...>)
 *     NOT `msg.content`
 *   - sendMessage({ text: string }) — NOT handleSubmit / handleInputChange
 *   - status: "submitted" | "streaming" | "ready" | "error"
 *   - isStreaming: true when client or server streaming is active
 *
 * Must be rendered with `client:only="react"` in Astro pages to avoid
 * SSG context crashes (assistant-ui requires browser-only React contexts).
 *
 * Uses the RC icon as the agent avatar, matching the PodcastCuratorChatIsland pattern.
 */

import React, { useState, useRef, useEffect } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";

const RC_ICON =
  "https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/26bed561-51cd-46da-a999-c1c0a599a7fe/RC_Icon.png?format=1500w";

/**
 * Extract text content from a UIMessage's parts array.
 * UIMessage uses `msg.parts` (not `msg.content`).
 * Each part has `{ type: "text", text: string }` or other part types.
 */
function getMessageText(msg: any): string {
  if (!msg.parts) return "";
  return msg.parts
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("");
}

export function ClashChatModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect to the ClashChatAgent Durable Object via WebSocket
  const agent = useAgent({
    agent: "clash-chat-agent",
    name: `clash-session-${typeof crypto !== "undefined" ? crypto.randomUUID() : Date.now()}`,
  });

  // useAgentChat API: { messages, sendMessage, status, isStreaming, ... }
  const { messages, sendMessage, status, isStreaming } = useAgentChat({
    agent,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    sendMessage({ text });
    setInputValue("");
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(inputValue);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-emerald-600 text-white shadow-2xl hover:bg-emerald-500 transition-all duration-300 flex items-center justify-center group"
        aria-label="Open AI Policy Chat"
        style={{
          boxShadow: "0 4px 24px rgba(16, 185, 129, 0.4)",
        }}
      >
        {isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[420px] max-h-[600px] rounded-2xl border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            animation: "slideUp 0.3s ease-out",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-700/50 bg-zinc-800/50">
            <img
              src={RC_ICON}
              alt="RC"
              className="h-8 w-8 rounded-full object-cover ring-2 ring-emerald-500/50"
            />
            <div>
              <h3 className="text-sm font-semibold text-white">
                AI Policy Analyst
              </h3>
              <p className="text-xs text-zinc-400">
                Analyzing the AI Action Plan through a social justice lens
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-[300px] max-h-[420px]">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-3">
                <div className="text-4xl">⚖️</div>
                <p className="text-sm text-zinc-400">
                  Ask about the Trump administration's AI Action Plan and its
                  implications for social justice.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {[
                    "What are the key risks?",
                    "How does this affect marginalized communities?",
                    "Which guests should discuss this?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSend(suggestion)}
                      className="text-xs px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg: any) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <img
                    src={RC_ICON}
                    alt="AI"
                    className="h-7 w-7 rounded-full object-cover flex-shrink-0 mt-0.5"
                  />
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-800 text-zinc-200 border border-zinc-700/50"
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: getMessageText(msg),
                  }}
                />
              </div>
            ))}

            {isStreaming && (
              <div className="flex gap-3">
                <img
                  src={RC_ICON}
                  alt="AI"
                  className="h-7 w-7 rounded-full object-cover flex-shrink-0 mt-0.5"
                />
                <div className="bg-zinc-800 rounded-2xl px-4 py-3 border border-zinc-700/50">
                  <div className="flex gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            id="clash-chat-form"
            onSubmit={handleFormSubmit}
            className="px-5 py-3 border-t border-zinc-700/50 bg-zinc-800/30"
          >
            <div className="flex gap-2">
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about the AI Action Plan..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                disabled={status !== "ready" && !isStreaming}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || (status !== "ready" && !isStreaming)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

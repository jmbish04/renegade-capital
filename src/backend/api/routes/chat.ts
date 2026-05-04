/**
 * @fileoverview Chat API routes for the Renegade Capital multi-agent platform.
 *
 * Provides streaming chat endpoints that proxy requests to the AI agents
 * defined in `../../ai/agents.ts`. Returns responses in the Vercel AI SDK
 * UIMessage stream format so `@assistant-ui/react-ai-sdk` can consume them.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { AGENTS } from '../../ai/agents';
import type { Bindings } from '../index';

const chatRouter = new Hono<{ Bindings: Bindings }>();

/**
 * UIMessage schema — the Vercel AI SDK v6 message format sent by
 * DefaultChatTransport from @assistant-ui/react-ai-sdk.
 */
const uiMessagePartSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
}).passthrough();

const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(uiMessagePartSchema).optional(),
}).passthrough();

const chatRequestSchema = z.object({
  id: z.string().optional(),
  messages: z.array(uiMessageSchema),
  trigger: z.string().optional(),
  messageId: z.string().optional(),
});

/**
 * Extracts the plain text content from a UIMessage.
 * UIMessages store content in `parts` arrays, with text parts having
 * `{ type: 'text', text: '...' }`.
 */
function extractTextFromMessage(msg: z.infer<typeof uiMessageSchema>): string {
  if (!msg.parts || msg.parts.length === 0) return '';
  return msg.parts
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('');
}

/**
 * Converts the incoming UIMessage array into the Cloudflare Workers AI
 * messages format (`{ role, content }[]`), prepending the system prompt.
 */
function buildAIMessages(
  messages: z.infer<typeof uiMessageSchema>[],
  systemPrompt: string
): Array<{ role: string; content: string }> {
  const converted: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  for (const msg of messages) {
    if (msg.role === 'system') continue; // system prompt is handled above
    const content = extractTextFromMessage(msg);
    if (content) {
      converted.push({ role: msg.role, content });
    }
  }

  return converted;
}

/**
 * Streams a response from Workers AI and transforms it into the
 * Vercel AI SDK UIMessage stream format expected by @assistant-ui.
 */
async function streamAgentResponse(
  env: Bindings,
  agentKey: 'investor' | 'podcast',
  messages: z.infer<typeof uiMessageSchema>[]
): Promise<Response> {
  const agent = AGENTS[agentKey];
  const aiMessages = buildAIMessages(messages, agent.systemPrompt);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const textId = 'text-main';
      writer.write({ type: 'start' });
      writer.write({ type: 'text-start', id: textId });

      try {
        const aiResult = await env.AI.run(
          agent.model as '@cf/meta/llama-3.2-3b-instruct',
          {
            messages: aiMessages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
            stream: true,
          }
        );

        // Workers AI returns a ReadableStream when stream: true
        const aiStream = aiResult as unknown as ReadableStream;

        const reader = aiStream.getReader();
        const decoder = new TextDecoder();

        let leftover = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = (leftover + chunk).split('\n');
          leftover = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data) as {
                response?: string;
                choices?: Array<{ delta?: { content?: string } }>;
              };

              // Workers AI format: { response: "..." }
              const delta =
                parsed.response ??
                parsed.choices?.[0]?.delta?.content;

              if (delta) {
                writer.write({ type: 'text-delta', id: textId, delta });
              }
            } catch (parseErr) {
              // Log malformed SSE chunks at debug level to aid troubleshooting
              console.debug('[chat] Skipping malformed SSE chunk:', parseErr);
            }
          }
        }
      } catch (err) {
        writer.write({
          type: 'error',
          errorText: err instanceof Error ? err.message : 'AI inference failed',
        });
      }

      writer.write({ type: 'text-end', id: textId });
      writer.write({ type: 'finish-step' });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

/**
 * POST /api/chat/investor
 *
 * Streaming endpoint for the SocialJusticeInvestorAgent.
 * Validates the request with Zod and streams the agent's response back
 * in the UIMessage stream format.
 */
chatRouter.post(
  '/investor',
  zValidator('json', chatRequestSchema),
  async (c) => {
    const { messages } = c.req.valid('json');
    return streamAgentResponse(c.env, 'investor', messages);
  }
);

/**
 * POST /api/chat/podcast
 *
 * Streaming endpoint for the PodcastGuestAgent.
 * Validates the request with Zod and streams the agent's response back
 * in the UIMessage stream format.
 */
chatRouter.post(
  '/podcast',
  zValidator('json', chatRequestSchema),
  async (c) => {
    const { messages } = c.req.valid('json');
    return streamAgentResponse(c.env, 'podcast', messages);
  }
);

export { chatRouter };

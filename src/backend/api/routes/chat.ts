/**
 * @fileoverview Chat API routes for the Renegade Capital multi-agent platform.
 *
 * Provides streaming chat endpoints using AI SDK v6's UIMessageStream protocol
 * for compatibility with @assistant-ui/react-ai-sdk on the frontend.
 *
 * Architecture:
 *   Frontend (AssistantChatTransport / useChat) → POST /api/chat/:agent
 *   → Backend receives UIMessage[], converts to model messages
 *   → streamText() via AI Gateway → returns toUIMessageStreamResponse()
 */

import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { run, tool } from '@openai/agents';
import { createAiSdkUiMessageStreamResponse } from '@openai/agents-extensions/ai-sdk-ui';
import { getConfiguredAgent } from '@/ai/agents';
import type { Bindings } from '@/api/index';
import { drizzle } from 'drizzle-orm/d1';
import { guests } from '@/db/schema';
import {
  createSearchPolicyTool,
  createGetPageDetailsTool,
  createSearchGuestsTool,
  createSearchEpisodesTool,
  createGetTagHierarchyTool,
  getPolicyMentionBuffer,
  clearPolicyMentionBuffer,
} from '@/ai/agents/PolicyAgent/index';

const chatRouter = new OpenAPIHono<{ Bindings: Bindings }>();

/**
 * Message schema for the chat API — permissive to support all
 * assistant-ui / Vercel SDK payloads.
 */
const chatRequestSchema = z
  .object({
    messages: z.array(z.any()),
    system: z.string().optional(),
    tools: z.any().optional(),
  })
  .passthrough();

// ─── Tool definitions (AI SDK v6 format) ─────────────────────────────────────

const questionFlowTool = tool({
  name: 'questionFlow',
  description:
    'Present an interactive question flow to gather information from the user',
  parameters: z.object({
      steps: z.array(
        z.object({
          id: z.string(),
          question: z.string(),
          type: z.enum(['text', 'choice']).optional(),
          options: z.array(z.string()).optional(),
        })
      ),
    }),
  // @ts-ignore
  execute: async ({ steps }: any) => ({ steps }),
});

const renderChartTool = tool({
  name: 'renderChart',
  description: 'Render a line chart to visualize financial data over time',
  parameters: z.object({
      title: z.string().optional(),
      data: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
      xKey: z.string(),
      series: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          color: z.string().optional(),
        })
      ),
    }),
  // @ts-ignore
  execute: async ({ title, data, xKey, series }: any) => ({
    title,
    data,
    xKey,
    series,
  }),
});

const renderPodcastMediaTool = tool({
  name: 'renderPodcastMedia',
  description:
    'Generate podcast media (audio and artwork) from a script and image prompt',
  parameters: z.object({
      title: z.string(),
      description: z.string(),
      audioScript: z.string(),
      imagePrompt: z.string(),
    }),
  // @ts-ignore
  execute: async ({ title, description, audioScript, imagePrompt }: any) => ({
    title,
    description,
    src: `/api/media/audio?text=${encodeURIComponent(audioScript)}`,
    artwork: `/api/media/image?prompt=${encodeURIComponent(imagePrompt)}`,
  }),
});

const renderDataTableTool = tool({
  name: 'renderDataTable',
  description:
    'Render an interactive data table for displaying tabular information like fund comparisons, stock metrics, or financial data. Use this instead of markdown tables.',
  parameters: z.object({
      title: z.string().optional(),
      columns: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          priority: z.enum(['high', 'medium', 'low']).optional(),
        })
      ),
      data: z.array(
        z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      ),
    }),
  // @ts-ignore
  execute: async ({ title, columns, data }: any) => ({ title, columns, data }),
});

// ─── Guest tools (env-bound) ─────────────────────────────────────────────────

function createGuestTools(env: Bindings) {
  const getAllGuestsTool = tool({
    name: 'getAllGuests',
    description:
      'Retrieve the complete roster of podcast guests from the database',
    parameters: z.object({}),
    // @ts-ignore
    execute: async (): Promise<any> => {
      try {
        const db = drizzle(env.DB);
        const allGuests = await db.select().from(guests);
        const parsedGuests = allGuests.map((guest) => ({
          id: guest.id,
          name: guest.name,
          personaDescription: guest.personaDescription,
          expertise: JSON.parse(guest.expertise),
          tone: guest.tone,
          background: guest.background,
          chemistry: JSON.parse(guest.chemistry),
          domain: JSON.parse(guest.domain),
          affiliation: guest.affiliation,
        }));
        return { guests: parsedGuests, total: parsedGuests.length };
      } catch (error) {
        console.error('Error fetching guests:', error);
        return { error: 'Failed to fetch guests', guests: [] };
      }
    },
  });

  const findGuestByAttributeTool = tool({
    name: 'findGuestByAttribute',
    description:
      'Search for guests by specific attributes like domain, chemistry, expertise, or name',
    parameters: z.object({
        name: z.string().optional(),
        domain: z.string().optional(),
        chemistry: z.string().optional(),
        expertise: z.string().optional(),
      }),
    // @ts-ignore
    execute: async (params: any): Promise<any> => {
      try {
        const db = drizzle(env.DB);
        let results = await db.select().from(guests);

        if (params.name) {
          results = results.filter((guest) =>
            guest.name.toLowerCase().includes(params.name!.toLowerCase())
          );
        }

        let parsedResults = results.map((guest) => ({
          id: guest.id,
          name: guest.name,
          personaDescription: guest.personaDescription,
          expertise: JSON.parse(guest.expertise),
          tone: guest.tone,
          background: guest.background,
          chemistry: JSON.parse(guest.chemistry),
          domain: JSON.parse(guest.domain),
          affiliation: guest.affiliation,
        }));

        if (params.domain) {
          parsedResults = parsedResults.filter((guest) =>
            guest.domain.some((d: string) =>
              d.toLowerCase().includes(params.domain!.toLowerCase())
            )
          );
        }

        if (params.chemistry) {
          parsedResults = parsedResults.filter((guest) =>
            guest.chemistry.some((c: string) =>
              c.toLowerCase().includes(params.chemistry!.toLowerCase())
            )
          );
        }

        if (params.expertise) {
          parsedResults = parsedResults.filter((guest) =>
            guest.expertise.some((e: string) =>
              e.toLowerCase().includes(params.expertise!.toLowerCase())
            )
          );
        }

        return { guests: parsedResults, total: parsedResults.length };
      } catch (error) {
        console.error('Error searching guests:', error);
        return { error: 'Failed to search guests', guests: [] };
      }
    },
  });

  const pairGuestsTool = tool({
    name: 'pairGuests',
    description:
      'Find guests with complementary expertise or chemistry for episode pairings. Analyzes the chemistry and domain overlap to suggest compelling conversations.',
    parameters: z.object({
        guestName: z.string(),
        maxResults: z.number().optional(),
      }),
    // @ts-ignore
    execute: async (params: any): Promise<any> => {
      try {
        const db = drizzle(env.DB);
        const allGuests = await db.select().from(guests);

        const parsedGuests = allGuests.map((guest) => ({
          id: guest.id,
          name: guest.name,
          personaDescription: guest.personaDescription,
          expertise: JSON.parse(guest.expertise),
          tone: guest.tone,
          background: guest.background,
          chemistry: JSON.parse(guest.chemistry),
          domain: JSON.parse(guest.domain),
          affiliation: guest.affiliation,
        }));

        const targetGuest = parsedGuests.find(
          (g) =>
            g.name.toLowerCase() === params.guestName.toLowerCase()
        );

        if (!targetGuest) {
          return { error: 'Guest not found', pairings: [] };
        }

        const scored = parsedGuests
          .filter((g) => g.id !== targetGuest.id)
          .map((guest) => {
            let score = 0;
            const chemistryOverlap = guest.chemistry.filter(
              (c: string) => targetGuest.chemistry.includes(c)
            ).length;
            score += chemistryOverlap * 2;

            const domainOverlap = guest.domain.filter(
              (d: string) => targetGuest.domain.includes(d)
            ).length;
            score += domainOverlap * 3;

            const hasComplementaryDomain = guest.domain.some(
              (d: string) =>
                !targetGuest.domain.includes(d) &&
                (targetGuest.domain.includes('AI Ethics') ||
                  targetGuest.domain.includes('Finance'))
            );
            if (hasComplementaryDomain) score += 1;

            return { guest, score };
          })
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, params.maxResults || 5);

        return {
          targetGuest,
          pairings: scored.map((item) => ({
            guest: item.guest,
            compatibilityScore: item.score,
            reason: `Shares ${item.guest.chemistry
              .filter((c: string) =>
                targetGuest.chemistry.includes(c)
              )
              .join(', ')} chemistry and ${item.guest.domain
              .filter((d: string) =>
                targetGuest.domain.includes(d)
              )
              .join(', ')} domains`,
          })),
        };
      } catch (error) {
        console.error('Error pairing guests:', error);
        return { error: 'Failed to pair guests', pairings: [] };
      }
    },
  });

  return { getAllGuestsTool, findGuestByAttributeTool, pairGuestsTool };
}

// ─── POST /api/chat/investor ─────────────────────────────────────────────────

const investorRoute = createRoute({
  method: 'post',
  path: '/investor',
  request: {
    body: {
      content: { 'application/json': { schema: chatRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { 'text/plain': { schema: z.any() } },
      description: 'Streaming chat response',
    },
    500: {
      content: { 'application/json': { schema: z.object({ error: z.string(), details: z.string() }) } },
      description: 'Failed to stream response',
    },
  },
});

chatRouter.openapi(investorRoute, async (c) => {
    const rawBody = await c.req.json().catch(() => ({}));
    const validated = c.req.valid('json') as any;
    const incomingMessages = validated?.messages || rawBody?.messages || [];
    const clientSystem = validated?.system || rawBody?.system;
    
    try {
      const agent = await getConfiguredAgent(c.env, 'investor', [
        questionFlowTool,
        renderChartTool,
        renderDataTableTool,
      ]);

      const messages = incomingMessages.map((m: any) => ({
        role: m.role as "user" | "assistant" | "system",
        content:
          typeof m.content === "string"
            ? m.content
            : m.parts
                ?.filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("\n") ?? "",
      }));

      const stream = await run(agent, messages as any, { stream: true });

      return createAiSdkUiMessageStreamResponse(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }) as any;
    } catch (error) {
      console.error('[chat/investor] Error:', error);
      return c.json(
        {
          error: 'Failed to stream response',
          details:
            error instanceof Error ? error.message : 'Unknown error',
        } as any, 500);
    }
  }
);

// ─── POST /api/chat/podcast ──────────────────────────────────────────────────

const podcastRoute = createRoute({
  method: 'post',
  path: '/podcast',
  request: {
    body: {
      content: { 'application/json': { schema: chatRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { 'text/plain': { schema: z.any() } },
      description: 'Streaming chat response',
    },
    500: {
      content: { 'application/json': { schema: z.object({ error: z.string(), details: z.string() }) } },
      description: 'Failed to stream response',
    },
  },
});

chatRouter.openapi(podcastRoute, async (c) => {
    const rawBody = await c.req.json().catch(() => ({}));
    const validated = c.req.valid('json') as any;
    const incomingMessages = validated?.messages || rawBody?.messages || [];
    const clientSystem = validated?.system || rawBody?.system;

    try {
      const guestTools = createGuestTools(c.env);
      const agent = await getConfiguredAgent(c.env, 'podcast', [
        questionFlowTool,
        renderPodcastMediaTool,
        guestTools.getAllGuestsTool,
        guestTools.findGuestByAttributeTool,
        guestTools.pairGuestsTool,
      ]);

      const messages = incomingMessages.map((m: any) => ({
        role: m.role as "user" | "assistant" | "system",
        content:
          typeof m.content === "string"
            ? m.content
            : m.parts
                ?.filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("\n") ?? "",
      }));

      const stream = await run(agent, messages as any, { stream: true });

      return createAiSdkUiMessageStreamResponse(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }) as any;
    } catch (error: any) {
      console.error('[chat/podcast] Error:', error);
      console.error('[chat/podcast] Error cause:', error.cause);
      console.error('[chat/podcast] Error value:', error.value);
      console.error('[chat/podcast] Error JSON:', JSON.stringify(error, null, 2));
      return c.json(
        {
          error: 'Failed to stream response',
          details: error.message || 'Unknown error',
          apiError: error.value || error.cause || null
        } as any, 500);
    }
  }
);

// ─── POST /api/chat/policy ───────────────────────────────────────────────────

const policyRoute = createRoute({
  method: 'post',
  path: '/policy',
  request: {
    body: {
      content: { 'application/json': { schema: chatRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { 'text/plain': { schema: z.any() } },
      description: 'Streaming chat response',
    },
    500: {
      content: { 'application/json': { schema: z.object({ error: z.string(), details: z.string() }) } },
      description: 'Failed to stream response',
    },
  },
});

chatRouter.openapi(policyRoute, async (c) => {
    const rawBody = await c.req.json().catch(() => ({}));
    const validated = c.req.valid('json') as any;
    const incomingMessages = validated?.messages || rawBody?.messages || [];
    const clientSystem = validated?.system || rawBody?.system;

    try {
      clearPolicyMentionBuffer();
      const agent = await getConfiguredAgent(c.env, 'policy', [
        questionFlowTool,
        renderDataTableTool,
        createSearchPolicyTool(c.env as any),
        createGetPageDetailsTool(c.env as any),
        createSearchGuestsTool(c.env as any),
        createSearchEpisodesTool(c.env as any),
        createGetTagHierarchyTool(c.env as any),
      ]);

      const messages = incomingMessages.map((m: any) => ({
        role: m.role as "user" | "assistant" | "system",
        content:
          typeof m.content === "string"
            ? m.content
            : m.parts
                ?.filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("\n") ?? "",
      }));

      const stream = await run(agent, messages as any, { stream: true });

      const baseResponse = createAiSdkUiMessageStreamResponse(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });

      // Intercept the stream to inject assistant-ui source annotations at the end
      if (baseResponse.body) {
        const reader = baseResponse.body.getReader();
        const wrappedStream = new ReadableStream({
          async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
              const mentions = getPolicyMentionBuffer();
              if (mentions.length > 0) {
                const sources = mentions.map((m) => ({
                  type: "source",
                  sourceType: "url",
                  url: m.imageUrl || `/api/media/pdf?page=${m.pageNum}`,
                  title: `Page ${m.pageNum}`,
                }));
                const annotationChunk = `8:${JSON.stringify(sources)}\n`;
                controller.enqueue(new TextEncoder().encode(annotationChunk));
              }
              controller.close();
              return;
            }
            controller.enqueue(value);
          },
          cancel() {
            reader.cancel();
          }
        });
        return new Response(wrappedStream, baseResponse) as any;
      }

      return baseResponse as any;
    } catch (error) {
      console.error('[chat/policy] Error:', error);
      return c.json(
        {
          error: 'Failed to stream response',
          details:
            error instanceof Error ? error.message : 'Unknown error',
        } as any, 500);
    }
  }
);

export { chatRouter };

/**
 * @fileoverview Chat API routes for the Renegade Capital multi-agent platform.
 *
 * Provides streaming chat endpoints with tool support for the AI agents
 * defined in `../../ai/agents.ts`. Uses Vercel AI SDK streamText with
 * the official OpenAI SDK provider routed through Cloudflare AI Gateway.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { AGENTS, getAIGatewayBaseURL } from '../../ai/agents';
import type { Bindings } from '../index';
import { drizzle } from 'drizzle-orm/d1';
import { guests } from '../../db/schema';

const chatRouter = new Hono<{ Bindings: Bindings }>();

/**
 * Message schema for the chat API
 */
const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema),
});

/**
 * Tool definitions for the AI agents
 */
const questionFlowTool = {
  description: 'Present an interactive question flow to gather information from the user',
  parameters: z.object({
    steps: z.array(z.object({
      id: z.string(),
      question: z.string(),
      type: z.enum(['text', 'choice']).optional(),
      options: z.array(z.string()).optional(),
    })),
  }),
  execute: async ({ steps }: { steps: any[] }) => {
    // Tool execution happens on the client side
    // Return the configuration for rendering
    return { steps };
  },
};

const renderChartTool = {
  description: 'Render a line chart to visualize financial data over time',
  parameters: z.object({
    title: z.string().optional(),
    data: z.array(z.record(z.union([z.string(), z.number()]))),
    xKey: z.string(),
    series: z.array(z.object({
      key: z.string(),
      label: z.string(),
      color: z.string().optional(),
    })),
  }),
  execute: async ({ title, data, xKey, series }: any) => {
    return { title, data, xKey, series };
  },
};

const renderPodcastMediaTool = {
  description: 'Generate podcast media (audio and artwork) from a script and image prompt',
  parameters: z.object({
    title: z.string(),
    description: z.string(),
    audioScript: z.string(),
    imagePrompt: z.string(),
  }),
  execute: async ({ title, description, audioScript, imagePrompt }: any) => {
    // Construct URLs to the media endpoints
    const audioUrl = `/api/media/audio?text=${encodeURIComponent(audioScript)}`;
    const artworkUrl = `/api/media/image?prompt=${encodeURIComponent(imagePrompt)}`;

    return {
      title,
      description,
      src: audioUrl,
      artwork: artworkUrl,
    };
  },
};

const renderDataTableTool = {
  description: 'Render an interactive data table for displaying tabular information like fund comparisons, stock metrics, or financial data. Use this instead of markdown tables.',
  parameters: z.object({
    title: z.string().optional(),
    columns: z.array(z.object({
      key: z.string(),
      label: z.string(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
    })),
    data: z.array(z.record(z.union([z.string(), z.number(), z.boolean()]))),
  }),
  execute: async ({ title, columns, data }: any) => {
    return { title, columns, data };
  },
};

/**
 * Guest tools for the Podcast Curator Agent
 */
const getAllGuestsTool = {
  description: 'Retrieve the complete roster of podcast guests from the database',
  parameters: z.object({}),
  execute: async (_params: any, context: any) => {
    try {
      const db = drizzle(context.env.DB);
      const allGuests = await db.select().from(guests);

      // Parse JSON fields
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
};

const findGuestByAttributeTool = {
  description: 'Search for guests by specific attributes like domain, chemistry, expertise, or name',
  parameters: z.object({
    name: z.string().optional(),
    domain: z.string().optional(),
    chemistry: z.string().optional(),
    expertise: z.string().optional(),
  }),
  execute: async (params: any, context: any) => {
    try {
      const db = drizzle(context.env.DB);
      let results = await db.select().from(guests);

      // Filter by name if provided
      if (params.name) {
        results = results.filter((guest) =>
          guest.name.toLowerCase().includes(params.name.toLowerCase())
        );
      }

      // Parse JSON fields and filter
      const parsedResults = results.map((guest) => ({
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

      // Filter by domain if provided
      let filteredResults = parsedResults;
      if (params.domain) {
        filteredResults = filteredResults.filter((guest) =>
          guest.domain.some((d: string) =>
            d.toLowerCase().includes(params.domain.toLowerCase())
          )
        );
      }

      // Filter by chemistry if provided
      if (params.chemistry) {
        filteredResults = filteredResults.filter((guest) =>
          guest.chemistry.some((c: string) =>
            c.toLowerCase().includes(params.chemistry.toLowerCase())
          )
        );
      }

      // Filter by expertise if provided
      if (params.expertise) {
        filteredResults = filteredResults.filter((guest) =>
          guest.expertise.some((e: string) =>
            e.toLowerCase().includes(params.expertise.toLowerCase())
          )
        );
      }

      return { guests: filteredResults, total: filteredResults.length };
    } catch (error) {
      console.error('Error searching guests:', error);
      return { error: 'Failed to search guests', guests: [] };
    }
  },
};

const pairGuestsTool = {
  description: 'Find guests with complementary expertise or chemistry for episode pairings. Analyzes the chemistry and domain overlap to suggest compelling conversations.',
  parameters: z.object({
    guestName: z.string(),
    maxResults: z.number().optional(),
  }),
  execute: async (params: any, context: any) => {
    try {
      const db = drizzle(context.env.DB);
      const allGuests = await db.select().from(guests);

      // Parse JSON fields
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

      // Find the target guest
      const targetGuest = parsedGuests.find(
        (g) => g.name.toLowerCase() === params.guestName.toLowerCase()
      );

      if (!targetGuest) {
        return { error: 'Guest not found', pairings: [] };
      }

      // Calculate compatibility scores
      const scored = parsedGuests
        .filter((g) => g.id !== targetGuest.id)
        .map((guest) => {
          let score = 0;

          // Chemistry overlap (shared archetypes)
          const chemistryOverlap = guest.chemistry.filter((c: string) =>
            targetGuest.chemistry.includes(c)
          ).length;
          score += chemistryOverlap * 2;

          // Domain overlap (shared domains)
          const domainOverlap = guest.domain.filter((d: string) =>
            targetGuest.domain.includes(d)
          ).length;
          score += domainOverlap * 3;

          // Complementary domains (different but related)
          const hasComplementaryDomain = guest.domain.some((d: string) =>
            !targetGuest.domain.includes(d) &&
            (targetGuest.domain.includes('AI Ethics') || targetGuest.domain.includes('Finance'))
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
          reason: `Shares ${item.guest.chemistry.filter((c: string) => targetGuest.chemistry.includes(c)).join(', ')} chemistry and ${item.guest.domain.filter((d: string) => targetGuest.domain.includes(d)).join(', ')} domains`,
        })),
      };
    } catch (error) {
      console.error('Error pairing guests:', error);
      return { error: 'Failed to pair guests', pairings: [] };
    }
  },
};

/**
 * POST /api/chat/investor
 *
 * Streaming endpoint for the SocialJusticeInvestorAgent with tool support.
 */
chatRouter.post(
  '/investor',
  zValidator('json', chatRequestSchema),
  async (c) => {
    const { messages } = c.req.valid('json');
    const agent = AGENTS.investor;

    // Get AI Gateway configuration from environment
    const accountId = c.env.CLOUDFLARE_ACCOUNT_ID || '';
    const gatewayId = c.env.AI_GATEWAY_ID || 'renegade-capital';
    const openaiApiKey = c.env.OPENAI_API_KEY || '';

    // Create OpenAI client with AI Gateway base URL
    const openai = createOpenAI({
      apiKey: openaiApiKey,
      baseURL: getAIGatewayBaseURL(accountId, gatewayId),
    });

    try {
      const result = streamText({
        model: openai(agent.model),
        system: agent.systemPrompt,
        messages,
        tools: {
          questionFlow: questionFlowTool,
          renderChart: renderChartTool,
          renderDataTable: renderDataTableTool,
        },
        maxSteps: 5,
      });

      return result.toDataStreamResponse();
    } catch (error) {
      console.error('[chat/investor] Error:', error);
      return c.json({
        error: 'Failed to stream response',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }
);

/**
 * POST /api/chat/podcast
 *
 * Streaming endpoint for the PodcastGuestAgent with tool support.
 */
chatRouter.post(
  '/podcast',
  zValidator('json', chatRequestSchema),
  async (c) => {
    const { messages } = c.req.valid('json');
    const agent = AGENTS.podcast;

    // Get AI Gateway configuration from environment
    const accountId = c.env.CLOUDFLARE_ACCOUNT_ID || '';
    const gatewayId = c.env.AI_GATEWAY_ID || 'renegade-capital';
    const openaiApiKey = c.env.OPENAI_API_KEY || '';

    // Create OpenAI client with AI Gateway base URL
    const openai = createOpenAI({
      apiKey: openaiApiKey,
      baseURL: getAIGatewayBaseURL(accountId, gatewayId),
    });

    // Create context-aware tool wrappers
    const contextualGetAllGuests = {
      ...getAllGuestsTool,
      execute: async (params: any) => getAllGuestsTool.execute(params, { env: c.env }),
    };

    const contextualFindGuestByAttribute = {
      ...findGuestByAttributeTool,
      execute: async (params: any) => findGuestByAttributeTool.execute(params, { env: c.env }),
    };

    const contextualPairGuests = {
      ...pairGuestsTool,
      execute: async (params: any) => pairGuestsTool.execute(params, { env: c.env }),
    };

    try {
      const result = streamText({
        model: openai(agent.model),
        system: agent.systemPrompt,
        messages,
        tools: {
          questionFlow: questionFlowTool,
          renderPodcastMedia: renderPodcastMediaTool,
          getAllGuests: contextualGetAllGuests,
          findGuestByAttribute: contextualFindGuestByAttribute,
          pairGuests: contextualPairGuests,
        },
        maxSteps: 5,
      });

      return result.toDataStreamResponse();
    } catch (error) {
      console.error('[chat/podcast] Error:', error);
      return c.json({
        error: 'Failed to stream response',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }
);

export { chatRouter };

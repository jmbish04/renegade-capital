/**
 * @fileoverview Chat API routes for the Renegade Capital multi-agent platform.
 *
 * Provides streaming chat endpoints with tool support for the AI agents
 * defined in `../../ai/agents.ts`. Uses Vercel AI SDK streamText with
 * Cloudflare Workers AI provider.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { streamText } from 'ai';
import { AGENTS } from '../../ai/agents';
import type { Bindings } from '../index';

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

/**
 * Custom Cloudflare Workers AI language model provider
 */
function createCloudflareProvider(env: Bindings, modelId: string) {
  return {
    doStream: async (options: any) => {
      const { prompt, system, messages } = options;

      // Build messages array
      const aiMessages: Array<{ role: string; content: string }> = [];

      if (system) {
        aiMessages.push({ role: 'system', content: system });
      }

      if (messages) {
        aiMessages.push(...messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        })));
      } else if (prompt) {
        aiMessages.push({ role: 'user', content: prompt });
      }

      const result = await env.AI.run(modelId as any, {
        messages: aiMessages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        stream: true,
        max_tokens: 4096,
      });

      return result as ReadableStream;
    },

    doGenerate: async (options: any) => {
      const { prompt, system, messages } = options;

      // Build messages array
      const aiMessages: Array<{ role: string; content: string }> = [];

      if (system) {
        aiMessages.push({ role: 'system', content: system });
      }

      if (messages) {
        aiMessages.push(...messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        })));
      } else if (prompt) {
        aiMessages.push({ role: 'user', content: prompt });
      }

      const result = await env.AI.run(modelId as any, {
        messages: aiMessages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        stream: false,
        max_tokens: 4096,
      });

      return result;
    },
  };
}

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

    try {
      const result = streamText({
        model: createCloudflareProvider(c.env, agent.model) as any,
        system: agent.systemPrompt,
        messages,
        tools: {
          questionFlow: questionFlowTool,
          renderChart: renderChartTool,
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

    try {
      const result = streamText({
        model: createCloudflareProvider(c.env, agent.model) as any,
        system: agent.systemPrompt,
        messages,
        tools: {
          questionFlow: questionFlowTool,
          renderPodcastMedia: renderPodcastMediaTool,
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

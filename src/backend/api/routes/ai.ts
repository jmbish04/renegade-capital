/**
 * @fileoverview AI API routes for Workers AI integration via AI Gateway
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../index';
import { AGENTS, getAIGatewayBaseURL, getAiGatewayToken } from '../../ai/agents';
import { drizzle } from 'drizzle-orm/d1';
import { guests } from '../../db/schema';
import { eq } from 'drizzle-orm';

const aiRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply auth middleware
aiRouter.use('*', authMiddleware);

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
  model: z.string().optional(),
});

const speechToTextSchema = z.object({
  audio: z.string(), // base64 encoded audio
});

const textToSpeechSchema = z.object({
  text: z.string(),
  voice: z.string().optional(),
});

// POST /api/ai/chat
aiRouter.post('/chat', zValidator('json', chatSchema), async (c) => {
  const { messages, model = 'workers-ai/@cf/openai/gpt-oss-120b' } = c.req.valid('json');

  try {

    const openai = createOpenAI({
      apiKey: await getAiGatewayToken(c.env),
      baseURL: await getAIGatewayBaseURL(c.env),
    });

    const result = await generateText({
      model: openai(model),
      messages,
      maxTokens: 4096,
    });

    return c.json({ response: result.text });
  } catch (error) {
    console.error('AI chat error:', error);
    return c.json({ error: 'AI chat failed' }, 500);
  }
});

// POST /api/ai/chat/stream
aiRouter.post('/chat/stream', zValidator('json', chatSchema), async (c) => {
  const { messages } = c.req.valid('json');
  const agent = AGENTS.investor;
  
  try {

    const openai = createOpenAI({
      apiKey: await getAiGatewayToken(c.env),
      baseURL: await getAIGatewayBaseURL(c.env),
    });

    const result = streamText({
      model: openai(agent.model || 'workers-ai/@cf/openai/gpt-oss-120b'),
      system: agent.systemPrompt,
      messages,
      // tools: {
      //   questionFlow: questionFlowTool,
      //   renderChart: renderChartTool,
      //   renderDataTable: renderDataTableTool,
      // },
      maxSteps: 5,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('AI chat stream error:', error);
    return c.json({ error: 'AI chat stream failed' }, 500);
  }
});

// POST /api/ai/speech-to-text
aiRouter.post('/speech-to-text', zValidator('json', speechToTextSchema), async (c) => {
  const { audio } = c.req.valid('json');

  try {
    const audioBuffer = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));

    const response = await c.env.AI.run('@cf/openai/whisper-large-v3-turbo', {
      audio: Array.from(audioBuffer),
    });

    return c.json(response);
  } catch (error) {
    console.error('Speech-to-text error:', error);
    return c.json({ error: 'Speech-to-text failed' }, 500);
  }
});

// POST /api/ai/text-to-speech
aiRouter.post('/text-to-speech', zValidator('json', textToSpeechSchema), async (c) => {
  const { text, voice = 'alloy' } = c.req.valid('json');

  try {
    const response = await c.env.AI.run('@cf/deepgram/aura-2-en', {
      text,
      voice,
    });

    if (response instanceof ReadableStream) {
      const reader = response.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const audioData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        audioData.set(chunk, offset);
        offset += chunk.length;
      }

      const base64Audio = btoa(String.fromCharCode(...audioData));
      return c.json({ audio: base64Audio });
    }

    return c.json(response);
  } catch (error) {
    console.error('Text-to-speech error:', error);
    return c.json({ error: 'Text-to-speech failed' }, 500);
  }
});

// POST /api/ai/embeddings
aiRouter.post('/embeddings', zValidator('json', z.object({ text: z.string().min(1) })), async (c) => {
  const { text } = await c.req.json();

  try {
    const response = await c.env.AI.run('@cf/baai/bge-large-en-v1.5', {
      text,
    });

    return c.json(response);
  }

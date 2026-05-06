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
    // Resolve AI Gateway Token (Handling potential async secret store binding)
    const aiApiKey = await getAiGatewayToken(c.env);

    // Create OpenAI client with AI Gateway base URL
    const openai = createOpenAI({
      apiKey: aiApiKey as string,
      baseURL: getAIGatewayBaseURL(c.env),
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
    // Resolve AI Gateway Token
    const aiApiKey = await getAiGatewayToken(c.env);

    // Create OpenAI client with AI Gateway base URL
    const openai = createOpenAI({
      apiKey: aiApiKey as string,
      baseURL: await getAIGatewayBaseURL(c.env),
    });

    const result = streamText({
      model: openai(agent.model),
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
    // Decode base64 audio
    const audioBuffer = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));

    const response = await c.env.AI.run('@cf/openai/whisper', {
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
    const response = await c.env.AI.run('@cf/deepgram/aura-1', {
      text,
      voice,
    });

    // Return audio as base64
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
    const response = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text,
    });

    return c.json(response);
  } catch (error) {
    console.error('Embeddings error:', error);
    return c.json({ error: 'Embeddings generation failed' }, 500);
  }
});

// GET /api/ai/insights/:id
// Fetches a guest by ID and generates a 1-paragraph pitch via AI Gateway using the AI SDK
aiRouter.get('/insights/:id', async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid guest ID' }, 400);
  }

  try {
    // Fetch guest from database
    const db = drizzle(c.env.DB);
    const result = await db.select().from(guests).where(eq(guests.id, id));

    if (result.length === 0) {
      return c.json({ error: 'Guest not found' }, 404);
    }

    const guest = result[0];

    // Parse JSON fields
    const parsedGuest = {
      ...guest,
      expertise: JSON.parse(guest.expertise),
      chemistry: JSON.parse(guest.chemistry),
      domain: JSON.parse(guest.domain),
    };

    // Resolve AI Gateway Token
    const aiApiKey = await (c.env.AI_GATEWAY_TOKEN as any).get();

    // Create OpenAI client with AI Gateway base URL
    const openai = createOpenAI({
      apiKey: aiApiKey as string,
      baseURL: await getAIGatewayBaseURL(c.env),
    });

    const prompt = `You are an expert podcast curator for "The Social Justice Investor" podcast, which explores the intersection of finance, AI ethics, and social justice.

Generate a compelling 1-paragraph pitch (3-4 sentences) explaining why ${parsedGuest.name} would be an exceptional guest for the podcast.

Guest Information:
- Name: ${parsedGuest.name}
- Background: ${parsedGuest.background}
- Persona: ${parsedGuest.personaDescription}
- Expertise: ${parsedGuest.expertise.join(', ')}
- Tone: ${parsedGuest.tone}
- Domain: ${parsedGuest.domain.join(', ')}
- Chemistry: ${parsedGuest.chemistry.join(', ')}

The pitch should highlight their unique perspective, how their work bridges finance and social justice, and what listeners would gain from hearing their story. Be specific and compelling.`;

    // Generate insight using the AI SDK
    const openaiResult = await generateText({
      model: openai('workers-ai/@cf/openai/gpt-oss-120b'),
      prompt,
      maxTokens: 300,
      temperature: 0.8,
    });

    const insight = openaiResult.text || 'No insight generated.';

    return c.json({
      guest: parsedGuest,
      insight,
    });
  } catch (error) {
    console.error('Insights generation error:', error);
    return c.json({
      error: 'Failed to generate guest insight',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export { aiRouter };

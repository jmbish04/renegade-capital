/**
 * @fileoverview AI API routes for Workers AI integration via AI Gateway
 */

import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import { authMiddleware } from '@/backend/api/middleware/auth';
import type { Bindings, Variables } from '@/backend/api';
import { getAgentConfigs, getAIGatewayBaseURL, getAiGatewayToken } from '@/backend/ai/agents';
import { drizzle } from 'drizzle-orm/d1';
import { guests } from '@/backend/db/schema';
import { eq } from 'drizzle-orm';

const aiRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

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
const chatRoute = createRoute({
  method: 'post',
  path: '/chat',
  request: {
    body: {
      content: {
        'application/json': {
          schema: chatSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.object({ response: z.string() }) },
      },
      description: 'Chat response',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Chat failed',
    },
  },
});

aiRouter.openapi(chatRoute, async (c) => {
  const { messages, model = 'workers-ai/@cf/openai/gpt-oss-120b' } = c.req.valid('json');

  try {
    const openai = createOpenAI({
      apiKey: await getAiGatewayToken(c.env),
      baseURL: await getAIGatewayBaseURL(c.env),
    });

    const result = await generateText({
      model: openai(model),
      messages,
      // maxTokens: 4096,
    });

    return c.json({ response: result.text } as any, 200);
  } catch (error) {
    console.error('AI chat error:', error);
    return c.json({ error: 'AI chat failed' } as any, 500);
  }
});

// POST /api/ai/chat/stream
const chatStreamRoute = createRoute({
  method: 'post',
  path: '/chat/stream',
  request: {
    body: {
      content: {
        'application/json': {
          schema: chatSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Streamed chat response',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Chat stream failed',
    },
  },
});

aiRouter.openapi(chatStreamRoute, async (c) => {
  const { messages } = c.req.valid('json');
  const agent = getAgentConfigs(c.env).investor;
  
  try {
    const openai = createOpenAI({
      apiKey: await getAiGatewayToken(c.env),
      baseURL: await getAIGatewayBaseURL(c.env),
    });

    const result = streamText({
      model: openai(agent.model || 'workers-ai/@cf/openai/gpt-oss-120b'),
      system: agent.systemPrompt,
      messages,
      // maxSteps: 5,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('AI chat stream error:', error);
    return c.json({ error: 'AI chat stream failed' } as any, 500);
  }
});

// POST /api/ai/speech-to-text
const speechToTextRoute = createRoute({
  method: 'post',
  path: '/speech-to-text',
  request: {
    body: {
      content: {
        'application/json': {
          schema: speechToTextSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.any() },
      },
      description: 'Transcription result',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Transcription failed',
    },
  },
});

aiRouter.openapi(speechToTextRoute, async (c) => {
  const { audio } = c.req.valid('json');

  try {
    const audioBuffer = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));

    const response = await c.env.AI.run('@cf/openai/whisper-large-v3-turbo', {
      audio: Array.from(audioBuffer),
    });

    return c.json(response as any, 200);
  } catch (error) {
    console.error('Speech-to-text error:', error);
    return c.json({ error: 'Speech-to-text failed' } as any, 500);
  }
});

// POST /api/ai/text-to-speech
const textToSpeechRoute = createRoute({
  method: 'post',
  path: '/text-to-speech',
  request: {
    body: {
      content: {
        'application/json': {
          schema: textToSpeechSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.any() },
      },
      description: 'Audio generated',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Text-to-speech failed',
    },
  },
});

aiRouter.openapi(textToSpeechRoute, async (c) => {
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
      return c.json({ audio: base64Audio } as any, 200);
    }

    return c.json(response as any, 200);
  } catch (error) {
    console.error('Text-to-speech error:', error);
    return c.json({ error: 'Text-to-speech failed' } as any, 500);
  }
});

// POST /api/ai/embeddings
const embeddingsRoute = createRoute({
  method: 'post',
  path: '/embeddings',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ text: z.string().min(1) }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.any() },
      },
      description: 'Embeddings generated',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Embeddings generation failed',
    },
  },
});

aiRouter.openapi(embeddingsRoute, async (c) => {
  const { text } = c.req.valid('json');

  try {
    const response = await c.env.AI.run('@cf/baai/bge-large-en-v1.5', {
      text,
    });

    return c.json(response as any, 200);
  } catch (error) {
    console.error('Embeddings error:', error);
    return c.json({ error: 'Embeddings generation failed' } as any, 500);
  }
});

// GET /api/ai/insights/:id
const getInsightsRoute = createRoute({
  method: 'get',
  path: '/insights/{id}',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            guest: z.any(),
            insight: z.string(),
          }),
        },
      },
      description: 'Insights generated',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Invalid guest ID',
    },
    404: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Guest not found',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string(), details: z.string() }) },
      },
      description: 'Insights generation failed',
    },
  },
});

aiRouter.openapi(getInsightsRoute, async (c) => {
  const id = c.req.param('id');

  if (!id) {
    return c.json({ error: 'Invalid guest ID' } as any, 400);
  }

  try {
    const db = drizzle(c.env.DB);
    const result = await db.select().from(guests).where(eq(guests.id, id));

    if (result.length === 0) {
      return c.json({ error: 'Guest not found' } as any, 404);
    }

    const guest = result[0];

    const parsedGuest = {
      ...guest,
      expertise: JSON.parse(guest.expertise),
      chemistry: JSON.parse(guest.chemistry),
      domain: JSON.parse(guest.domain),
    };

    const openai = createOpenAI({
      apiKey: await getAiGatewayToken(c.env),
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

    const openaiResult = await generateText({
      model: openai('workers-ai/@cf/openai/gpt-oss-120b'),
      prompt,
      // maxTokens: 300,
      temperature: 0.8,
    });

    const insight = openaiResult.text || 'No insight generated.';

    return c.json({
      guest: parsedGuest,
      insight,
    } as any, 200);
  } catch (error) {
    console.error('Insights generation error:', error);
    return c.json({
      error: 'Failed to generate guest insight',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as any, 500);
  }
});

export { aiRouter };

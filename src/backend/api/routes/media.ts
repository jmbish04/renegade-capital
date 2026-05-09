/**
 * @fileoverview Media generation routes for AI-powered audio and image creation
 *
 * Provides endpoints for generating text-to-speech audio and text-to-image artwork
 * using Cloudflare Workers AI models.
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Bindings } from '../index';

const mediaRouter = new OpenAPIHono<{ Bindings: Bindings }>();

/**
 * GET /api/media/audio
 *
 * Generates text-to-speech audio using Cloudflare Workers AI.
 * Query parameters:
 *   - text: The text to convert to speech
 */
const getAudioRoute = createRoute({
  method: 'get',
  path: '/audio',
  request: {
    query: z.object({
      text: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'audio/mpeg': { schema: z.any() },
      },
      description: 'Audio stream',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Missing required parameter: text',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string(), details: z.string().optional() }) },
      },
      description: 'Failed to generate audio',
    },
  },
});

mediaRouter.openapi(getAudioRoute, async (c) => {
  const text = c.req.query('text');

  if (!text) {
    return c.json({ error: 'Missing required parameter: text' } as any, 400);
  }

  try {
    // Use Cloudflare Workers AI text-to-speech model
    const response = await c.env.AI.run('@cf/deepgram/aura-2-en', {
      text,
    });

    // Return the audio stream
    if (response) {
      return new Response(response as any, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=3600',
        },
      }) as any;
    }

    // Fallback if response is invalid
    return c.json({ error: 'Failed to generate audio' } as any, 500);
  } catch (error) {
    console.error('Audio generation error:', error);
    return c.json({
      error: 'Audio generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    } as any, 500);
  }
});

/**
 * GET /api/media/image
 *
 * Generates an image from a text prompt using Cloudflare Workers AI.
 * Query parameters:
 *   - prompt: The text prompt for image generation
 */
const getImageRoute = createRoute({
  method: 'get',
  path: '/image',
  request: {
    query: z.object({
      prompt: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'image/png': { schema: z.any() },
      },
      description: 'Image stream',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Missing required parameter: prompt',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string(), details: z.string().optional() }) },
      },
      description: 'Failed to generate image',
    },
  },
});

mediaRouter.openapi(getImageRoute, async (c) => {
  const prompt = c.req.query('prompt');

  if (!prompt) {
    return c.json({ error: 'Missing required parameter: prompt' } as any, 400);
  }

  try {
    // Use FormData/multipart approach required by Flux model
    const form = new FormData();
    form.append('prompt', prompt);
    const formResponse = new Response(form);

    const response = await c.env.AI.run('@cf/black-forest-labs/flux-2-klein-9b', {
      multipart: {
        body: formResponse.body!,
        contentType: formResponse.headers.get('content-type')!,
      },
    });

    // Return the image stream
    if (response instanceof ReadableStream) {
      return new Response(response, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Fallback if response is not a stream
    return c.json({ error: 'Failed to generate image' } as any, 500);
  } catch (error) {
    console.error('Image generation error:', error);
    return c.json({
      error: 'Image generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    } as any, 500);
  }
});

/**
 * GET /api/media/r2/{folder}/{filename}
 *
 * Streams media files from the configured R2 bucket.
 */
const getR2MediaRoute = createRoute({
  method: 'get',
  path: '/r2/{folder}/{filename}',
  request: {
    params: z.object({
      folder: z.string(),
      filename: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Media stream',
    },
    404: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Media not found',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string(), details: z.string().optional() }) },
      },
      description: 'Failed to stream media',
    },
  },
});

mediaRouter.openapi(getR2MediaRoute, async (c) => {
  const folder = c.req.param('folder');
  const filename = c.req.param('filename');
  const r2Key = `${folder}/${filename}`;

  try {
    const object = await c.env.R2_TRUMP_POLICY.get(r2Key);

    if (object === null) {
      return c.json({ error: 'Media file not found' } as any, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    // R2 get() handles range requests automatically if passed, 
    // but browser handles standard streaming from the body stream fine.
    return new Response(object.body as any, { headers });
  } catch (error) {
    console.error('R2 streaming error:', error);
    return c.json({
      error: 'Failed to stream media',
      details: error instanceof Error ? error.message : 'Unknown error'
    } as any, 500);
  }
});

export { mediaRouter };

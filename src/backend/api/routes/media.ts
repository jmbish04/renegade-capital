/**
 * @fileoverview Media generation routes for AI-powered audio and image creation
 *
 * Provides endpoints for generating text-to-speech audio and text-to-image artwork
 * using Cloudflare Workers AI models.
 */

import { Hono } from 'hono';
import type { Bindings } from '../index';

const mediaRouter = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/media/audio
 *
 * Generates text-to-speech audio using Cloudflare Workers AI.
 * Query parameters:
 *   - text: The text to convert to speech
 */
mediaRouter.get('/audio', async (c) => {
  const text = c.req.query('text');

  if (!text) {
    return c.json({ error: 'Missing required parameter: text' }, 400);
  }

  try {
    // Use Cloudflare Workers AI text-to-speech model
    const response = await c.env.AI.run('@cf/deepgram/aura-2-en', {
      text,
    });

    // Return the audio stream
    if (response instanceof ReadableStream) {
      return new Response(response, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Fallback if response is not a stream
    return c.json({ error: 'Failed to generate audio' }, 500);
  } catch (error) {
    console.error('Audio generation error:', error);
    return c.json({
      error: 'Audio generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/media/image
 *
 * Generates an image from a text prompt using Cloudflare Workers AI.
 * Query parameters:
 *   - prompt: The text prompt for image generation
 */
mediaRouter.get('/image', async (c) => {
  const prompt = c.req.query('prompt');

  if (!prompt) {
    return c.json({ error: 'Missing required parameter: prompt' }, 400);
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
    return c.json({ error: 'Failed to generate image' }, 500);
  } catch (error) {
    console.error('Image generation error:', error);
    return c.json({
      error: 'Image generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export { mediaRouter };

/**
 * @fileoverview Episodes API routes for the podcast platform.
 *
 * Provides endpoints for retrieving and searching podcast episodes.
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { episodes } from '../../db/schema';
import type { Bindings } from '../index';

const episodesRouter = new Hono<{ Bindings: Bindings }>();

/**
 * GET / - Get all episodes
 */
episodesRouter.get('/', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const allEpisodes = await db.select().from(episodes);

    return c.json({
      episodes: allEpisodes,
      total: allEpisodes.length,
    });
  } catch (error) {
    console.error('Error fetching episodes:', error);
    return c.json({
      error: 'Failed to fetch episodes',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /search - Search episodes by attribute
 * Query params: title, description
 */
episodesRouter.get('/search', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const searchTitle = c.req.query('title');
    const searchDescription = c.req.query('description');

    let results = await db.select().from(episodes);

    // Filter by title if provided
    if (searchTitle) {
      results = results.filter((episode) =>
        episode.title.toLowerCase().includes(searchTitle.toLowerCase())
      );
    }

    // Filter by description if provided
    if (searchDescription) {
      results = results.filter((episode) =>
        episode.description.toLowerCase().includes(searchDescription.toLowerCase())
      );
    }

    return c.json({
      episodes: results,
      total: results.length,
      query: {
        title: searchTitle,
        description: searchDescription,
      },
    });
  } catch (error) {
    console.error('Error searching episodes:', error);
    return c.json({
      error: 'Failed to search episodes',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /:id - Get a specific episode by ID
 */
episodesRouter.get('/:id', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const id = c.req.param('id');

    if (!id) {
      return c.json({ error: 'Invalid episode ID' }, 400);
    }

    const result = await db.select().from(episodes).where(eq(episodes.id, id));

    if (result.length === 0) {
      return c.json({ error: 'Episode not found' }, 404);
    }

    return c.json({ episode: result[0] });
  } catch (error) {
    console.error('Error fetching episode:', error);
    return c.json({
      error: 'Failed to fetch episode',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export { episodesRouter };

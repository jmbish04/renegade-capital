/**
 * @fileoverview Research API routes for the podcast platform.
 *
 * Provides endpoints for retrieving and searching research profiles.
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { research } from '../../db/schema';
import type { Bindings } from '../index';

const researchRouter = new Hono<{ Bindings: Bindings }>();

/**
 * GET / - Get all research profiles
 */
researchRouter.get('/', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const allResearch = await db.select().from(research);

    return c.json({
      research: allResearch,
      total: allResearch.length,
    });
  } catch (error) {
    console.error('Error fetching research:', error);
    return c.json({
      error: 'Failed to fetch research',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /search - Search research by attribute
 * Query params: name, domain, chemistry, topic
 */
researchRouter.get('/search', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const searchName = c.req.query('name');
    const searchDomain = c.req.query('domain');
    const searchChemistry = c.req.query('chemistry');
    const searchTopic = c.req.query('topic');

    let results = await db.select().from(research);

    // Filter by name if provided
    if (searchName) {
      results = results.filter((item) =>
        item.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    // Filter by domain if provided
    if (searchDomain) {
      results = results.filter((item) =>
        item.domain.toLowerCase().includes(searchDomain.toLowerCase())
      );
    }

    // Filter by chemistry if provided
    if (searchChemistry) {
      results = results.filter((item) =>
        item.chemistry.toLowerCase().includes(searchChemistry.toLowerCase())
      );
    }

    // Filter by topic if provided
    if (searchTopic) {
      results = results.filter((item) =>
        item.topic.toLowerCase().includes(searchTopic.toLowerCase())
      );
    }

    return c.json({
      research: results,
      total: results.length,
      query: {
        name: searchName,
        domain: searchDomain,
        chemistry: searchChemistry,
        topic: searchTopic,
      },
    });
  } catch (error) {
    console.error('Error searching research:', error);
    return c.json({
      error: 'Failed to search research',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /:id - Get a specific research profile by ID
 */
researchRouter.get('/:id', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const id = c.req.param('id');

    if (!id) {
      return c.json({ error: 'Invalid research ID' }, 400);
    }

    const result = await db.select().from(research).where(eq(research.id, id));

    if (result.length === 0) {
      return c.json({ error: 'Research profile not found' }, 404);
    }

    return c.json({ research: result[0] });
  } catch (error) {
    console.error('Error fetching research profile:', error);
    return c.json({
      error: 'Failed to fetch research profile',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export { researchRouter };

/**
 * @fileoverview Research API routes for the podcast platform.
 *
 * Provides endpoints for retrieving and searching research profiles.
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { research } from '../../db/schema';
import type { Bindings } from '../index';

const researchRouter = new OpenAPIHono<{ Bindings: Bindings }>();

/**
 * GET / - Get all research profiles
 */
const getResearchRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            research: z.array(z.any()),
            total: z.number(),
          }),
        },
      },
      description: 'Get all research profiles',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string(), details: z.string() }) },
      },
      description: 'Failed to fetch research',
    },
  },
});

researchRouter.openapi(getResearchRoute, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const allResearch = await db.select().from(research);

    // Parse JSON fields
    const parsedResearch = allResearch.map((item) => ({
      ...item,
      domain: JSON.parse(item.domain || '[]'),
      chemistry: JSON.parse(item.chemistry || '[]'),
    }));

    return c.json({
      research: parsedResearch,
      total: parsedResearch.length,
    } as any, 200);
  } catch (error) {
    console.error('Error fetching research:', error);
    return c.json({
      error: 'Failed to fetch research',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as any, 500);
  }
});

/**
 * GET /search - Search research by attribute
 * Query params: name, domain, chemistry, topic
 */
const searchResearchRoute = createRoute({
  method: 'get',
  path: '/search',
  request: {
    query: z.object({
      name: z.string().optional(),
      domain: z.string().optional(),
      chemistry: z.string().optional(),
      topic: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            research: z.array(z.any()),
            total: z.number(),
            query: z.object({
              name: z.string().optional(),
              domain: z.string().optional(),
              chemistry: z.string().optional(),
              topic: z.string().optional(),
            }),
          }),
        },
      },
      description: 'Search research',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string(), details: z.string() }) },
      },
      description: 'Failed to search research',
    },
  },
});

researchRouter.openapi(searchResearchRoute, async (c) => {
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
    } as any, 200);
  } catch (error) {
    console.error('Error searching research:', error);
    return c.json({
      error: 'Failed to search research',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as any, 500);
  }
});

/**
 * GET /:id - Get a specific research profile by ID
 */
const getResearchByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ research: z.any() }),
        },
      },
      description: 'Get research by ID',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Invalid research ID',
    },
    404: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Research profile not found',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string(), details: z.string() }) },
      },
      description: 'Failed to fetch research profile',
    },
  },
});

researchRouter.openapi(getResearchByIdRoute, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const id = c.req.param('id');

    if (!id) {
      return c.json({ error: 'Invalid research ID' } as any, 400);
    }

    const result = await db.select().from(research).where(eq(research.id, id));

    if (result.length === 0) {
      return c.json({ error: 'Research profile not found' } as any, 404);
    }

    return c.json({ research: result[0] } as any, 200);
  } catch (error) {
    console.error('Error fetching research profile:', error);
    return c.json({
      error: 'Failed to fetch research profile',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as any, 500);
  }
});

export { researchRouter };

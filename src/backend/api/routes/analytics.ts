/**
 * @fileoverview Analytics API routes for visitor tracking
 *
 * Provides endpoints for retrieving visitor analytics data
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { desc } from 'drizzle-orm';
import { visitorLogs } from '../../db/schema';
import type { Bindings } from '../index';

const analyticsRouter = new OpenAPIHono<{ Bindings: Bindings }>();

/**
 * GET /api/analytics
 *
 * Fetches the last 100 visitor log entries
 */
const getAnalyticsRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            visitors: z.array(z.any()),
            total: z.number(),
          }),
        },
      },
      description: 'Analytics data',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string(), details: z.string() }) },
      },
      description: 'Failed to fetch analytics',
    },
  },
});

analyticsRouter.openapi(getAnalyticsRoute, async (c) => {
  try {
    const db = drizzle(c.env.DB);

    const visitors = await db
      .select()
      .from(visitorLogs)
      .orderBy(desc(visitorLogs.createdAt))
      .limit(100);

    return c.json({
      visitors,
      total: visitors.length,
    } as any, 200);
  } catch (error) {
    console.error('Analytics fetch error:', error);
    return c.json({
      error: 'Failed to fetch analytics',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as any, 500);
  }
});

export { analyticsRouter };

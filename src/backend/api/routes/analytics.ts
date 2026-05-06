/**
 * @fileoverview Analytics API routes for visitor tracking
 *
 * Provides endpoints for retrieving visitor analytics data
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { desc } from 'drizzle-orm';
import { visitorLogs } from '../../db/schema';
import type { Bindings } from '../index';

const analyticsRouter = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/analytics
 *
 * Fetches the last 100 visitor log entries
 */
analyticsRouter.get('/', async (c) => {
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
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    return c.json({
      error: 'Failed to fetch analytics',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export { analyticsRouter };

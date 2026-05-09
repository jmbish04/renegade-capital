/**
 * @fileoverview Dashboard API routes
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq, and, gte } from 'drizzle-orm';
import { dashboardMetrics } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../index';

const dashboardRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// Apply auth middleware to all routes
dashboardRouter.use('*', authMiddleware);

// GET /api/dashboard/metrics
const getMetricsRoute = createRoute({
  method: 'get',
  path: '/metrics',
  request: {
    query: z.object({
      category: z.string().optional(),
      limit: z.string().optional().default('100'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            metrics: z.array(z.any()),
            grouped: z.record(z.string(), z.array(z.any())),
            total: z.number(),
          }),
        },
      },
      description: 'Dashboard metrics',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Failed to fetch metrics',
    },
  },
});

dashboardRouter.openapi(getMetricsRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const category = c.req.query('category');
  const limit = parseInt(c.req.query('limit') || '100');

  try {
    let query = db.select().from(dashboardMetrics).$dynamic();

    if (category) {
      query = query.where(eq(dashboardMetrics.category, category));
    }

    const metrics = await query
      .orderBy(desc(dashboardMetrics.timestamp))
      .limit(limit);

    // Group metrics by category
    const grouped = metrics.reduce((acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = [];
      }
      acc[metric.category].push(metric);
      return acc;
    }, {} as Record<string, typeof metrics>);

    return c.json({
      metrics,
      grouped,
      total: metrics.length,
    } as any, 200);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return c.json({ error: 'Failed to fetch metrics' } as any, 500);
  }
});

// GET /api/dashboard/summary
const getSummaryRoute = createRoute({
  method: 'get',
  path: '/summary',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            summary: z.array(z.any()),
          }),
        },
      },
      description: 'Dashboard summary',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Failed to fetch summary',
    },
  },
});

// dashboardRouter.openapi(getSummaryRoute, async (c) => {
//   const db = drizzle(c.env.DB);

//   try {
//     // Get latest metrics for each category
//     const allMetrics = await db
//       .select()
//       .from(dashboardMetrics)
//       .orderBy(desc(dashboardMetrics.timestamp))
//       .limit(1000);

//     // Get the most recent metric for each metric name
//     const latestMetrics = allMetrics.reduce((acc, metric) => {
//       if (!acc[metric.metricName] || new Date(metric.timestamp) > new Date(acc[metric.metricName].timestamp)) {
//         acc[metric.metricName] = metric;
//       }
//       return acc;
//     }, {} as Record<string, typeof allMetrics[0]>);

//     return c.json({
//       summary: Object.values(latestMetrics),
//     } as any, 200);
//   } catch (error) {
//     console.error('Error fetching dashboard summary:', error);
//     return c.json({ error: 'Failed to fetch summary' } as any, 500);
//   }
// } as unknown as any);

// GET /api/dashboard/charts/:category
const getChartsRoute = createRoute({
  method: 'get',
  path: '/charts/{category}',
  request: {
    params: z.object({
      category: z.string(),
    }),
    query: z.object({
      days: z.string().optional().default('7'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(z.object({
              timestamp: z.number(),
              value: z.number().nullable(),
              name: z.string(),
              type: z.string(),
            })),
          }),
        },
      },
      description: 'Dashboard chart data',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Failed to fetch chart data',
    },
  },
});

dashboardRouter.openapi(getChartsRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const category = c.req.param('category');
  const days = parseInt(c.req.query('days') || '7');

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const metrics = await db
      .select()
      .from(dashboardMetrics)
      .where(
        and(
          eq(dashboardMetrics.category, category),
          gte(dashboardMetrics.timestamp, startDate)
        )
      )
      .orderBy(desc(dashboardMetrics.timestamp));

    // Format data for charts
    const chartData = metrics.map((m) => ({
      timestamp: m.timestamp,
      value: m.metricValue,
      name: m.metricName,
      type: m.metricType,
    }));

    return c.json({ data: chartData } as any, 200);
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return c.json({ error: 'Failed to fetch chart data' } as any, 500);
  }
});

export { dashboardRouter };

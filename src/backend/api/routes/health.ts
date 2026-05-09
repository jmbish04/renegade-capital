/**
 * @fileoverview Health monitoring API routes
 *
 * Exposes the HealthCoordinator to the frontend, allowing retrieval
 * of the latest health run and manual triggering of a new run.
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Bindings } from '../index';
import { HealthCoordinator } from '../../health/coordinator';

const healthRouter = new OpenAPIHono<{ Bindings: Bindings }>();

const getHealthRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            run: z.any().nullable(),
            results: z.array(z.any()).optional(),
          }),
        },
      },
      description: 'Latest system health check run',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Failed to fetch health check',
    },
  },
});

healthRouter.openapi(getHealthRoute, async (c) => {
  try {
    const coord = new HealthCoordinator(c.env as any);
    const latest = await coord.getLatestRun();
    
    if (!latest) {
      return c.json({ run: null, results: [] } as any, 200);
    }
    
    return c.json(latest as any, 200);
  } catch (error: any) {
    console.error('Health check GET error:', error);
    return c.json({ error: 'Failed to fetch health results' } as any, 500);
  }
});

const runHealthRoute = createRoute({
  method: 'post',
  path: '/run',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            runId: z.string(),
            status: z.string(),
            results: z.array(z.any()),
            durationMs: z.number(),
          }),
        },
      },
      description: 'Execute new system health check run',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Failed to execute health check',
    },
  },
});

healthRouter.openapi(runHealthRoute, async (c) => {
  try {
    const coord = new HealthCoordinator(c.env as any);
    const run = await coord.runAllChecks("api");
    return c.json(run as any, 200);
  } catch (error: any) {
    console.error('Health check POST error:', error);
    return c.json({ error: 'Failed to execute health run' } as any, 500);
  }
});

export { healthRouter };

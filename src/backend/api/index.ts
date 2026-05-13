/**
 * @fileoverview Main Hono API router
 *
 * This file sets up the main Hono application with all API routes and middleware.
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
// import type { D1Database, Ai } from '@cloudflare/workers-types';
import { authRouter } from './routes/auth';
import { chatRouter } from './routes/chat';
import { dashboardRouter } from './routes/dashboard';
import { threadsRouter } from './routes/threads';
import { healthRouter } from './routes/health';
import { aiRouter } from './routes/ai';

import { clashRouter } from "./routes/clash";
import { mediaRouter } from './routes/media';
import { analyticsRouter } from './routes/analytics';
import { guestsRouter } from './routes/guests';
import { hostsRouter } from './routes/hosts';
import { episodesRouter } from './routes/episodes';
import { researchRouter } from './routes/research';
import { policyRouter } from './routes/policy';
import { vectorizeRouter } from './routes/vectorize';
import { visitorLogs } from '../db/schema';
import { drizzle } from 'drizzle-orm/d1';

export type Bindings = Env;

export type Variables = {
  userId?: number;
  user?: {
    id: number;
    email: string;
    name: string;
  };
};

const app = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

// Middleware
app.use('*', cors() as any);
app.use('*', logger() as any);

// Visitor tracking middleware
app.use('*', async (c, next) => {
  // Skip tracking for API endpoints and static assets
  if (c.req.path.startsWith('/api/') || c.req.path.includes('.')) {
    return next();
  }

  // Track visitor asynchronously
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const db = drizzle(c.env.DB);
        const cf = c.req.raw.cf as any;

        await db.insert(visitorLogs).values({
          ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'unknown',
          country: cf?.country || null,
          city: cf?.city || null,
          userAgent: c.req.header('user-agent') || null,
          path: c.req.path,
        });
      } catch (err) {
        console.error('Failed to log visitor:', err);
      }
    })()
  );

  return next();
});

// Health check route definition
const pingRoute = createRoute({
  method: 'get',
  path: '/api/ping',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            timestamp: z.number(),
          }),
        },
      },
      description: 'API liveness ping',
    },
  },
});

app.openapi(pingRoute, (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// Context endpoint route definition
const contextRoute = createRoute({
  method: 'get',
  path: '/context',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            platform: z.string(),
            version: z.string(),
            agents: z.array(z.string()),
            description: z.string(),
          }),
        },
      },
      description: 'Platform context',
    },
  },
});

app.openapi(contextRoute, (c) =>
  c.json({
    platform: 'Renegade Capital',
    version: '1.0.0',
    agents: ['SocialJusticeInvestorAgent', 'PodcastGuestAgent'],
    description:
      'A multi-agent platform aligning personal wealth with social justice and exploring the ethical frontiers of AI.',
  })
);

// Mount routers
app.route('/api/chat', chatRouter);
app.route('/api/auth', authRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/threads', threadsRouter);
app.route('/api/health', healthRouter);
app.route('/api/ai', aiRouter);
app.route('/api/clash', clashRouter);
app.route('/api/media', mediaRouter);
app.route('/api/analytics', analyticsRouter);
app.route('/api/guests', guestsRouter);
app.route('/api/hosts', hostsRouter);
app.route('/api/episodes', episodesRouter);
app.route('/api/research', researchRouter);
app.route('/api/policy', policyRouter);
app.route('/api/vectorize', vectorizeRouter);
import { setupOpenAPI } from './routes/openapi';

// Set up dynamic OpenAPI JSON, Swagger UI, and Scalar UI
setupOpenAPI(app);

export { app };

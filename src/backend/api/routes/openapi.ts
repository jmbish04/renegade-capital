/**
 * @fileoverview OpenAPI documentation routes — dynamic spec generation
 *
 * Generates /openapi.json dynamically from registered OpenAPIHono routes,
 * and seamlessly injects Cloudflare Agents SDK Durable Object endpoints.
 * Serves Swagger UI at /swagger and Scalar at /scalar.
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { apiReference } from '@scalar/hono-api-reference';
import { getAgentConfigs } from '../../ai/agents';
import type { Bindings, Variables } from '../index';

export function setupOpenAPI(app: OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>) {
  // GET /openapi.json — automatically crawls all Zod OpenAPI routes
  app.get('/openapi.json', async (c) => {
    // Generate the base Zod OpenAPI document
    const spec = app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: {
        title: 'Renegade Capital API',
        version: '2.0.0',
        description:
          'Multi-agent platform aligning personal wealth with social justice. Powered by Cloudflare Workers AI, Vectorize, D1, and R2.',
      },
      servers: [{ url: new URL(c.req.url).origin, description: 'API Server' }],
    });

    // Ensure paths object exists
    spec.paths = spec.paths || {};

    // Dynamically inject Cloudflare Agents SDK DO routes
    const agentConfigs = getAgentConfigs(c.env);
    for (const [agentId, config] of Object.entries(agentConfigs)) {
      spec.paths[`/agents/${agentId}`] = {
        post: {
          summary: `${config.name} (streaming)`,
          description: `Connect to the ${config.name} Durable Object using the Cloudflare Agents SDK. Expects a stream or SSE depending on the SDK client.`,
          tags: ['Chat Agents'],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    messages: { type: 'array', items: { type: 'object' } },
                  },
                  required: ['messages'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Streaming text response',
            },
          },
        },
      };
    }

    return c.json(spec);
  });

  // GET /swagger
  app.get('/swagger', swaggerUI({ url: '/openapi.json' }));

  // GET /scalar
  app.get(
    '/scalar',
    apiReference({
      theme: 'solarized',
      url: '/openapi.json',
    } as any)
  );

  // Redirect /docs to /scalar
  app.get('/docs', (c) => c.redirect('/scalar'));
}

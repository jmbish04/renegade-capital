/**
 * @fileoverview Worker entry point — routes requests to Hono API, Agents SDK DOs, or static assets.
 *
 * Exports:
 *   - PolicyChatAgent: Durable Object class for the Policy page AI chat (AIChatAgent).
 *     Must be exported at the top level for wrangler to register the DO binding.
 *
 * Routing priority:
 *   1. /agents/* → routeAgentRequest (WebSocket upgrade for DO connections)
 *   2. /api/*, /health, /context, /swagger, /scalar, /openapi.json → Hono
 *   3. Everything else → env.ASSETS.fetch (Astro SSG static files)
 */

import { app } from './backend/api/index';
import { routeAgentRequest } from 'agents';
import { HealthCoordinator } from './backend/health/coordinator';

// ─── Durable Object Exports ─────────────────────────────────────────────────────
// Wrangler requires DO classes to be exported from the main entry point.
export { PolicyAgent } from './backend/ai/agents/PolicyAgent';
export { PodcastAgent } from './backend/ai/agents/PodcastAgent';
export { InvestorAgent } from './backend/ai/agents/InvestorAgent';

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Route Agents SDK WebSocket/HTTP requests to Durable Objects
    if (url.pathname.startsWith('/agents/')) {
      const agentResponse = await routeAgentRequest(request, env);
      if (agentResponse) return agentResponse;
    }

    // Forward specific backend routes to Hono
    if (
      url.pathname.startsWith('/api') ||
      url.pathname.startsWith('/context') ||
      url.pathname.startsWith('/swagger') ||
      url.pathname.startsWith('/scalar') ||
      url.pathname === '/openapi.json'
    ) {
      return app.fetch(request, env, ctx);
    }

    // Intercept dynamic episode URLs (/episodes/[id]) and serve the detail template
    // We explicitly exclude /episodes/ (the index page)
    const urlPath = url.pathname;
    if (urlPath.startsWith('/episodes/') && urlPath !== '/episodes/') {
      const newUrl = new URL(request.url);
      newUrl.pathname = '/episodes/detail/';
      const newRequest = new Request(newUrl, request);
      return env.ASSETS.fetch(newRequest);
    }

    // Serve static frontend assets for everything else
    return env.ASSETS.fetch(request);
  },

  /**
   * Cron-triggered health check runner.
   * Configured in wrangler.jsonc to run every 4 hours.
   * Persists results to D1 for the Navbar badge and /health page.
   */
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    if (event.cron === '0 0 */4 * *') {
      const coord = new HealthCoordinator(env);
      ctx.waitUntil(coord.runAllChecks('scheduled'));
    }
  },
};
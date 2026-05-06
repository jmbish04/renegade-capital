import { app } from '../../../backend/api/index';
import type { APIRoute } from 'astro';

const handleRequest: APIRoute = ({ request, locals }) => {
  // Astro exposes the Cloudflare environment variables and execution context via locals.runtime
  const runtime = (locals as any).runtime;
  
  return app.fetch(
    request, 
    runtime?.env || {}, 
    runtime?.ctx || {}
  );
};

export const ALL = handleRequest;

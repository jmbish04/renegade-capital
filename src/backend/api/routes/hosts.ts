import { OpenAPIHono } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { hosts } from '../../db/schema';
import type { Bindings } from '../index';

export const hostsRouter = new OpenAPIHono<{ Bindings: Bindings }>();

hostsRouter.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const allHosts = await db.select().from(hosts);
  return c.json({ hosts: allHosts } as any, 200);
});

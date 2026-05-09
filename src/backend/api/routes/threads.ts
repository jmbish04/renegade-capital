/**
 * @fileoverview Threads API routes for AI assistant conversations
 */

import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq } from 'drizzle-orm';
import { threads, messages } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../index';

const threadsRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// Apply auth middleware
threadsRouter.use('*', authMiddleware);

const createThreadSchema = z.object({
  title: z.string().min(1),
});

const createMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  metadata: z.string().optional(),
});

// GET /api/threads
const getThreadsRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            threads: z.array(z.any()),
          }),
        },
      },
      description: 'Get all threads for the user',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to fetch threads',
    },
  },
});

// @ts-ignore
threadsRouter.openapi(getThreadsRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;

  try {
    const userThreads = await db
      .select()
      .from(threads)
      .where(eq(threads.userId, userId))
      .orderBy(desc(threads.updatedAt));

    return c.json({ threads: userThreads } as any, 200);
  } catch (error) {
    console.error('Error fetching threads:', error);
    return c.json({ error: 'Failed to fetch threads' } as any, 500);
  }
});

// POST /api/threads
const createThreadRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createThreadSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            thread: z.any(),
          }),
        },
      },
      description: 'Thread created',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to create thread',
    },
  },
});

threadsRouter.openapi(createThreadRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;
  const { title } = c.req.valid('json');

  try {
    const result = await db
      .insert(threads)
      .values({
        userId,
        title,
      })
      .returning();

    return c.json({ thread: result[0] } as any, 201);
  } catch (error) {
    console.error('Error creating thread:', error);
    return c.json({ error: 'Failed to create thread' } as any, 500);
  }
});

// GET /api/threads/:id
const getThreadByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            thread: z.any(),
          }),
        },
      },
      description: 'Get thread details',
    },
    403: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Unauthorized',
    },
    404: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Thread not found',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to fetch thread',
    },
  },
});

threadsRouter.openapi(getThreadByIdRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;
  const threadId = parseInt(c.req.param('id'));

  try {
    const threadResult = await db
      .select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .limit(1);

    if (threadResult.length === 0) {
      return c.json({ error: 'Thread not found' } as any, 404);
    }

    const thread = threadResult[0];

    if (thread.userId !== userId) {
      return c.json({ error: 'Unauthorized' } as any, 403);
    }

    return c.json({ thread } as any, 200);
  } catch (error) {
    console.error('Error fetching thread:', error);
    return c.json({ error: 'Failed to fetch thread' } as any, 500);
  }
});

// GET /api/threads/:id/messages
const getThreadMessagesRoute = createRoute({
  method: 'get',
  path: '/{id}/messages',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            messages: z.array(z.any()),
          }),
        },
      },
      description: 'Get thread messages',
    },
    404: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Thread not found',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to fetch messages',
    },
  },
});

// @ts-ignore
threadsRouter.openapi(getThreadMessagesRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;
  const threadId = parseInt(c.req.param('id'));

  try {
    // Verify thread ownership
    const threadResult = await db
      .select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .limit(1);

    if (threadResult.length === 0 || threadResult[0].userId !== userId) {
      return c.json({ error: 'Thread not found' } as any, 404);
    }

    const threadMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(messages.createdAt);

    return c.json({ messages: threadMessages } as any, 200);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return c.json({ error: 'Failed to fetch messages' } as any, 500);
  }
});

// POST /api/threads/:id/messages
const createMessageRoute = createRoute({
  method: 'post',
  path: '/{id}/messages',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: createMessageSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.any(),
          }),
        },
      },
      description: 'Message created',
    },
    404: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Thread not found',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to create message',
    },
  },
});

threadsRouter.openapi(createMessageRoute, async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get('userId')!;
    const threadId = parseInt(c.req.param('id'));
    const { role, content, metadata } = c.req.valid('json');

    try {
      // Verify thread ownership
      const threadResult = await db
        .select()
        .from(threads)
        .where(eq(threads.id, threadId))
        .limit(1);

      if (threadResult.length === 0 || threadResult[0].userId !== userId) {
        return c.json({ error: 'Thread not found' } as any, 404);
      }

      // Create message
      const result = await db
        .insert(messages)
        .values({
          threadId,
          role,
          content,
          metadata,
        })
        .returning();

      // Update thread's updatedAt
      await db
        .update(threads)
        .set({ updatedAt: new Date() })
        .where(eq(threads.id, threadId));

      return c.json({ message: result[0] } as any, 201);
    } catch (error) {
      console.error('Error creating message:', error);
      return c.json({ error: 'Failed to create message' } as any, 500);
    }
  }
);

// DELETE /api/threads/:id
const deleteThreadRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
      description: 'Thread deleted',
    },
    404: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Thread not found',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to delete thread',
    },
  },
});

threadsRouter.openapi(deleteThreadRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;
  const threadId = parseInt(c.req.param('id'));

  try {
    // Verify thread ownership
    const threadResult = await db
      .select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .limit(1);

    if (threadResult.length === 0 || threadResult[0].userId !== userId) {
      return c.json({ error: 'Thread not found' } as any, 404);
    }

    // Delete thread (messages will cascade delete)
    await db.delete(threads).where(eq(threads.id, threadId));

    return c.json({ message: 'Thread deleted successfully' } as any, 200);
  } catch (error) {
    console.error('Error deleting thread:', error);
    return c.json({ error: 'Failed to delete thread' } as any, 500);
  }
});

export { threadsRouter };

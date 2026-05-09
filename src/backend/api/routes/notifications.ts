/**
 * @fileoverview Notifications API routes
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq, and } from 'drizzle-orm';
import { notifications } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../index';

const notificationsRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// Apply auth middleware
notificationsRouter.use('*', authMiddleware);

// GET /api/notifications
const getNotificationsRoute = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: z.object({
      unreadOnly: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            notifications: z.array(z.any()),
            unreadCount: z.number(),
          }),
        },
      },
      description: 'Get notifications',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to fetch notifications',
    },
  },
});

// @ts-ignore
notificationsRouter.openapi(getNotificationsRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;
  const unreadOnly = c.req.query('unreadOnly') === 'true';

  try {
    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .$dynamic();

    if (unreadOnly) {
      query = query.where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
    }

    const userNotifications = await query
      .orderBy(desc(notifications.createdAt))
      .limit(100);

    const unreadCount = userNotifications.filter((n) => !n.isRead).length;

    return c.json({
      notifications: userNotifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return c.json({ error: 'Failed to fetch notifications' } as any, 500);
  }
});

// PUT /api/notifications/:id/read
const readNotificationRoute = createRoute({
  method: 'put',
  path: '/{id}/read',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.object({ message: z.string() }) },
      },
      description: 'Notification marked as read',
    },
    404: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Notification not found',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to update notification',
    },
  },
});

// @ts-ignore
notificationsRouter.openapi(readNotificationRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;
  const notificationId = parseInt(c.req.param('id'));

  try {
    // Verify ownership
    const notif = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (notif.length === 0 || notif[0].userId !== userId) {
      return c.json({ error: 'Notification not found' } as any, 404);
    }

    // Mark as read
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));

    return c.json({ message: 'Notification marked as read' } as any);
  } catch (error) {
    console.error('Error updating notification:', error);
    return c.json({ error: 'Failed to update notification' } as any, 500);
  }
});

// PUT /api/notifications/read-all
const readAllNotificationsRoute = createRoute({
  method: 'put',
  path: '/read-all',
  responses: {
    200: {
      content: {
        'application/json': { schema: z.object({ message: z.string() }) },
      },
      description: 'All notifications marked as read',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to update notifications',
    },
  },
});

// @ts-ignore
notificationsRouter.openapi(readAllNotificationsRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;

  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );

    return c.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error updating notifications:', error);
    return c.json({ error: 'Failed to update notifications' }, 500);
  }
});

export { notificationsRouter };

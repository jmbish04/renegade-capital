/**
 * @fileoverview Authentication API routes
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users, sessions } from '../../db/schema';
import type { Bindings } from '../index';

const authRouter = new OpenAPIHono<{ Bindings: Bindings }>();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

const userResponseSchema = z.object({
  user: z.object({
    id: z.number(),
    email: z.string(),
    name: z.string(),
  }),
  token: z.string(),
  expiresAt: z.string(),
});

// Simple password hashing (in production, use a proper library)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  request: {
    body: {
      content: { 'application/json': { schema: registerSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: userResponseSchema } },
      description: 'Registration successful',
    },
    400: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'User already exists',
    },
    500: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Registration failed',
    },
  },
});

authRouter.openapi(registerRoute, async (c) => {
  const { email, password, name } = c.req.valid('json');
  const db = drizzle(c.env.DB);

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return c.json({ error: 'User already exists' } as any, 400);
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const result = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
      })
      .returning();

    const user = result[0];

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt,
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
      expiresAt: expiresAt.toISOString(),
    } as any, 200);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' } as any, 500);
  }
});

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  request: {
    body: {
      content: { 'application/json': { schema: loginSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: userResponseSchema } },
      description: 'Login successful',
    },
    401: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Invalid credentials',
    },
    500: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Login failed',
    },
  },
});

authRouter.openapi(loginRoute, async (c) => {
  const { email, password } = c.req.valid('json');
  const db = drizzle(c.env.DB);

  try {
    // Find user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userResult.length === 0) {
      return c.json({ error: 'Invalid credentials' } as any, 401);
    }

    const user = userResult[0];

    // Verify password
    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.passwordHash) {
      return c.json({ error: 'Invalid credentials' } as any, 401);
    }

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt,
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
      expiresAt: expiresAt.toISOString(),
    } as any, 200);
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' } as any, 500);
  }
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ message: z.string() }) } },
      description: 'Logout successful',
    },
    400: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'No token provided',
    },
    500: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Logout failed',
    },
  },
});

authRouter.openapi(logoutRoute, async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' } as any, 400);
  }

  const token = authHeader.substring(7);
  const db = drizzle(c.env.DB);

  try {
    await db.delete(sessions).where(eq(sessions.token, token));
    return c.json({ message: 'Logged out successfully' } as any, 200);
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ error: 'Logout failed' } as any, 500);
  }
});

export { authRouter };

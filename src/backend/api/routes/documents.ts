/**
 * @fileoverview Documents API routes for PlateJS integration
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq } from 'drizzle-orm';
import { documents } from '../../db/schema';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../index';

const documentsRouter = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// Apply auth middleware
documentsRouter.use('*', authMiddleware);

const createDocumentSchema = z.object({
  title: z.string().min(1),
  content: z.string(), // JSON string of Slate nodes
});

const documentResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  title: z.string(),
  content: z.string(),
  createdAt: z.any(),
  updatedAt: z.any(),
});

// GET /api/documents
const getDocumentsRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            documents: z.array(documentResponseSchema),
          }),
        },
      },
      description: 'List user documents',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Failed to fetch documents',
    },
  },
});

documentsRouter.openapi(getDocumentsRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;

  try {
    const userDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.updatedAt));

    return c.json({ documents: userDocuments } as any, 200);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return c.json({ error: 'Failed to fetch documents' } as any, 500);
  }
});

// POST /api/documents
const createDocumentRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createDocumentSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({ document: documentResponseSchema }),
        },
      },
      description: 'Document created',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Failed to create document',
    },
  },
});

documentsRouter.openapi(createDocumentRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;
  const { title, content } = c.req.valid('json');

  try {
    const result = await db
      .insert(documents)
      .values({
        userId,
        title,
        content,
      })
      .returning();

    return c.json({ document: result[0] }, 201);
  } catch (error) {
    console.error('Error creating document:', error);
    return c.json({ error: 'Failed to create document' }, 500);
  }
});

// GET /api/documents/:id
const getDocumentRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ document: documentResponseSchema }),
        },
      },
      description: 'Get document',
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Unauthorized',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Document not found',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Failed to fetch document',
    },
  },
});

documentsRouter.openapi(getDocumentRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;
  const documentId = parseInt(c.req.param('id'));

  try {
    const documentResult = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (documentResult.length === 0) {
      return c.json({ error: 'Document not found' }, 404);
    }

    const document = documentResult[0];

    if (document.userId !== userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    return c.json({ document } as any, 200);
  } catch (error) {
    console.error('Error fetching document:', error);
    return c.json({ error: 'Failed to fetch document' }, 500);
  }
});

// PUT /api/documents/:id
const updateDocumentRoute = createRoute({
  method: 'put',
  path: '/{id}',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': { schema: createDocumentSchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ document: documentResponseSchema }),
        },
      },
      description: 'Update document',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Document not found',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Failed to update document',
    },
  },
});

documentsRouter.openapi(updateDocumentRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;
  const documentId = parseInt(c.req.param('id'));
  const { title, content } = c.req.valid('json');

  try {
    // Verify ownership
    const documentResult = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (documentResult.length === 0 || documentResult[0].userId !== userId) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Update document
    const result = await db
      .update(documents)
      .set({
        title,
        content,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();

    return c.json({ document: result[0] } as any, 200);
  } catch (error) {
    console.error('Error updating document:', error);
    return c.json({ error: 'Failed to update document' } as any, 500);
  }
});

// DELETE /api/documents/:id
const deleteDocumentRoute = createRoute({
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
      description: 'Delete document',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Document not found',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Failed to delete document',
    },
  },
});

documentsRouter.openapi(deleteDocumentRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId')!;
  const documentId = parseInt(c.req.param('id'));

  try {
    // Verify ownership
    const documentResult = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (documentResult.length === 0 || documentResult[0].userId !== userId) {
      return c.json({ error: 'Document not found' }, 404);
    }

    await db.delete(documents).where(eq(documents.id, documentId));

    return c.json({ message: 'Document deleted successfully' } as any, 200);
  } catch (error) {
    console.error('Error deleting document:', error);
    return c.json({ error: 'Failed to delete document' } as any, 500);
  }
});

export { documentsRouter };

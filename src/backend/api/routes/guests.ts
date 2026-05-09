/**
 * @fileoverview Guest API routes for the podcast platform.
 *
 * Provides endpoints for retrieving and searching podcast guests.
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { eq, like, or, isNull, notInArray } from 'drizzle-orm';
import { guests } from '../../db/schema';
import type { Bindings } from '../index';

const guestsRouter = new OpenAPIHono<{ Bindings: Bindings }>();

const guestSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  organization: z.string().nullable(),
  bio: z.string().nullable(),
  expertise: z.any(),
  chemistry: z.any(),
  domain: z.any(),
  podcastFitRationale: z.string().nullable(),
  sex: z.string().nullable(),
  profileImageBase64: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  twitterUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

const getGuestsRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            guests: z.array(guestSchema),
            total: z.number(),
          }),
        },
      },
      description: 'List of guests',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            details: z.string(),
          }),
        },
      },
      description: 'Failed to fetch guests',
    },
  },
});

guestsRouter.openapi(getGuestsRoute, async (c) => {
  try {
    const db = drizzle(c.env.DB);

    const allGuests = await db.select().from(guests);

    // Parse JSON fields
    const parsedGuests = allGuests.map((guest) => ({
      ...guest,
      expertise: JSON.parse(guest.expertise),
      chemistry: JSON.parse(guest.chemistry),
      domain: JSON.parse(guest.domain),
    }));

    return c.json({
      guests: parsedGuests,
      total: parsedGuests.length,
    } as any, 200);
  } catch (error) {
    console.error('Error fetching guests:', error);
    return c.json({
      error: 'Failed to fetch guests',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as any, 500);
  }
});

const searchGuestsRoute = createRoute({
  method: 'get',
  path: '/search',
  request: {
    query: z.object({
      name: z.string().optional(),
      domain: z.string().optional(),
      chemistry: z.string().optional(),
      expertise: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            guests: z.array(guestSchema),
            total: z.number(),
            query: z.object({
              name: z.string().optional(),
              domain: z.string().optional(),
              chemistry: z.string().optional(),
              expertise: z.string().optional(),
            }),
          }),
        },
      },
      description: 'Search guests results',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            details: z.string(),
          }),
        },
      },
      description: 'Failed to search guests',
    },
  },
});

guestsRouter.openapi(searchGuestsRoute, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const searchName = c.req.query('name');
    const searchDomain = c.req.query('domain');
    const searchChemistry = c.req.query('chemistry');
    const searchExpertise = c.req.query('expertise');

    let results = await db.select().from(guests);

    // Filter by name if provided
    if (searchName) {
      results = results.filter((guest) =>
        guest.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    // Parse JSON fields and filter
    const parsedResults = results.map((guest) => ({
      ...guest,
      expertise: JSON.parse(guest.expertise),
      chemistry: JSON.parse(guest.chemistry),
      domain: JSON.parse(guest.domain),
    }));

    // Filter by domain if provided
    let filteredResults = parsedResults;
    if (searchDomain) {
      filteredResults = filteredResults.filter((guest) =>
        guest.domain.some((d: string) =>
          d.toLowerCase().includes(searchDomain.toLowerCase())
        )
      );
    }

    // Filter by chemistry if provided
    if (searchChemistry) {
      filteredResults = filteredResults.filter((guest) =>
        guest.chemistry.some((c: string) =>
          c.toLowerCase().includes(searchChemistry.toLowerCase())
        )
      );
    }

    // Filter by expertise if provided
    if (searchExpertise) {
      filteredResults = filteredResults.filter((guest) =>
        guest.expertise.some((e: string) =>
          e.toLowerCase().includes(searchExpertise.toLowerCase())
        )
      );
    }

    return c.json({
      guests: filteredResults,
      total: filteredResults.length,
      query: {
        name: searchName,
        domain: searchDomain,
        chemistry: searchChemistry,
        expertise: searchExpertise,
      },
    } as any, 200);
  } catch (error) {
    console.error('Error searching guests:', error);
    return c.json({
      error: 'Failed to search guests',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as any, 500);
  }
});

const getGuestByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            guest: guestSchema,
          }),
        },
      },
      description: 'Guest details',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Invalid guest ID',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Guest not found',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            details: z.string(),
          }),
        },
      },
      description: 'Failed to fetch guest',
    },
  },
});

guestsRouter.openapi(getGuestByIdRoute, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const id = c.req.param('id');

    if (!id) {
      return c.json({ error: 'Invalid guest ID' } as any, 400);
    }

    const result = await db.select().from(guests).where(eq(guests.id, id));

    if (result.length === 0) {
      return c.json({ error: 'Guest not found' } as any, 404);
    }

    const guest = result[0];

    // Parse JSON fields
    const parsedGuest = {
      ...guest,
      expertise: JSON.parse(guest.expertise),
      chemistry: JSON.parse(guest.chemistry),
      domain: JSON.parse(guest.domain),
    };

    return c.json({ guest: parsedGuest } as any, 200);
  } catch (error) {
    console.error('Error fetching guest:', error);
    return c.json({
      error: 'Failed to fetch guest',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as any, 500);
  }
});

const updateGuestRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            podcastFitRationale: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean(), id: z.string() }),
        },
      },
      description: 'Guest updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Invalid request',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            details: z.string(),
          }),
        },
      },
      description: 'Failed to update guest',
    },
  },
});

guestsRouter.openapi(updateGuestRoute, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const id = c.req.param('id');
    const body = await c.req.json();

    if (!id) {
      return c.json({ error: 'Invalid guest ID' } as any, 400);
    }

    const updates: any = {};
    if (body.podcastFitRationale !== undefined) {
      updates.podcastFitRationale = body.podcastFitRationale;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No valid fields to update' } as any, 400);
    }

    await db.update(guests).set(updates).where(eq(guests.id, id));

    return c.json({ success: true, id } as any, 200);
  } catch (error) {
    console.error('Error updating guest:', error);
    return c.json({
      error: 'Failed to update guest',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as any, 500);
  }
});

const getMissingSexRoute = createRoute({
  method: 'get',
  path: '/missing-sex',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            guests: z.array(guestSchema),
            total: z.number(),
          }),
        },
      },
      description: 'Guests missing sex property',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string(), details: z.string() }),
        },
      },
      description: 'Failed to fetch',
    },
  },
});

guestsRouter.openapi(getMissingSexRoute, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    // null or empty
    const results = await db.select().from(guests).where(
      notInArray(guests.sex, ["M", "F", "Other"])
    );

    const parsedResults = results.map((guest) => ({
      ...guest,
      expertise: JSON.parse(guest.expertise),
      chemistry: JSON.parse(guest.chemistry),
      domain: JSON.parse(guest.domain),
    }));

    return c.json({ guests: parsedResults, total: parsedResults.length } as any, 200);
  } catch (error) {
    console.error('Error fetching guests missing sex:', error);
    return c.json({
      error: 'Failed to fetch guests',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as any, 500);
  }
});

const bulkUpdateSexRoute = createRoute({
  method: 'post',
  path: '/bulk-update-sex',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            updates: z.array(z.object({
              id: z.string(),
              sex: z.string()
            })),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean(), count: z.number() }),
        },
      },
      description: 'Guests updated successfully',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string(), details: z.string() }),
        },
      },
      description: 'Failed to update guests',
    },
  },
});

guestsRouter.openapi(bulkUpdateSexRoute, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const body = await c.req.json();
    
    let count = 0;
    for (const update of body.updates) {
      await db.update(guests).set({ sex: update.sex }).where(eq(guests.id, update.id));
      count++;
    }

    return c.json({ success: true, count } as any, 200);
  } catch (error) {
    console.error('Error bulk updating sex:', error);
    return c.json({
      error: 'Failed to update guests',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as any, 500);
  }
});

export { guestsRouter };

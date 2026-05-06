/**
 * @fileoverview Guest API routes for the podcast platform.
 *
 * Provides endpoints for retrieving and searching podcast guests.
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, like, or } from 'drizzle-orm';
import { guests } from '../../db/schema';
import type { Bindings } from '../index';

const guestsRouter = new Hono<{ Bindings: Bindings }>();

/**
 * GET / - Get all guests
 */
guestsRouter.get('/', async (c) => {
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
    });
  } catch (error) {
    console.error('Error fetching guests:', error);
    return c.json({
      error: 'Failed to fetch guests',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /search - Search guests by attribute
 * Query params: name, domain, chemistry, expertise
 */
guestsRouter.get('/search', async (c) => {
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
    });
  } catch (error) {
    console.error('Error searching guests:', error);
    return c.json({
      error: 'Failed to search guests',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /:id - Get a specific guest by ID
 */
guestsRouter.get('/:id', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const id = c.req.param('id');

    if (!id) {
      return c.json({ error: 'Invalid guest ID' }, 400);
    }

    const result = await db.select().from(guests).where(eq(guests.id, id));

    if (result.length === 0) {
      return c.json({ error: 'Guest not found' }, 404);
    }

    const guest = result[0];

    // Parse JSON fields
    const parsedGuest = {
      ...guest,
      expertise: JSON.parse(guest.expertise),
      chemistry: JSON.parse(guest.chemistry),
      domain: JSON.parse(guest.domain),
    };

    return c.json({ guest: parsedGuest });
  } catch (error) {
    console.error('Error fetching guest:', error);
    return c.json({
      error: 'Failed to fetch guest',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export { guestsRouter };

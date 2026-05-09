/**
 * @fileoverview Vectorize Proxy API — REST endpoints for the Python RAG pipeline.
 *
 * Proxies embedding generation, vector upsert/query, and reranking through the Worker
 * so the Python script uses Workers AI + Vectorize bindings without needing API tokens.
 *
 * Model API Schemas:
 *
 * env.AI_MODEL_EMBEDDINGS (Embeddings)
 *   Input:  { text: string | string[], pooling?: "mean" | "cls" }
 *   Output: { data: number[][], shape: number[], pooling: string }
 *   - text is required, max 100 items in batch
 *   - pooling defaults to "mean"; "cls" is more accurate on longer inputs
 *     but produces incompatible embeddings with "mean"-pooled vectors
 *
 * env.AI_MODEL_RERANKING (Reranker)
 *   Input:  { query: string, contexts: Array<{ text: string }>, top_k?: number }
 *   Output: { response: Array<{ id: number, score: number }> }
 *   - id is the 0-based index into the contexts array
 *   - score is the reranker relevance score (higher = more relevant)
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/backend/db/schema";

const vectorizeRouter = new OpenAPIHono<{ Bindings: Env }>();

/**
 * POST /api/vectorize/embed
 *
 * Generate embeddings via bge-large-en-v1.5.
 *
 * @body { text: string | string[], pooling?: "mean" | "cls" }
 * @returns { data: number[][], shape: number[], pooling: string }
 */
const embedRoute = createRoute({
  method: 'post',
  path: '/embed',
  request: {
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(z.array(z.number())),
            shape: z.array(z.number()),
            pooling: z.string().optional(),
          }),
        },
      },
      description: 'Generated embeddings',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Missing or empty text field',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Embedding generation failed',
    },
  },
});

vectorizeRouter.openapi(embedRoute, async (c) => {
  try {
    const body = await c.req.json<{
      text: string | string[];
      pooling?: "mean" | "cls";
    }>();

    if (!body.text || (Array.isArray(body.text) && body.text.length === 0)) {
      return c.json({ error: "Missing or empty 'text' field" } as any, 400);
    }

    // Normalize to array for consistent handling
    const textArray = Array.isArray(body.text) ? body.text : [body.text];

    const result = (await c.env.AI.run(c.env.AI_MODEL_EMBEDDINGS as any, {
      text: textArray,
      ...(body.pooling ? { pooling: body.pooling } : {}),
    })) as unknown as {
      shape: number[];
      data: number[][];
      pooling?: string;
    };

    if (!result || !Array.isArray(result.data)) {
      return c.json({ error: "Invalid embedding response from AI model" } as any, 500);
    }

    return c.json({
      data: result.data,
      shape: result.shape,
      ...(result.pooling ? { pooling: result.pooling } : {}),
    } as any, 200);
  } catch (err: any) {
    console.error("Embed error:", err);
    return c.json({ error: `Embedding generation failed: ${err.message}` } as any, 500);
  }
});


/**
 * POST /api/vectorize/upsert
 *
 * Upsert vectors into the renegade-capital-trump-policy-pages Vectorize index.
 * Optionally submit corresponding D1 records to be stored alongside the vectors.
 *
 * @body { 
 *   vectors: Array<{ id: string, values: number[], metadata?: Record<string, any> }>,
 *   d1Records?: Array<any>
 * }
 * @returns Vectorize mutation result
 */
const upsertRoute = createRoute({
  method: 'post',
  path: '/upsert',
  request: {
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.any() },
      },
      description: 'Upsert result',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Missing vectors',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Upsert failed',
    },
  },
});

vectorizeRouter.openapi(upsertRoute, async (c) => {
  try {
    const body = await c.req.json<{
      vectors: Array<{ id: string; values: number[]; metadata?: Record<string, any> }>;
      d1Records?: Array<any>;
    }>();

    if (!body.vectors?.length) {
      return c.json({ error: "Missing or empty 'vectors' array" } as any, 400);
    }

    const result = await c.env.VECTORIZE.upsert(body.vectors);

    if (body.d1Records && body.d1Records.length > 0) {
      const db = drizzle(c.env.DB);
      const insertData = body.d1Records.map(record => ({
        uuid: record.uuid,
        pageNum: record.pageNum,
        pageContent: record.pageContent,
        r2Key: record.r2Key || null,
        pageImageUrl: record.pageImageUrl || null,
        aiSummary: record.aiSummary || null,
        aiAnalysis: record.aiAnalysis || null,
        aiRationale: record.aiRationale || null,
        aiOrganizeTech: record.aiOrganizeTech || null,
        aiOrganizeFinance: record.aiOrganizeFinance || null,
      }));
      await db.insert(schema.trumpPolicyPage).values(insertData).onConflictDoNothing();
    }

    return c.json(result as any, 200);
  } catch (err: any) {
    console.error("Upsert error:", err);
    return c.json({ error: err.message } as any, 500);
  }
});


/**
 * POST /api/vectorize/query
 *
 * Query the Vectorize index with text (auto-embedded) or a pre-computed vector.
 *
 * @body { text?: string, vector?: number[], topK?: number, returnMetadata?: boolean }
 * @returns Vectorize query result with matches
 */
const queryRoute = createRoute({
  method: 'post',
  path: '/query',
  request: {
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.any() },
      },
      description: 'Query matches',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Missing text or vector',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Query failed',
    },
  },
});

vectorizeRouter.openapi(queryRoute, async (c) => {
  try {
    const body = await c.req.json<{
      text?: string;
      vector?: number[];
      topK?: number;
      returnMetadata?: boolean;
    }>();

    let queryVector: number[];

    if (body.vector) {
      queryVector = body.vector;
    } else if (body.text) {
      const embResult = await c.env.AI.run(c.env.AI_MODEL_EMBEDDINGS as any, {
        text: [body.text],
      }) as unknown as { data: number[][] };
      const vec = embResult.data?.[0];
      if (!vec) return c.json({ error: "Embedding generation failed" } as any, 500);
      queryVector = vec;
    } else {
      return c.json({ error: "Must provide 'text' or 'vector'" } as any, 400);
    }

    const matches = await c.env.VECTORIZE.query(queryVector, {
      topK: body.topK ?? 10,
      returnMetadata: body.returnMetadata !== false ? "all" : "none",
    });

    return c.json(matches as any, 200);
  } catch (err: any) {
    console.error("Query error:", err);
    return c.json({ error: err.message } as any, 500);
  }
});


/**
 * POST /api/vectorize/rerank
 *
 * Rerank candidate texts against a query using bge-reranker-base.
 * Takes an initial set of candidates (typically from Vectorize) and
 * re-scores them for relevance, producing a tighter ranking.
 *
 * @body {
 *   query: string,                           — the user's search query
 *   contexts: Array<{ text: string }>,        — candidate texts to rerank
 *   top_k?: number                            — max results to return (default: all)
 * }
 *
 * @returns {
 *   response: Array<{ id: number, score: number }>
 *   — id is the 0-based index into the input contexts array
 *   — score is the reranker relevance score (higher = more relevant)
 *   — sorted by score descending
 * }
 */
const rerankRoute = createRoute({
  method: 'post',
  path: '/rerank',
  request: {
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.any() },
      },
      description: 'Reranked results',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Missing query or contexts',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Rerank failed',
    },
  },
});

vectorizeRouter.openapi(rerankRoute, async (c) => {
  try {
    const body = await c.req.json<{
      query: string;
      contexts: Array<{ text: string }>;
      top_k?: number;
    }>();

    if (!body.query || !body.contexts?.length) {
      return c.json({ error: "Missing 'query' or 'contexts'" } as any, 400);
    }

    const result = (await c.env.AI.run(c.env.AI_MODEL_RERANKING as any, {
      query: body.query,
      contexts: body.contexts,
      ...(body.top_k ? { top_k: body.top_k } : {}),
    })) as unknown as { response: Array<{ id: number; score: number }> };

    return c.json(result as any, 200);
  } catch (err: any) {
    console.error("Rerank error:", err);
    return c.json({ error: err.message } as any, 500);
  }
});


/**
 * DELETE /api/vectorize/vectors
 *
 * Delete vectors from the Vectorize index.
 *
 * @body { ids?: string[], all?: boolean }
 *   - ids: specific vector IDs to delete
 *   - all: if true, queries D1 for all trump_policy_page uuids and deletes them all
 * @returns Vectorize mutation result
 */
const deleteVectorsRoute = createRoute({
  method: 'delete',
  path: '/vectors',
  request: {
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.any() },
      },
      description: 'Vectors deleted',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Missing ids or all flag',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Delete failed',
    },
  },
});

vectorizeRouter.openapi(deleteVectorsRoute, async (c) => {
  try {
    const body = await c.req.json<{ ids?: string[]; all?: boolean }>();

    let idsToDelete: string[] = [];

    if (body.all) {
      // Fetch all uuids from D1 to know which vectors exist
      const db = drizzle(c.env.DB);
      const rows = await db
        .select({ uuid: schema.trumpPolicyPage.uuid })
        .from(schema.trumpPolicyPage)
        .all();
      idsToDelete = rows.map((r) => r.uuid);
    } else if (body.ids?.length) {
      idsToDelete = body.ids;
    } else {
      return c.json({ error: "Provide 'ids' array or set 'all' to true" } as any, 400);
    }

    if (idsToDelete.length === 0) {
      return c.json({ success: true, deleted: 0, message: "No vectors to delete" } as any, 200);
    }

    const result = await c.env.VECTORIZE.deleteByIds(idsToDelete);
    return c.json({ success: true, deleted: idsToDelete.length, mutationId: result } as any, 200);
  } catch (err: any) {
    console.error("Delete vectors error:", err);
    return c.json({ error: err.message } as any, 500);
  }
});


/**
 * POST /api/vectorize/search-blended
 *
 * Query Vectorize then join matched vector IDs (which are D1 uuids) with
 * full D1 data: trump_policy_pages, policy_scoring, and tags.
 *
 * @body { text: string, topK?: number }
 * @returns Array of enriched results with page data, scores, and tags
 */
const searchBlendedRoute = createRoute({
  method: 'post',
  path: '/search-blended',
  request: {
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.object({ results: z.array(z.any()), count: z.number() }) },
      },
      description: 'Blended search results',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Missing text',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Search failed',
    },
  },
});

vectorizeRouter.openapi(searchBlendedRoute, async (c) => {
  try {
    const body = await c.req.json<{ text: string; topK?: number }>();

    if (!body.text) {
      return c.json({ error: "Missing 'text' field" } as any, 400);
    }

    // 1. Embed the query text
    const embResult = (await c.env.AI.run(c.env.AI_MODEL_EMBEDDINGS as any, {
      text: [body.text],
    })) as unknown as { data: number[][] };
    const queryVector = embResult.data?.[0];
    if (!queryVector) return c.json({ error: "Embedding generation failed" } as any, 500);

    // 2. Query Vectorize
    const topK = body.topK ?? 10;
    const matches = await c.env.VECTORIZE.query(queryVector, {
      topK,
      returnMetadata: "all",
    });

    if (!matches.matches?.length) {
      return c.json({ results: [], count: 0 } as any, 200);
    }

    // 3. For each match, fetch D1 data by uuid
    const db = drizzle(c.env.DB);
    const results = [];

    for (const match of matches.matches) {
      const uuid = match.id;

      // Fetch the page
      const page = await db
        .select()
        .from(schema.trumpPolicyPage)
        .where(eq(schema.trumpPolicyPage.uuid, uuid))
        .get();

      if (!page) continue;

      // Fetch scoring
      const scoring = await db
        .select()
        .from(schema.policyScoring)
        .where(eq(schema.policyScoring.pageId, page.id))
        .get();

      // Fetch tags via tag map
      const tagMaps = await db
        .select({
          tagName: schema.trumpPolicyTag.name,
          typeName: schema.trumpPolicyTagType.name,
          aiRationale: schema.trumpPolicyPageTagMap.aiRationale,
        })
        .from(schema.trumpPolicyPageTagMap)
        .innerJoin(schema.trumpPolicyTag, eq(schema.trumpPolicyPageTagMap.tagId, schema.trumpPolicyTag.id))
        .innerJoin(schema.trumpPolicyTagType, eq(schema.trumpPolicyTag.typeId, schema.trumpPolicyTagType.id))
        .where(eq(schema.trumpPolicyPageTagMap.pageId, page.id))
        .all();

      results.push({
        vectorScore: match.score,
        uuid,
        page: {
          id: page.id,
          pageNum: page.pageNum,
          r2Key: page.r2Key,
          pageImageUrl: page.pageImageUrl,
          aiSummary: page.aiSummary,
          aiAnalysis: page.aiAnalysis,
          aiRationale: page.aiRationale,
          aiOrganizeTech: page.aiOrganizeTech,
          aiOrganizeFinance: page.aiOrganizeFinance,
        },
        scoring: scoring
          ? {
              racialEquity: scoring.racialEquity,
              economicJustice: scoring.economicJustice,
              algorithmicBias: scoring.algorithmicBias,
              laborRights: scoring.laborRights,
              privacySurveillance: scoring.privacySurveillance,
              overallImpactScore: scoring.overallImpactScore,
              overallRationale: scoring.overallRationale,
            }
          : null,
        tags: tagMaps,
      });
    }

    return c.json({ results, count: results.length } as any, 200);
  } catch (err: any) {
    console.error("Search-blended error:", err);
    return c.json({ error: err.message } as any, 500);
  }
});

export { vectorizeRouter };

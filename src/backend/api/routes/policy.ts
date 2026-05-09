/**
 * @fileoverview Policy Analysis REST API — serves policy page data, tags, and search.
 *
 * Exposes the D1 trump_policy_* tables and Vectorize search to the frontend
 * and any external consumers. Powers the Policy page's search results, tag browser,
 * and page detail views.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc, sql } from "drizzle-orm";
import * as schema from "../../db/schema";


const policyRouter = new OpenAPIHono<{ Bindings: Env }>();

/** GET /api/policy/pages — paginated list of policy pages with summaries */
const getPagesRoute = createRoute({
  method: 'get',
  path: '/pages',
  request: {
    query: z.object({
      page: z.string().optional().default('1'),
      limit: z.string().optional().default('20'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            pages: z.array(z.any()),
            total: z.number(),
            page: z.number(),
            limit: z.number(),
          }),
        },
      },
      description: 'Paginated list of policy pages',
    },
  },
});

policyRouter.openapi(getPagesRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  const pages = await db
    .select({
      id: schema.trumpPolicyPage.id,
      uuid: schema.trumpPolicyPage.uuid,
      pageNum: schema.trumpPolicyPage.pageNum,
      aiSummary: schema.trumpPolicyPage.aiSummary,
      pageImageUrl: schema.trumpPolicyPage.pageImageUrl,
      createdAt: schema.trumpPolicyPage.createdAt,
    })
    .from(schema.trumpPolicyPage)
    .orderBy(schema.trumpPolicyPage.pageNum)
    .limit(limit)
    .offset(offset)
    .all();

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.trumpPolicyPage)
    .get();

  return c.json({
    pages,
    total: countResult?.count ?? 0,
    page,
    limit,
  } as any, 200);
});

/** GET /api/policy/content-previews — serves lightweight page data with 500-word content previews for AI scripts */
const getContentPreviewsRoute = createRoute({
  method: 'get',
  path: '/content-previews',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            pages: z.array(z.any()),
          }),
        },
      },
      description: 'List of policy pages with 500-word content preview',
    },
  },
});

// @ts-ignore
policyRouter.openapi(getContentPreviewsRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const allPages = await db.select().from(schema.trumpPolicyPage).orderBy(schema.trumpPolicyPage.pageNum).all();
  
  const pages = allPages.map(page => {
    const preview = page.pageContent ? page.pageContent.split(' ').slice(0, 500).join(' ') : "";
    return {
      id: page.id,
      uuid: page.uuid,
      pageNum: page.pageNum,
      title: page.aiSummary?.slice(0, 50) || `Policy Page ${page.pageNum}`,
      contentPreview: preview,
    };
  });

  return c.json({ pages } as any, 200);
});

/** GET /api/policy/pages/:uuid — full page detail with tags, guests, episodes */
const getPageByUuidRoute = createRoute({
  method: 'get',
  path: '/pages/{uuid}',
  request: {
    params: z.object({ uuid: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            page: z.any(),
            tags: z.array(z.any()),
            guests: z.array(z.any()),
            episodes: z.array(z.any()),
          }),
        },
      },
      description: 'Policy page details',
    },
    404: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Page not found',
    },
  },
});

policyRouter.openapi(getPageByUuidRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const uuid = c.req.param("uuid");

  const page = await db
    .select()
    .from(schema.trumpPolicyPage)
    .where(eq(schema.trumpPolicyPage.uuid, uuid))
    .get();

  if (!page) return c.json({ error: "Page not found" } as any, 404);

  // Get associated tags
  const tags = await db
    .select({
      tagName: schema.trumpPolicyTag.name,
      typeName: schema.trumpPolicyTagType.name,
      rationale: schema.trumpPolicyPageTagMap.aiRationale,
    })
    .from(schema.trumpPolicyPageTagMap)
    .innerJoin(schema.trumpPolicyTag, eq(schema.trumpPolicyPageTagMap.tagId, schema.trumpPolicyTag.id))
    .innerJoin(schema.trumpPolicyTagType, eq(schema.trumpPolicyTag.typeId, schema.trumpPolicyTagType.id))
    .where(eq(schema.trumpPolicyPageTagMap.pageId, page.id))
    .all();

  // Get associated guests
  const guests = await db
    .select({
      guestId: schema.guests.id,
      name: schema.guests.name,
      expertise: schema.guests.expertise,
      headshotUrl: schema.guests.headshotUrl,
      rationale: schema.trumpPolicyPageGuestMap.aiRationale,
    })
    .from(schema.trumpPolicyPageGuestMap)
    .innerJoin(schema.guests, eq(schema.trumpPolicyPageGuestMap.guestId, schema.guests.id))
    .where(eq(schema.trumpPolicyPageGuestMap.pageId, page.id))
    .all();

  // Get associated episodes
  const episodes = await db
    .select({
      episodeId: schema.episodes.id,
      title: schema.episodes.title,
      description: schema.episodes.description,
      rationale: schema.trumpPolicyPageEpisodeMap.aiRationale,
    })
    .from(schema.trumpPolicyPageEpisodeMap)
    .innerJoin(schema.episodes, eq(schema.trumpPolicyPageEpisodeMap.episodeId, schema.episodes.id))
    .where(eq(schema.trumpPolicyPageEpisodeMap.pageId, page.id))
    .all();

  return c.json({ page, tags, guests, episodes } as any, 200);
});


/** GET /api/policy/tags — hierarchical tag tree */
const getTagsRoute = createRoute({
  method: 'get',
  path: '/tags',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            tree: z.array(z.any()),
          }),
        },
      },
      description: 'Hierarchical tag tree',
    },
  },
});

// @ts-ignore
policyRouter.openapi(getTagsRoute, async (c) => {
  const db = drizzle(c.env.DB);

  const types = await db.select().from(schema.trumpPolicyTagType).all();
  const tags = await db.select().from(schema.trumpPolicyTag).all();

  // Group tags by type
  const tree = types.map((type) => ({
    ...type,
    tags: tags.filter((t) => t.typeId === type.id),
  }));

  return c.json({ tree } as any, 200);
});

/**
 * GET /api/policy/search
 *
 * Semantic search with a 3-stage pipeline:
 *   1. Embed query via env.AI_MODEL_EMBEDDINGS
 *      Input:  { text: string[] }
 *      Output: { data: number[][], shape: number[] }
 *
 *   2. Retrieve top-20 candidates from Vectorize (over-fetch for reranker)
 *
 *   3. Rerank candidates via env.AI_MODEL_RERANKING
 *      Input:  { query: string, contexts: Array<{ text: string }>, top_k?: number }
 *      Output: { response: Array<{ id: number, score: number }> }
 *      - id is the 0-based index into the contexts array
 *      - score is the reranker relevance score (higher = more relevant)
 *
 * Returns final top-K results enriched with D1 page data.
 */
/**
 * GET /api/policy/heatmap
 * Fetch all policy pages with their scoring data to generate the frontend heatmap.
 */
const getHeatmapRoute = createRoute({
  method: 'get',
  path: '/heatmap',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(z.any()),
          }),
        },
      },
      description: 'Heatmap scoring data',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to fetch heatmap data',
    },
  },
});

// @ts-ignore
policyRouter.openapi(getHeatmapRoute, async (c) => {
  const db = drizzle(c.env.DB);
  try {
    const results = await db
      .select({
        id: schema.trumpPolicyPage.id,
        uuid: schema.trumpPolicyPage.uuid,
        pageNum: schema.trumpPolicyPage.pageNum,
        aiSummary: schema.trumpPolicyPage.aiSummary,
        pageImageUrl: schema.trumpPolicyPage.pageImageUrl,
        scores: schema.policyScoring
      })
      .from(schema.trumpPolicyPage)
      .leftJoin(schema.policyScoring, eq(schema.trumpPolicyPage.id, schema.policyScoring.pageId))
      .orderBy(schema.trumpPolicyPage.pageNum)
      .all();
      
    return c.json({ data: results } as any, 200);
  } catch (err: any) {
    return c.json({ error: err.message } as any, 500);
  }
});


/**
 * GET /api/policy/search
 */
const searchPolicyRoute = createRoute({
  method: 'get',
  path: '/search',
  request: {
    query: z.object({
      q: z.string(),
      topK: z.string().optional().default('5'),
      skipRerank: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            results: z.array(z.any()),
            query: z.string(),
            totalHits: z.number(),
            reranked: z.boolean(),
            candidatesReranked: z.number().optional(),
          }),
        },
      },
      description: 'Search results',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Missing query parameter',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Search failed',
    },
  },
});

policyRouter.openapi(searchPolicyRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const query = c.req.query("q");
  const topK = parseInt(c.req.query("topK") || "5");
  const skipRerank = c.req.query("skipRerank") === "true";

  if (!query) return c.json({ error: "Missing 'q' query parameter" } as any, 400);

  // Stage 1: Embed the query
  // bge-large-en-v1.5 input: { text: string | string[] }
  // bge-large-en-v1.5 output: { data: number[][], shape: number[] }
  const embResult = (await c.env.AI.run(c.env.AI_MODEL_EMBEDDINGS as any, {
    text: [query],
  })) as unknown as { data: number[][] };
  const queryVector = embResult.data?.[0];
  if (!queryVector) return c.json({ error: "Embedding generation failed" } as any, 500);

  // Stage 2: Retrieve candidates from Vectorize (over-fetch 4x for reranking)
  const retrievalK = skipRerank ? topK : Math.min(topK * 4, 20);
  const vectorResults = await c.env.VECTORIZE.query(queryVector, {
    topK: retrievalK,
    returnMetadata: "all",
  });

  // Enrich all candidates with D1 content for reranking
  const candidates: Array<{
    vectorScore: number;
    pageNum: number | null;
    summary: string | null;
    content: string | null;
    fullContent: string;
    imageUrl: string | null;
    uuid: string;
    analysis: string | null;
    scores: any;
  }> = [];
  for (const match of vectorResults.matches) {
    const page = await db
      .select()
      .from(schema.trumpPolicyPage)
      .where(eq(schema.trumpPolicyPage.uuid, match.id))
      .get();
      
    const scores = page ? await db
      .select()
      .from(schema.policyScoring)
      .where(eq(schema.policyScoring.pageId, page.id))
      .get() : null;

    candidates.push({
      vectorScore: match.score,
      pageNum: page?.pageNum ?? (match.metadata as any)?.page_num,
      summary: page?.aiSummary ?? null,
      content: page?.pageContent?.substring(0, 500) ?? null,
      fullContent: page?.pageContent ?? "",
      imageUrl: page?.pageImageUrl ?? null,
      uuid: match.id,
      analysis: page?.aiAnalysis ?? null,
      scores,
    });
  }

  // Stage 3: Rerank using bge-reranker-base
  // Input:  { query: string, contexts: Array<{ text: string }>, top_k?: number }
  // Output: { response: Array<{ id: number, score: number }> }
  if (!skipRerank && candidates.length > 0) {
    try {
      // Build contexts array — use content + summary for richer reranking signal
      const contexts = candidates.map((c) => ({
        text: [c.summary, c.content].filter(Boolean).join("\n\n") || "No content",
      }));

      const rerankResult = (await c.env.AI.run(c.env.AI_MODEL_RERANKING as any, {
        query,
        contexts,
        top_k: topK,
      })) as unknown as { response: Array<{ id: number; score: number }> };

      // rerankResult.response is Array<{ id: number, score: number }>
      // id = 0-based index into the contexts array
      const rerankedResults = (rerankResult.response || [])
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, topK)
        .map((item: any) => {
          const candidate = candidates[item.id];
          return {
            score: item.score,
            vectorScore: candidate?.vectorScore,
            pageNum: candidate?.pageNum,
            summary: candidate?.summary,
            content: candidate?.content,
            imageUrl: candidate?.imageUrl,
            uuid: candidate?.uuid,
            analysis: candidate?.analysis,
            scores: candidate?.scores,
          };
        });

      return c.json({
        results: rerankedResults,
        query,
        totalHits: vectorResults.count,
        reranked: true,
        candidatesReranked: candidates.length,
      } as any, 200);
    } catch (rerankErr: any) {
      console.error("Reranker failed, falling back to vector scores:", rerankErr);
      // Fall through to vector-only results below
    }
  }

  // Fallback: return vector-scored results without reranking
  const results = candidates.slice(0, topK).map((c) => ({
    score: c.vectorScore,
    pageNum: c.pageNum,
    summary: c.summary,
    content: c.content,
    imageUrl: c.imageUrl,
    uuid: c.uuid,
    analysis: c.analysis,
    scores: c.scores,
  }));

  return c.json({ results, query, totalHits: vectorResults.count, reranked: false } as any, 200);
});


/** GET /api/policy/stats — aggregate counts */
const getStatsRoute = createRoute({
  method: 'get',
  path: '/stats',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            pages: z.number(),
            tags: z.number(),
            guestMappings: z.number(),
          }),
        },
      },
      description: 'Aggregate counts',
    },
  },
});

policyRouter.openapi(getStatsRoute, async (c) => {
  const db = drizzle(c.env.DB);

  const pageCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.trumpPolicyPage)
    .get();

  const tagCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.trumpPolicyTag)
    .get();

  const guestMapCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.trumpPolicyPageGuestMap)
    .get();

  return c.json({
    pages: pageCount?.count ?? 0,
    tags: tagCount?.count ?? 0,
    guestMappings: guestMapCount?.count ?? 0,
  } as any, 200);
/** POST /api/policy/pages — create a new policy page record (used by Python pipeline) */
});
const createPageRoute = createRoute({
  method: 'post',
  path: '/pages',
  request: {
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ id: z.number(), uuid: z.string() }),
        },
      },
      description: 'Page created',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to create page',
    },
  },
});

policyRouter.openapi(createPageRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json();

  try {
    // 1. Insert Policy Page
    const pageResult = await db
      .insert(schema.trumpPolicyPage)
      .values({
        uuid: body.uuid,
        pageNum: body.pageNum,
        pageContent: body.pageContent,
        r2Key: body.r2Key || null,
        pageImageUrl: body.pageImageUrl || null,
        aiSummary: body.aiSummary || null,
        aiAnalysis: body.aiAnalysis || null,
        aiRationale: body.aiRationale || null,
        aiOrganizeTech: body.aiOrganizeTech || null,
        aiOrganizeFinance: body.aiOrganizeFinance || null,
      })
      .returning({ id: schema.trumpPolicyPage.id });

    const pageId = pageResult[0].id;

    // 2. Insert Scoring
    if (body.policyScoring) {
      await db.insert(schema.policyScoring).values({
        pageId,
        ...body.policyScoring,
      });
    }

    // 3. Handle Tags
    if (body.tags && Array.isArray(body.tags)) {
      for (const tagData of body.tags) {
        
        // Find or create parent tag type
        let parentTypeId = null;
        if (tagData.parentType) {
          let pTypeResult = await db.select().from(schema.trumpPolicyTagType).where(eq(schema.trumpPolicyTagType.name, tagData.parentType)).get();
          if (!pTypeResult) {
            const newPType = await db.insert(schema.trumpPolicyTagType).values({ name: tagData.parentType }).returning({ id: schema.trumpPolicyTagType.id });
            parentTypeId = newPType[0].id;
          } else {
            parentTypeId = pTypeResult.id;
          }
        }

        // Find or create tag type
        let typeResult = await db
          .select()
          .from(schema.trumpPolicyTagType)
          .where(eq(schema.trumpPolicyTagType.name, tagData.type))
          .get();

        if (!typeResult) {
          const newType = await db
            .insert(schema.trumpPolicyTagType)
            .values({ name: tagData.type, parentId: parentTypeId })
            .returning({ id: schema.trumpPolicyTagType.id });
          typeResult = { id: newType[0].id, name: tagData.type, parentId: parentTypeId, description: null, isActive: true };
        }

        // Find or create parent tag
        let parentTagId = null;
        if (tagData.parentTag) {
          let pTagResult = await db.select().from(schema.trumpPolicyTag).where(sql`${schema.trumpPolicyTag.name} = ${tagData.parentTag} AND ${schema.trumpPolicyTag.typeId} = ${typeResult.id}`).get();
          if (!pTagResult) {
            const newPTag = await db.insert(schema.trumpPolicyTag).values({ name: tagData.parentTag, typeId: typeResult.id }).returning({ id: schema.trumpPolicyTag.id });
            parentTagId = newPTag[0].id;
          } else {
            parentTagId = pTagResult.id;
          }
        }

        // Find or create tag
        let tagResult = await db
          .select()
          .from(schema.trumpPolicyTag)
          .where(sql`${schema.trumpPolicyTag.name} = ${tagData.name} AND ${schema.trumpPolicyTag.typeId} = ${typeResult.id}`)
          .get();

        if (!tagResult) {
          const newTag = await db
            .insert(schema.trumpPolicyTag)
            .values({ name: tagData.name, typeId: typeResult.id, parentId: parentTagId })
            .returning({ id: schema.trumpPolicyTag.id });
          tagResult = { id: newTag[0].id, name: tagData.name, typeId: typeResult.id, parentId: parentTagId, description: null, isActive: true };
        }

        // Map to page
        await db.insert(schema.trumpPolicyPageTagMap).values({
          pageId,
          tagId: tagResult.id,
          aiRationale: tagData.rationale,
        });
      }
    }

    // 4. Handle Guest Matches
    if (body.guestMatches && Array.isArray(body.guestMatches)) {
      for (const match of body.guestMatches) {
        await db.insert(schema.trumpPolicyPageGuestMap).values({
          pageId,
          guestId: match.id,
          aiRationale: match.rationale,
        });
      }
    }

    // 5. Handle Transcript (Create Episode)
    if (body.transcript && Array.isArray(body.transcript)) {
      const episodeId = `ep-${body.uuid.slice(0, 8)}`;
      await db.insert(schema.episodes).values({
        id: episodeId,
        title: `Clash on Page ${body.pageNum}: ${body.aiSummary?.slice(0, 50) || "Policy Analysis"}`,
        description: body.aiSummary || "AI-generated transcript from policy analysis.",
      });

      // Map episode to page
      await db.insert(schema.trumpPolicyPageEpisodeMap).values({
        pageId,
        episodeId,
        source: "pipeline",
        aiRationale: "Auto-generated from page analysis.",
      });

      // Insert transcript lines
      for (let i = 0; i < body.transcript.length; i++) {
        const line = body.transcript[i];
        
        // Determine speaker source and guest ID
        let speakerSource: "host" | "guest" = "guest";
        let guestId: string | null = null;
        
        if (line.speaker.toLowerCase().includes("andrea") || line.speaker.toLowerCase().includes("host")) {
          speakerSource = "host";
        } else {
          // Try to find matching guest ID from guestMatches
          const matchedGuest = body.guestMatches?.find((g: any) => 
            g.name.toLowerCase() === line.speaker.toLowerCase()
          );
          if (matchedGuest) {
            guestId = matchedGuest.id;
          }
        }

        await db.insert(schema.episodeTranscriptLines).values({
          episodeId,
          lineNumber: i,
          speakerSource,
          guestId,
          transcriptLine: line.text,
          cue: line.cue || "",
        });
      }
    }

    return c.json({ id: pageId, uuid: body.uuid } as any, 200);
  } catch (err: any) {
    console.error("Error persisting policy page:", err);
    return c.json({ error: err.message } as any, 500);
  }
});


/** POST /api/policy/r2-upload — upload a file to R2 (used by Python pipeline) */
const r2UploadRoute = createRoute({
  method: 'post',
  path: '/r2-upload',
  request: {
    body: {
      content: { 'multipart/form-data': { schema: z.any() } },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.object({ key: z.string(), size: z.number() }) },
      },
      description: 'Upload successful',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Missing parameters',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Upload failed',
    },
  },
});

policyRouter.openapi(r2UploadRoute, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const key = formData.get("key") as string;

    if (!file || !key) {
      return c.json({ error: "Missing 'file' or 'key'" } as any, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    await c.env.R2_TRUMP_POLICY.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type || "application/pdf" },
    });

    return c.json({ key, size: arrayBuffer.byteLength } as any, 200);
  } catch (err: any) {
    return c.json({ error: err.message } as any, 500);
  }
});


/** POST /api/policy/r2-clear — delete all objects in R2 (used by Python pipeline) */
const r2ClearRoute = createRoute({
  method: 'post',
  path: '/r2-clear',
  responses: {
    200: {
      content: {
        'application/json': { schema: z.object({ success: z.boolean(), deleted: z.number() }) },
      },
      description: 'R2 cleared',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to clear R2',
    },
  },
});

policyRouter.openapi(r2ClearRoute, async (c) => {
  try {
    const list = await c.env.R2_TRUMP_POLICY.list({ prefix: 'trump-policy/' });
    const keys = list.objects.map(obj => obj.key);
    
    // R2 allows deleting multiple keys, but requires them to be passed individually or in batches
    // The R2 put/delete bindings: await c.env.R2.delete(["key1", "key2"]) or await c.env.R2.delete("key")
    if (keys.length > 0) {
      await c.env.R2_TRUMP_POLICY.delete(keys);
    }
    
    return c.json({ success: true, deleted: keys.length } as any, 200);
  } catch (err: any) {
    return c.json({ error: err.message } as any, 500);
  }
});


/** POST /api/policy/global-episodes — bulk insert podcast episodes generated from global tags/policies */
const globalEpisodesRoute = createRoute({
  method: 'post',
  path: '/global-episodes',
  request: {
    body: {
      content: { 'application/json': { schema: z.any() } },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.object({ success: z.boolean(), episodesInserted: z.array(z.string()) }) },
      },
      description: 'Episodes inserted',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Failed to insert episodes',
    },
  },
});

policyRouter.openapi(globalEpisodesRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json();

  try {
    const episodesInserted = [];
    if (body.episodes && Array.isArray(body.episodes)) {
      for (const ep of body.episodes) {
        // Generate a stable ID for the episode based on its title if an ID wasn't provided
        const episodeId = ep.id || `ep-global-${Math.random().toString(36).substring(2, 10)}`;

        await db.insert(schema.episodes).values({
          id: episodeId,
          title: ep.title,
          description: ep.description || "Globally generated podcast episode.",
        }).onConflictDoNothing(); // Prevent dupe ID crashes if re-run
        
        episodesInserted.push(episodeId);

        // If target tags are provided, map the episode to the pages that have those tags.
        // Or if the AI provides specific page IDs, map those directly.
        // We'll map to specific targetTags for now.
        if (ep.targetTags && Array.isArray(ep.targetTags)) {
          for (const tag of ep.targetTags) {
            // Find tag by name
            const tagRec = await db.select().from(schema.trumpPolicyTag).where(eq(schema.trumpPolicyTag.name, tag)).get();
            if (tagRec) {
              // Find pages with this tag
              const mappings = await db.select().from(schema.trumpPolicyPageTagMap).where(eq(schema.trumpPolicyPageTagMap.tagId, tagRec.id)).all();
              for (const map of mappings) {
                await db.insert(schema.trumpPolicyPageEpisodeMap).values({
                  pageId: map.pageId,
                  episodeId,
                  source: "global-pipeline",
                  aiRationale: `Included because it maps to tag: ${tag}`,
                }).onConflictDoNothing(); // Prevent dupes if multiple tags hit the same page
              }
            }
          }
        }

        // Insert transcript lines
        if (ep.transcript && Array.isArray(ep.transcript)) {
          for (let i = 0; i < ep.transcript.length; i++) {
            const line = ep.transcript[i];
            
            let speakerSource: "host" | "guest" = "guest";
            let guestId: string | null = null;
            
            if (line.speaker.toLowerCase().includes("andrea") || line.speaker.toLowerCase().includes("host")) {
              speakerSource = "host";
            } else {
              // The AI should send guestId directly or we find it by name
              const matchedGuest = await db.select().from(schema.guests).where(eq(schema.guests.name, line.speaker)).get();
              if (matchedGuest) {
                guestId = matchedGuest.id;
              }
            }

            await db.insert(schema.episodeTranscriptLines).values({
              episodeId,
              lineNumber: i,
              speakerSource,
              guestId,
              transcriptLine: line.text,
              cue: line.cue || "",
            });
          }
        }
      }
    }
    return c.json({ success: true, episodesInserted } as any, 200);
  } catch (err: any) {
    console.error("Error persisting global episodes:", err);
    return c.json({ error: err.message } as any, 500);
  }
});


/**
 * POST /api/policy/clear-all
 *
 * Nuclear reset for the pipeline. Clears:
 * 1. R2 bucket (all policy page PDFs)
 * 2. Cloudflare Images (all page_image_url entries)
 * 3. Vectorize index (all vectors keyed by D1 uuids)
 * 4. D1 tables: trump_policy_page_tag_map, policy_scoring, trump_policy_pages
 *    (DELETE + reset autoincrement PK counter)
 */
const clearAllRoute = createRoute({
  method: 'post',
  path: '/clear-all',
  responses: {
    200: {
      content: {
        'application/json': { schema: z.any() },
      },
      description: 'Pipeline reset successful',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string(), partialResults: z.any() }) },
      },
      description: 'Pipeline reset failed',
    },
  },
});

policyRouter.openapi(clearAllRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const results: Record<string, any> = {};

  try {
    // --- 1. Clear R2 bucket ---
    const r2List = await c.env.R2_TRUMP_POLICY.list({ prefix: 'trump-policy/' });
    const r2Keys = r2List.objects.map((obj) => obj.key);
    if (r2Keys.length > 0) {
      await c.env.R2_TRUMP_POLICY.delete(r2Keys);
    }
    results.r2Deleted = r2Keys.length;

    // --- 2. Delete Cloudflare Images ---
    const pages = await db
      .select({
        uuid: schema.trumpPolicyPage.uuid,
        pageImageUrl: schema.trumpPolicyPage.pageImageUrl,
      })
      .from(schema.trumpPolicyPage)
      .all();

    let imagesDeleted = 0;
    const accountId = await c.env.CLOUDFLARE_ACCOUNT_ID.get();
    const apiToken = c.req.header("X-Images-Token") || await c.env.CLOUDFLARE_AI_GATEWAY_TOKEN.get();

    for (const page of pages) {
      if (page.pageImageUrl) {
        try {
          // Extract image ID from the delivery URL
          // Format: https://imagedelivery.net/<account_hash>/<image_id>/<variant>
          const urlParts = page.pageImageUrl.split("/");
          const imageId = urlParts[urlParts.length - 2]; // second to last segment
          if (imageId) {
            await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${apiToken}` },
              }
            );
            imagesDeleted++;
          }
        } catch (imgErr) {
          console.error(`Failed to delete CF image for uuid ${page.uuid}:`, imgErr);
        }
      }
    }
    results.imagesDeleted = imagesDeleted;

    // --- 3. Clear Vectorize index ---
    const uuids = pages.map((p) => p.uuid);
    if (uuids.length > 0) {
      await c.env.VECTORIZE.deleteByIds(uuids);
    }
    results.vectorsDeleted = uuids.length;

    // --- 4. Truncate D1 tables and reset PK counters ---
    // Order matters: child tables first due to FK constraints
    await db.delete(schema.trumpPolicyPageTagMap);
    await db.delete(schema.policyScoring);
    await db.delete(schema.trumpPolicyPage);

    // Reset autoincrement counters in SQLite
    const rawDb = c.env.DB;
    await rawDb.prepare("DELETE FROM sqlite_sequence WHERE name = 'trump_policy_page_tag_map'").run();
    await rawDb.prepare("DELETE FROM sqlite_sequence WHERE name = 'policy_scoring'").run();
    await rawDb.prepare("DELETE FROM sqlite_sequence WHERE name = 'trump_policy_pages'").run();

    results.d1Truncated = ["trump_policy_page_tag_map", "policy_scoring", "trump_policy_pages"];

    return c.json({ success: true, ...results } as any, 200);
  } catch (err: any) {
    console.error("clear-all error:", err);
    return c.json({ error: err.message, partialResults: results } as any, 500);
  }
});


/**
 * POST /api/policy/images-upload
 *
 * Upload an image to Cloudflare Images and return the delivery URL.
 * Accepts multipart form data with a "file" field.
 *
 * @returns { imageUrl: string, imageId: string }
 */
const imagesUploadRoute = createRoute({
  method: 'post',
  path: '/images-upload',
  request: {
    body: {
      content: { 'multipart/form-data': { schema: z.any() } },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.object({ imageId: z.string(), imageUrl: z.string() }) },
      },
      description: 'Upload successful',
    },
    400: {
      content: {
        'application/json': { schema: z.object({ error: z.string() }) },
      },
      description: 'Missing parameters',
    },
    500: {
      content: {
        'application/json': { schema: z.object({ error: z.string(), details: z.any().optional() }) },
      },
      description: 'Upload failed',
    },
  },
});

policyRouter.openapi(imagesUploadRoute, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json({ error: "Missing 'file' in form data" } as any, 400);
    }

    const accountId = await c.env.CLOUDFLARE_ACCOUNT_ID.get();
    const apiToken = await c.env.CLOUDFLARE_AI_GATEWAY_TOKEN.get();

    // Build multipart form for CF Images API
    const cfForm = new FormData();
    cfForm.append("file", file, file.name || "page.png");

    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}` },
        body: cfForm,
      }
    );

    const result = await resp.json() as any;

    if (!result.success) {
      return c.json({ error: "CF Images upload failed", details: result.errors } as any, 500);
    }

    const imageId = result.result.id;
    const variants = result.result.variants as string[];
    const imageUrl = variants?.[0] || `https://imagedelivery.net/${accountId}/${imageId}/public`;

    return c.json({ imageId, imageUrl } as any, 200);
  } catch (err: any) {
    console.error("images-upload error:", err);
    return c.json({ error: err.message } as any, 500);
  }
});

/** GET /api/policy/metrics — aggregate stats for dashboard */
const getMetricsRoute = createRoute({
  method: 'get',
  path: '/metrics',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.any(),
        },
      },
      description: 'Policy Metrics',
    },
    500: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Failed to fetch metrics',
    },
  },
});

policyRouter.openapi(getMetricsRoute, async (c) => {
  const db = drizzle(c.env.DB);
  try {
    const pagesWithScoresAndTags = await db
      .select({
        pageId: schema.trumpPolicyPage.id,
        racialEquity: schema.policyScoring.racialEquity,
        economicJustice: schema.policyScoring.economicJustice,
        algorithmicBias: schema.policyScoring.algorithmicBias,
        laborRights: schema.policyScoring.laborRights,
        privacySurveillance: schema.policyScoring.privacySurveillance,
        overallImpactScore: schema.policyScoring.overallImpactScore,
        tagTypeName: schema.trumpPolicyTagType.name,
      })
      .from(schema.trumpPolicyPage)
      .innerJoin(schema.policyScoring, eq(schema.trumpPolicyPage.id, schema.policyScoring.pageId))
      .innerJoin(schema.trumpPolicyPageTagMap, eq(schema.trumpPolicyPage.id, schema.trumpPolicyPageTagMap.pageId))
      .innerJoin(schema.trumpPolicyTag, eq(schema.trumpPolicyPageTagMap.tagId, schema.trumpPolicyTag.id))
      .innerJoin(schema.trumpPolicyTagType, eq(schema.trumpPolicyTag.typeId, schema.trumpPolicyTagType.id))
      .all();

    const tagTypeMap: Record<string, any> = {};
    const pieCountMap: Record<string, number> = {};
    const pageProcessedForPie = new Set<number>();

    for (const row of pagesWithScoresAndTags) {
      if (!tagTypeMap[row.tagTypeName]) {
        tagTypeMap[row.tagTypeName] = {
          type: row.tagTypeName,
          count: 0,
          racialEquity: 0,
          economicJustice: 0,
          algorithmicBias: 0,
          laborRights: 0,
          privacySurveillance: 0,
        };
      }
      
      tagTypeMap[row.tagTypeName].count++;
      tagTypeMap[row.tagTypeName].racialEquity += row.racialEquity || 0;
      tagTypeMap[row.tagTypeName].economicJustice += row.economicJustice || 0;
      tagTypeMap[row.tagTypeName].algorithmicBias += row.algorithmicBias || 0;
      tagTypeMap[row.tagTypeName].laborRights += row.laborRights || 0;
      tagTypeMap[row.tagTypeName].privacySurveillance += row.privacySurveillance || 0;

      if (!pageProcessedForPie.has(row.pageId)) {
        pieCountMap[row.tagTypeName] = (pieCountMap[row.tagTypeName] || 0) + 1;
        pageProcessedForPie.add(row.pageId);
      }
    }

    const radarData = Object.values(tagTypeMap).map(typeData => ({
      category: typeData.type,
      "Racial Equity": parseFloat((typeData.racialEquity / typeData.count).toFixed(1)),
      "Economic Justice": parseFloat((typeData.economicJustice / typeData.count).toFixed(1)),
      "Algorithmic Bias": parseFloat((typeData.algorithmicBias / typeData.count).toFixed(1)),
      "Labor Rights": parseFloat((typeData.laborRights / typeData.count).toFixed(1)),
      "Privacy": parseFloat((typeData.privacySurveillance / typeData.count).toFixed(1)),
    }));

    const allRisks: any[] = [];
    const allPagesWithScores = await db
      .select({
        pageId: schema.trumpPolicyPage.id,
        pageNum: schema.trumpPolicyPage.pageNum,
        racialEquity: schema.policyScoring.racialEquity,
        economicJustice: schema.policyScoring.economicJustice,
        algorithmicBias: schema.policyScoring.algorithmicBias,
        laborRights: schema.policyScoring.laborRights,
        privacySurveillance: schema.policyScoring.privacySurveillance,
      })
      .from(schema.trumpPolicyPage)
      .innerJoin(schema.policyScoring, eq(schema.trumpPolicyPage.id, schema.policyScoring.pageId))
      .all();
      
    allPagesWithScores.forEach(p => {
      if (p.racialEquity) allRisks.push({ name: `Pg ${p.pageNum}-Racial`, score: p.racialEquity, dimension: "racialEquity" });
      if (p.economicJustice) allRisks.push({ name: `Pg ${p.pageNum}-Econ`, score: p.economicJustice, dimension: "economicJustice" });
      if (p.algorithmicBias) allRisks.push({ name: `Pg ${p.pageNum}-Bias`, score: p.algorithmicBias, dimension: "algorithmicBias" });
      if (p.laborRights) allRisks.push({ name: `Pg ${p.pageNum}-Labor`, score: p.laborRights, dimension: "laborRights" });
      if (p.privacySurveillance) allRisks.push({ name: `Pg ${p.pageNum}-Priv`, score: p.privacySurveillance, dimension: "privacySurveillance" });
    });
    
    allRisks.sort((a, b) => b.score - a.score);
    const top10Risks = allRisks.slice(0, 10).map((r) => ({
      browser: r.name,
      visitors: r.score,
      fill: `var(--color-${r.dimension})`,
    }));

    let colorIndex = 1;
    const pieData = Object.entries(pieCountMap).map(([type, count]) => {
      const idx = colorIndex > 5 ? 5 : colorIndex++;
      return {
        browser: type,
        visitors: count,
        fill: `hsl(var(--chart-${idx}))`,
      };
    });

    return c.json({ radarData, barData: top10Risks, pieData }, 200);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/** GET /api/policy/summary — AI generated summary */
const getSummaryRoute = createRoute({
  method: 'get',
  path: '/summary',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ summary: z.string() }) } },
      description: 'AI Summary',
    },
    500: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Failed to generate summary',
    },
  },
});

policyRouter.openapi(getSummaryRoute, async (c) => {
  const db = drizzle(c.env.DB);
  try {
    const pageCount = await db.select({ count: sql<number>`count(*)` }).from(schema.trumpPolicyPage).get();
    
    const avgScores = await db.select({
      avgRacial: sql<number>`avg(racial_equity)`,
      avgEcon: sql<number>`avg(economic_justice)`,
      avgOverall: sql<number>`avg(overall_impact_score)`,
    }).from(schema.policyScoring).get();

    const prompt = `You are a civil rights policy analyst. Based on the following metrics from the database of the Trump AI Action Plan, provide a succinct, 2-3 paragraph executive summary of the threats and findings. Focus on actionable insights for social justice practitioners.
    
    Total Policies Indexed: ${pageCount?.count}
    Average Overall Risk Score: ${avgScores?.avgOverall?.toFixed(2)}/10
    Average Racial Equity Impact: ${avgScores?.avgRacial?.toFixed(2)}/10
    Average Economic Justice Impact: ${avgScores?.avgEcon?.toFixed(2)}/10
    
    Make it punchy, analytical, and highly professional. Use Markdown formatting.`;

    const aiResult = await c.env.AI.run(c.env.AI_MODEL_CHAT as any, {
      messages: [{ role: "user", content: prompt }],
    }) as { response?: string };

    const summary = aiResult?.response || "Failed to generate AI summary.";
    return c.json({ summary } as any, 200);
  } catch (err: any) {
    return c.json({ error: err.message } as any, 500);
  }
});

/** GET /api/policy/review — hierarchical grouping of pages by tag type and tag */
const getReviewRoute = createRoute({
  method: 'get',
  path: '/review',
  responses: {
    200: {
      content: { 'application/json': { schema: z.any() } },
      description: 'Grouped pages for review',
    },
    500: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Failed to fetch review data',
    },
  },
});

policyRouter.openapi(getReviewRoute, async (c) => {
  const db = drizzle(c.env.DB);
  try {
    const rawData = await db
      .select({
        pageId: schema.trumpPolicyPage.id,
        pageNum: schema.trumpPolicyPage.pageNum,
        uuid: schema.trumpPolicyPage.uuid,
        summary: schema.trumpPolicyPage.aiSummary,
        imageUrl: schema.trumpPolicyPage.pageImageUrl,
        overallScore: schema.policyScoring.overallImpactScore,
        racialEquityScore: schema.policyScoring.racialEquity,
        economicJusticeScore: schema.policyScoring.economicJustice,
        algorithmicBiasScore: schema.policyScoring.algorithmicBias,
        laborRightsScore: schema.policyScoring.laborRights,
        privacySurveillanceScore: schema.policyScoring.privacySurveillance,
        overallRationale: schema.policyScoring.overallRationale,
        analysis: schema.trumpPolicyPage.aiAnalysis,
        tagTypeName: schema.trumpPolicyTagType.name,
        tagName: schema.trumpPolicyTag.name,
      })
      .from(schema.trumpPolicyPage)
      .leftJoin(schema.policyScoring, eq(schema.trumpPolicyPage.id, schema.policyScoring.pageId))
      .leftJoin(schema.trumpPolicyPageTagMap, eq(schema.trumpPolicyPage.id, schema.trumpPolicyPageTagMap.pageId))
      .leftJoin(schema.trumpPolicyTag, eq(schema.trumpPolicyPageTagMap.tagId, schema.trumpPolicyTag.id))
      .leftJoin(schema.trumpPolicyTagType, eq(schema.trumpPolicyTag.typeId, schema.trumpPolicyTagType.id))
      .all();

    // Grouping structure: { tagTypeName: { tagName: [pages...] } }
    const grouped: Record<string, Record<string, any[]>> = {};

    for (const row of rawData) {
      const type = row.tagTypeName || "Uncategorized";
      const tag = row.tagName || "Untagged";

      if (!grouped[type]) grouped[type] = {};
      if (!grouped[type][tag]) grouped[type][tag] = [];

      // Avoid duplicates inside a tag array
      if (!grouped[type][tag].some(p => p.pageId === row.pageId)) {
        grouped[type][tag].push({
          id: row.pageId,
          uuid: row.uuid,
          pageNum: row.pageNum,
          summary: row.summary,
          imageUrl: row.imageUrl,
          analysis: row.analysis,
          scores: row.overallScore !== null ? {
            overallImpactScore: row.overallScore,
            racialEquity: row.racialEquityScore,
            economicJustice: row.economicJusticeScore,
            algorithmicBias: row.algorithmicBiasScore,
            laborRights: row.laborRightsScore,
            privacySurveillance: row.privacySurveillanceScore,
            overallRationale: row.overallRationale,
          } : null,
        });
      }
    }

    return c.json({ data: grouped } as any, 200);
  } catch (err: any) {
    return c.json({ error: err.message } as any, 500);
  }
});

export { policyRouter };

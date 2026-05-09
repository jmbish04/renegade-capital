/**
 * @fileoverview PolicyChatAgent — Cloudflare Agents SDK Durable Object for the Policy page.
 *
 * Uses AIChatAgent from @cloudflare/ai-chat to provide a stateful, WebSocket-connected
 * chat experience with automatic message persistence in DO SQLite storage.
 *
 * AI Provider: Uses `getConfiguredAgent()` from `../../ai/agents.ts` which returns an
 * `@openai/agents` Agent configured for Cloudflare AI Gateway + gpt-oss-120b.
 * This matches the established pattern in `src/backend/api/routes/chat.ts`.
 *
 * Tools are defined using `@openai/agents` `tool()` (not Vercel AI SDK `tool()`),
 * providing Vectorize RAG search, D1 policy/guest/episode lookups, and tag taxonomy.
 *
 * Policy Mention Tracking:
 * When tools reference trump_policy_page records (via search or page detail lookup),
 * the page IDs and AI rationale are accumulated in a `policyMentionBuffer`. After
 * the agent run completes, these are flushed to the `chat_trump_policy_mentions`
 * D1 table linked to the current thread's assistant message.
 *
 * The DO class is exported from `_worker.ts` and bound as policy_CHAT_AGENT in wrangler.jsonc.
 */

import { AIChatAgent } from "@cloudflare/ai-chat";
import { run, tool } from "@openai/agents";
import { createAiSdkUiMessageStreamResponse } from "@openai/agents-extensions/ai-sdk-ui";
import { getConfiguredAgent } from "@/backend/ai/agents";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import * as schema from "@/backend/db/schema";

// ─── Policy Mention Buffer ──────────────────────────────────────────────────────
// Collects policy page references during tool execution, then flushed to D1
// after the agent run completes.

export interface PolicyMention {
  policyPageId: number;
  pageNum: number;
  imageUrl: string | null;
  aiRationale: string;
}

// Module-level buffer for current run. Reset before each onChatMessage.
let policyMentionBuffer: PolicyMention[] = [];

export function getPolicyMentionBuffer() {
  return policyMentionBuffer;
}

export function clearPolicyMentionBuffer() {
  policyMentionBuffer = [];
}

/**
 * Log a policy page mention during tool execution.
 * Called by search and page-detail tools when they surface policy pages.
 */
export function logPolicyMention(pageId: number, pageNum: number, imageUrl: string | null, rationale: string): void {
  // Deduplicate by pageId within the same run
  if (!policyMentionBuffer.some((m) => m.policyPageId === pageId)) {
    policyMentionBuffer.push({ policyPageId: pageId, pageNum, imageUrl, aiRationale: rationale });
  }
}

// ─── Tool Factories ─────────────────────────────────────────────────────────────
// Each factory takes Env to access bindings (D1, Vectorize, AI).
// Uses @openai/agents tool() — NOT the Vercel AI SDK tool().

/**
 * Creates the Vectorize RAG search tool with reranking.
 *
 * 3-stage pipeline:
 *   1. Embed via env.AI_MODEL_EMBEDDINGS
 *      Input:  { text: string[] }
 *      Output: { data: number[][], shape: number[] }
 *
 *   2. Over-fetch candidates from Vectorize (10 for reranking → final 5)
 *
 *   3. Rerank via env.AI_MODEL_RERANKING
 *      Input:  { query: string, contexts: Array<{ text: string }>, top_k?: number }
 *      Output: { response: Array<{ id: number, score: number }> }
 *      - id = 0-based index into contexts array
 *      - score = reranker relevance (higher = better)
 *
 * Logs all surfaced pages to the policyMentionBuffer for D1 tracking.
 */
export const createSearchPolicyTool = (env: Env) =>
  tool({
    name: "searchPolicyVectorize",
    description:
      "Search the Trump AI Action Plan policy document using semantic vector search with reranking. Returns the most relevant page chunks with page numbers, content, and analysis.",
    parameters: z.object({
      query: z
        .string()
        .describe("The search query about AI policy or social justice"),
    }),
    execute: async ({ query }) => {
      try {
        const db = drizzle(env.DB);

        // Stage 1: Generate embedding for the query
        // bge-large-en-v1.5 input: { text: string | string[] }
        // bge-large-en-v1.5 output: { data: number[][], shape: number[] }
        const embeddingResult = await env.AI.run(
          env.AI_MODEL_EMBEDDINGS as any,
          { text: [query] },
        ) as any;
        const queryVector = embeddingResult.data?.[0];
        if (!queryVector) return { error: "Failed to generate embedding" };

        // Stage 2: Over-fetch from Vectorize (10 candidates for reranking)
        const matches = await env.VECTORIZE.query(queryVector, {
          topK: 10,
          returnMetadata: "all",
        });

        // Enrich candidates with D1 page data (including page.id for mention tracking)
        const candidates: Array<{
          pageId: number | null;
          vectorScore: number;
          pageNum: number | null;
          content: string;
          summary: string | null;
          analysis: string | null;
          imageUrl: string | null;
        }> = [];

        for (const match of matches.matches) {
          const pageRecord = await db
            .select()
            .from(schema.trumpPolicyPage)
            .where(eq(schema.trumpPolicyPage.uuid, match.id))
            .get();

          candidates.push({
            pageId: pageRecord?.id ?? null,
            vectorScore: match.score,
            pageNum:
              pageRecord?.pageNum ?? (match.metadata as any)?.page_num,
            content:
              pageRecord?.pageContent?.substring(0, 500) ??
              "Content not found in D1",
            summary: pageRecord?.aiSummary ?? null,
            analysis: pageRecord?.aiAnalysis ?? null,
            imageUrl: pageRecord?.pageImageUrl ?? null,
          });
        }

        if (candidates.length === 0) {
          return { matches: [], totalHits: 0 };
        }

        // Stage 3: Rerank via bge-reranker-base
        // Input:  { query, contexts: Array<{ text: string }>, top_k? }
        // Output: { response: Array<{ id: number, score: number }> }
        try {
          const contexts = candidates.map((c) => ({
            text: [c.summary, c.content].filter(Boolean).join("\n\n") || "No content",
          }));

          const rerankResult = await env.AI.run(
            env.AI_MODEL_RERANKING as any,
            { query, contexts, top_k: 5 },
          ) as any;

          // rerankResult.response: Array<{ id: number, score: number }>
          // id = 0-based index into contexts array
          const reranked = (rerankResult.response || [])
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 5)
            .map((item: any) => {
              const c = candidates[item.id];

              // Track mention for D1 logging
              if (c?.pageId && c?.pageNum) {
                logPolicyMention(
                  c.pageId,
                  c.pageNum,
                  c.imageUrl ?? null,
                  `Vectorize search hit (query: "${query}", rerank score: ${item.score.toFixed(3)})`,
                );
              }

              return {
                rerankScore: item.score,
                vectorScore: c?.vectorScore,
                pageNum: c?.pageNum,
                content: c?.content,
                summary: c?.summary,
                analysis: c?.analysis,
                imageUrl: c?.imageUrl,
              };
            });

          return { matches: reranked, totalHits: matches.count, reranked: true };
        } catch (rerankErr: any) {
          // Fallback to vector-scored results if reranker fails
          console.error("Reranker failed:", rerankErr);

          const fallbackResults = candidates.slice(0, 5);

          // Track mentions even in fallback path
          for (const c of fallbackResults) {
            if (c.pageId && c.pageNum) {
              logPolicyMention(
                c.pageId,
                c.pageNum,
                c.imageUrl ?? null,
                `Vectorize search hit (query: "${query}", vector score: ${c.vectorScore.toFixed(3)}, reranker unavailable)`,
              );
            }
          }

          return {
            matches: fallbackResults.map((c) => ({
              score: c.vectorScore,
              pageNum: c.pageNum,
              content: c.content,
              summary: c.summary,
              analysis: c.analysis,
              imageUrl: c.imageUrl,
            })),
            totalHits: matches.count,
            reranked: false,
          };
        }
      } catch (err: any) {
        return { error: `Vectorize search failed: ${err.message}` };
      }
    },
  });

/**
 * Creates the policy page detail lookup tool.
 * Fetches full analysis for a specific page by page number from D1.
 * Also logs the page mention for tracking.
 */
export const createGetPageDetailsTool = (env: Env) =>
  tool({
    name: "getPolicyPageDetails",
    description:
      "Get full details for a specific policy page by page number, including AI analysis and organizing strategies.",
    parameters: z.object({
      pageNum: z.number().describe("The page number (1-indexed)"),
    }),
    execute: async ({ pageNum }) => {
      const db = drizzle(env.DB);

      const page = await db
        .select()
        .from(schema.trumpPolicyPage)
        .where(eq(schema.trumpPolicyPage.pageNum, pageNum))
        .get();

      if (!page) return { error: `Page ${pageNum} not found` };

      // Track mention for D1 logging
      if (page.pageNum) {
        logPolicyMention(
          page.id,
          page.pageNum,
          page.pageImageUrl,
          `Direct page detail lookup for page ${pageNum}`,
        );
      }

      // Get associated tags
      const tags = await db
        .select({
          tagName: schema.trumpPolicyTag.name,
          typeName: schema.trumpPolicyTagType.name,
          rationale: schema.trumpPolicyPageTagMap.aiRationale,
        })
        .from(schema.trumpPolicyPageTagMap)
        .innerJoin(
          schema.trumpPolicyTag,
          eq(schema.trumpPolicyPageTagMap.tagId, schema.trumpPolicyTag.id),
        )
        .innerJoin(
          schema.trumpPolicyTagType,
          eq(schema.trumpPolicyTag.typeId, schema.trumpPolicyTagType.id),
        )
        .where(eq(schema.trumpPolicyPageTagMap.pageId, page.id))
        .all();

      return { page, tags };
    },
  });

/**
 * Creates the guest search tool.
 * Searches the podcast guests database by name or expertise keywords.
 */
export const createSearchGuestsTool = (env: Env) =>
  tool({
    name: "searchGuests",
    description:
      "Search for podcast guest experts by name or area of expertise. Returns matching guests with background and headshot.",
    parameters: z.object({
      query: z
        .string()
        .describe("Name or expertise keyword to search for"),
    }),
    execute: async ({ query }) => {
      const db = drizzle(env.DB);
      const allGuests = await db.select().from(schema.guests);

      // Filter in-app since D1 LIKE is limited
      const filtered = allGuests.filter(
        (g) =>
          g.name.toLowerCase().includes(query.toLowerCase()) ||
          g.expertise.toLowerCase().includes(query.toLowerCase()) ||
          g.background.toLowerCase().includes(query.toLowerCase()),
      );

      return {
        guests: filtered.map((g) => ({
          id: g.id,
          name: g.name,
          expertise: JSON.parse(g.expertise),
          background: g.background,
          headshotUrl: g.headshotUrl,
          affiliation: g.affiliation,
        })),
        count: filtered.length,
      };
    },
  });

/**
 * Creates the episode search tool.
 * Searches existing and AI-generated episode ideas by title or description.
 */
export const createSearchEpisodesTool = (env: Env) =>
  tool({
    name: "searchEpisodes",
    description:
      "Search episode ideas and matchups by title or topic. Returns episodes with descriptions.",
    parameters: z.object({
      query: z
        .string()
        .describe("Topic or keyword to search episodes for"),
    }),
    execute: async ({ query }) => {
      const db = drizzle(env.DB);
      const allEpisodes = await db.select().from(schema.episodes);

      const filtered = allEpisodes.filter(
        (e) =>
          e.title.toLowerCase().includes(query.toLowerCase()) ||
          e.description.toLowerCase().includes(query.toLowerCase()),
      );

      return { episodes: filtered, count: filtered.length };
    },
  });

/**
 * Creates the tag taxonomy browser tool.
 * Returns the full hierarchical tag taxonomy for policy classification.
 */
export const createGetTagHierarchyTool = (env: Env) =>
  tool({
    name: "getTagHierarchy",
    description:
      "Get the full tag taxonomy hierarchy used to classify policy content.",
    parameters: z.object({}),
    execute: async () => {
      const db = drizzle(env.DB);
      const types = await db.select().from(schema.trumpPolicyTagType).all();
      const tags = await db.select().from(schema.trumpPolicyTag).all();

      return {
        types,
        tags: tags.map((t) => ({
          ...t,
          typeName:
            types.find((tt) => tt.id === t.typeId)?.name ?? "Unknown",
        })),
      };
    },
  });

// ─── Agent Class ────────────────────────────────────────────────────────────────

export class PolicyAgent extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages using the established @openai/agents pattern.
   *
   * Uses `getConfiguredAgent()` from `../../ai/agents.ts` to get an Agent
   * configured for Cloudflare AI Gateway with gpt-oss-120b, then runs it
   * with `run()` and streams the result via `createAiSdkUiMessageStreamResponse()`.
   *
   * After the agent run, flushes accumulated policy page mentions to the
   * `chat_trump_policy_mentions` D1 table. The mentions are linked to the
   * most recent assistant message in the thread.
   */
  async onChatMessage(onFinish: Parameters<AIChatAgent["onChatMessage"]>[0]) {
    // Reset the mention buffer for this run
    clearPolicyMentionBuffer();

    try {
      const agent = await getConfiguredAgent(this.env, "policy", [
        createSearchPolicyTool(this.env),
        createGetPageDetailsTool(this.env),
        createSearchGuestsTool(this.env),
        createSearchEpisodesTool(this.env),
        createGetTagHierarchyTool(this.env),
      ]);

      // Convert AIChatAgent's this.messages to the format @openai/agents expects
      const messages = this.messages.map((m: any) => ({
        role: m.role as "user" | "assistant" | "system",
        content:
          typeof m.content === "string"
            ? m.content
            : m.parts
                ?.filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("\n") ?? "",
      }));

      const stream = await run(agent, messages as any, { stream: true });

      const response = createAiSdkUiMessageStreamResponse(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });

      // Flush policy mentions to D1 asynchronously after response starts streaming.
      // We use waitUntil (via ctx.waitUntil or a fire-and-forget) since the DO
      // keeps running after the response starts streaming.
      this.flushPolicyMentions().catch((err) =>
        console.error("[PolicyChatAgent] Failed to flush mentions:", err),
      );

      return response;
    } catch (error) {
      console.error("[PolicyChatAgent] Error:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to stream response",
          details:
            error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  /**
   * Flush accumulated policy page mentions to D1.
   *
   * Creates a thread + assistant message record in D1 if they don't exist,
   * then inserts all buffered mentions into `chat_trump_policy_mentions`.
   */
  private async flushPolicyMentions(): Promise<void> {
    const mentions = [...getPolicyMentionBuffer()];
    clearPolicyMentionBuffer();

    if (mentions.length === 0) return;

    const db = drizzle(this.env.DB);

    try {
      // Get or create the thread for this DO session
      const doName = this.name; // DO instance name = session identifier

      // Find the thread by matching the DO name stored in location metadata
      let thread = await db
        .select()
        .from(schema.threads)
        .where(eq(schema.threads.title, `Policy Chat: ${doName}`))
        .get();

      if (!thread) {
        const [newThread] = await db
          .insert(schema.threads)
          .values({
            title: `Policy Agent: ${doName}`,
            userId: 1,
          })
          .returning();
        thread = newThread;
      }

      // Create an assistant message record to link mentions to
      const [assistantMsg] = await db
        .insert(schema.messages)
        .values({
          threadId: thread.id,
          role: "assistant",
          content: `[Policy pages referenced: ${mentions.map((m) => m.policyPageId).join(", ")}]`,
          metadata: JSON.stringify({
            source: "policy-agent",
            doName,
            mentionCount: mentions.length,
          }),
        })
        .returning();

      // Insert all mention records
      for (const mention of mentions) {
        await db.insert(schema.chatTrumpPolicyMentions).values({
          messageId: assistantMsg.id,
          policyPageId: mention.policyPageId,
          aiRationale: mention.aiRationale,
        });
      }

      console.log(
        `[PolicyChatAgent] Flushed ${mentions.length} policy mentions for thread ${thread.id}, message ${assistantMsg.id}`,
      );
    } catch (err) {
      console.error("[PolicyChatAgent] flushPolicyMentions error:", err);
    }
  }
}

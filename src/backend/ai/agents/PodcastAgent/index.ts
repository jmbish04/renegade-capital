/**
 * @fileoverview PodcastAgent — Cloudflare Agents SDK Durable Object for the Podcast page.
 *
 * Uses AIChatAgent from @cloudflare/ai-chat to provide a stateful, WebSocket-connected
 * chat experience with automatic message persistence in DO SQLite storage.
 *
 * AI Provider: Uses `getConfiguredAgent()` from `../../ai/agents.ts` which returns an
 * `@openai/agents` Agent configured for Cloudflare AI Gateway + gpt-oss-120b.
 *
 * Tools: Search guests, search episodes, and manage episode notes (create/modify).
 */

import { AIChatAgent } from "@cloudflare/ai-chat";
import { run, tool } from "@openai/agents";
import { createAiSdkUiMessageStreamResponse } from "@openai/agents-extensions/ai-sdk-ui";
import { getConfiguredAgent } from "@/backend/ai/agents";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/backend/db/schema";

// ─── Tool Factories ─────────────────────────────────────────────────────────────

const createSearchGuestsTool = (env: Env) =>
  tool({
    name: "searchGuests",
    description: "Search for podcast guest experts by name or area of expertise. Returns matching guests with background.",
    parameters: z.object({
      query: z.string().describe("Name or expertise keyword to search for"),
    }),
    execute: async ({ query }) => {
      const db = drizzle(env.DB);
      const allGuests = await db.select().from(schema.guests);

      const filtered = allGuests.filter(
        (g) =>
          g.name.toLowerCase().includes(query.toLowerCase()) ||
          g.expertise.toLowerCase().includes(query.toLowerCase()) ||
          g.background.toLowerCase().includes(query.toLowerCase()),
      );

      return { guests: filtered, count: filtered.length };
    },
  });

const createSearchEpisodesTool = (env: Env) =>
  tool({
    name: "searchEpisodes",
    description: "Search episode ideas and matchups by title or topic. Returns episodes with descriptions.",
    parameters: z.object({
      query: z.string().describe("Topic or keyword to search episodes for"),
    }),
    execute: async ({ query }) => {
      const db = drizzle(env.DB);
      const allEpisodes = await db.select().from(schema.episodes).where(eq(schema.episodes.isActive, true));

      const filtered = allEpisodes.filter(
        (e) =>
          e.title.toLowerCase().includes(query.toLowerCase()) ||
          e.description.toLowerCase().includes(query.toLowerCase()),
      );

      return { episodes: filtered, count: filtered.length };
    },
  });

const createEpisodeNote = (env: Env) =>
  tool({
    name: "createEpisodeNote",
    description: "Create a new note for an episode matchup. Saves the note directly to the database.",
    parameters: z.object({
      episodeId: z.string().describe("The UUID of the episode to attach the note to"),
      content: z.string().describe("The content of the note"),
    }),
    execute: async ({ episodeId, content }) => {
      const db = drizzle(env.DB);
      await db.insert(schema.episodeNotes).values({
        episodeId,
        content,
        isActive: true,
      });
      return { success: true, message: "Note created successfully." };
    },
  });

const modifyEpisodeNote = (env: Env) =>
  tool({
    name: "modifyEpisodeNote",
    description: "Modify an existing episode note by performing a soft-delete on the old note and inserting a revised one.",
    parameters: z.object({
      noteId: z.number().describe("The integer ID of the existing note to modify"),
      episodeId: z.string().describe("The UUID of the episode"),
      newContent: z.string().describe("The revised content of the note"),
    }),
    execute: async ({ noteId, episodeId, newContent }) => {
      const db = drizzle(env.DB);
      
      // Soft-delete the old note
      await db
        .update(schema.episodeNotes)
        .set({ isActive: false })
        .where(eq(schema.episodeNotes.id, noteId));

      // Insert the new note
      const [newNote] = await db.insert(schema.episodeNotes).values({
        episodeId,
        content: newContent,
        isActive: true,
      }).returning();

      return { success: true, message: "Note modified successfully.", newNoteId: newNote?.id };
    },
  });

// ─── Agent Class ────────────────────────────────────────────────────────────────

export class PodcastAgent extends AIChatAgent<Env> {
  async onChatMessage(onFinish: Parameters<AIChatAgent["onChatMessage"]>[0]) {
    try {
      const agent = await getConfiguredAgent(this.env, "podcast", [
        createSearchGuestsTool(this.env),
        createSearchEpisodesTool(this.env),
        createEpisodeNote(this.env),
        modifyEpisodeNote(this.env),
      ]);

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

      // Synchronize thread metadata for DO persistence logging
      this.syncThreadMetadata().catch((err) =>
        console.error("[PodcastAgent] Failed to sync thread metadata:", err),
      );

      return response;
    } catch (error) {
      console.error("[PodcastAgent] Error:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to stream response",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  private async syncThreadMetadata(): Promise<void> {
    try {
      const db = drizzle(this.env.DB);
      const doName = this.env.PODCAST_AGENT.idFromName("default").toString();
      
      let thread = await db
        .select()
        .from(schema.threads)
        .where(eq(schema.threads.title, `Podcast Agent: ${doName}`))
        .get();

      if (!thread) {
        const [newThread] = await db
          .insert(schema.threads)
          .values({
            title: `Podcast Agent: ${doName}`,
            userId: 1,
          })
          .returning();
        thread = newThread;
      }
      
      const assistantMsg = this.messages[this.messages.length - 1];
      if (thread && assistantMsg && assistantMsg.role === "assistant") {
        await db.insert(schema.messages).values({
          threadId: thread.id,
          role: "assistant",
          content: "[Podcast Agent interaction]",
          metadata: JSON.stringify({
            source: "podcast-agent",
            doName,
          }),
        });
      }
    } catch (err) {
      console.error("[PodcastAgent] syncThreadMetadata error:", err);
    }
  }
}

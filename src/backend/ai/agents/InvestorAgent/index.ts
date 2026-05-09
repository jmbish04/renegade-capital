/**
 * @fileoverview InvestorAgent — Cloudflare Agents SDK Durable Object for the Finance/Investor page.
 *
 * Uses AIChatAgent from @cloudflare/ai-chat to provide a stateful, WebSocket-connected
 * chat experience with automatic message persistence in DO SQLite storage.
 *
 * AI Provider: Uses `getConfiguredAgent()` from `../../ai/agents.ts` which returns an
 * `@openai/agents` Agent configured for Cloudflare AI Gateway + gpt-oss-120b.
 *
 * Tools: Interactive data tables, charts, and questionnaires.
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

const createQuestionFlowTool = (env: Env) =>
  tool({
    name: "questionFlow",
    description: "Render an interactive questionnaire flow to gather structured data from the investor. Use 'choice' type for multiple-choice questions.",
    parameters: z.object({
      steps: z.array(
        z.object({
          id: z.string().describe("A unique string identifier for this question (e.g., 'risk_tolerance')"),
          question: z.string().describe("The text of the question to ask"),
          type: z.enum(["text", "choice"]).describe("The type of question. Use 'choice' for multiple-choice questions, and 'text' for free-form input."),
          options: z.array(z.string()).optional().describe("Array of string options for the user to choose from. Required if type is 'choice'."),
        })
      ).describe("The steps of the questionnaire"),
    }),
    execute: async ({ steps }) => {
      // The UI handles the rendering and gathering answers.
      // We just emit the tool call to trigger it on the client.
      return { success: true, message: "Question flow emitted to client." };
    },
  });

const createRenderDataTableTool = (env: Env) =>
  tool({
    name: "renderDataTable",
    description: "Render a structured data table to the investor.",
    parameters: z.object({
      title: z.string().describe("Title of the data table"),
      columns: z.array(
        z.object({
          key: z.string().describe("The data key for this column"),
          label: z.string().describe("The human-readable header label for this column"),
        })
      ).describe("Columns for the table"),
      data: z.array(z.record(z.string(), z.any())).describe("The rows of data"),
    }),
    execute: async ({ title, columns, data }) => {
      return { success: true, title, columns, data };
    },
  });

const createRenderChartTool = (env: Env) =>
  tool({
    name: "renderChart",
    description: "Render an interactive chart to visualize financial or social impact data.",
    parameters: z.object({
      title: z.string().describe("Title of the chart"),
      xKey: z.string().describe("The key used for the X-axis"),
      series: z.array(
        z.object({
          key: z.string().describe("The data key to plot on the Y-axis"),
          label: z.string().describe("The human-readable name of the series"),
          color: z.string().optional(),
        })
      ).describe("The data series to plot"),
      data: z.array(z.record(z.string(), z.any())).describe("The dataset"),
    }),
    execute: async ({ title, xKey, series, data }) => {
      return { success: true, title, xKey, series, data };
    },
  });

// ─── Agent Class ────────────────────────────────────────────────────────────────

export class InvestorAgent extends AIChatAgent<Env> {
  async onChatMessage(onFinish: Parameters<AIChatAgent["onChatMessage"]>[0]) {
    try {
      const agent = await getConfiguredAgent(this.env, "investor", [
        createQuestionFlowTool(this.env),
        createRenderDataTableTool(this.env),
        createRenderChartTool(this.env),
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
        console.error("[InvestorAgent] Failed to sync thread metadata:", err),
      );

      return response;
    } catch (error) {
      console.error("[InvestorAgent] Error:", error);
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
      const doName = this.env.INVESTOR_AGENT.idFromName("default").toString();
      
      let thread = await db
        .select()
        .from(schema.threads)
        .where(eq(schema.threads.title, `Investor Agent: ${doName}`))
        .get();

      if (!thread) {
        const [newThread] = await db
          .insert(schema.threads)
          .values({
            title: `Investor Agent: ${doName}`,
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
          content: "[Investor Agent interaction]",
          metadata: JSON.stringify({
            source: "investor-agent",
            doName,
          }),
        });
      }
    } catch (err) {
      console.error("[InvestorAgent] syncThreadMetadata error:", err);
    }
  }
}

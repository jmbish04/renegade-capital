Contacting Cloudflare Docs Agent (Session: docs-1778104449930)...

Cloudflare Docs Agent:
Below is a **step‑by‑step guide** to build a **Cloudflare Agents‑SDK powered AI chat agent** that talks to a **React‑based “assistant‑UI” front‑end** (the UI library that Cloudflare ships for chat‑style interfaces).  
All of the snippets are taken from the official documentation that was returned in the search results.

---

## 1️⃣ Prerequisites

| Item | Why you need it |
|------|-----------------|
| **Node ≥ 18** | Runs the starter CLI & the Workers dev server |
| **Wrangler 2.x** (`npm i -g wrangler`) | Deploys the Worker that hosts the agent |
| **A Cloudflare account** | Needed to create a Workers AI binding (`AI`) |
| **Git** (optional) | To clone the starter repo |

---

## 2️⃣ Create the starter project

The easiest way to get a fully‑working example is the **Agents‑Starter** template:

```bash
# This pulls the template and installs everything for you
npm create cloudflare@latest agents-starter -- --template="cloudflare/agents-starter"

# Then follow the README that the command created
# (it will install deps, generate a .dev.vars file, etc.)
```

> The starter already contains a **React front‑end** that uses the `assistant-ui` components and the **Agents SDK** hooks (`useAgentChat`).  
> If you prefer to add the SDK to an existing Workers project, you can simply run `npm i agents` and start importing from `"agents"`.

---

## 3️⃣ Server side – define the **AI chat agent**

The core of the chat‑agent lives in `src/server.ts`.  
You extend `AIChatAgent` (provided by **@cloudflare/ai-chat**) and use the **AI SDK** (`ai` package) to stream responses from a Workers AI model.

```ts
// src/server.ts
import { AIChatAgent } from "@cloudflare/ai-chat";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages } from "ai";

export class ChatAgent extends AIChatAgent {
  /**
   * Called for every incoming user message.
   * `this.messages` holds the full conversation history (persisted automatically).
   */
  async onChatMessage() {
    // Workers‑AI provider – the binding name must match the one in wrangler.toml (default: AI)
    const workersAI = createWorkersAI({ binding: this.env.AI });

    // Stream a response from any model that implements the OpenAI‑compatible API.
    // Example model: @cf/zai-org/glm-4.7-flash (no API key needed)
    const result = streamText({
      model: workersAI("@cf/zai-org/glm-4.7-flash"),
      messages: await convertToModelMessages(this.messages), // ↳ converts internal format → AI SDK format
    });

    // Convert the stream into the shape that `assistant-ui` expects.
    // The helper automatically handles chunked responses, retries, and UI‑friendly SSE.
    return result.toUIMessageStreamResponse();
  }
}
```

### Adding **tool calling** (optional)

If you want the LLM to be able to call other agents (e.g. a “Researcher” tool) you can expose them with `agentTool()`:

```ts
import { Think } from "@cloudflare/think";
import { agentTool } from "agents/agent-tools";
import { z } from "zod";

export class Researcher extends Think {
  getSystemPrompt() {
    return "Research the user's topic and end with a concise summary.";
  }
}

export class Assistant extends Think {
  getTools() {
    return {
      research: agentTool(Researcher, {
        description: "Research one topic in depth.",
        displayName: "Researcher",
        inputSchema: z.object({ query: z.string().min(3) }),
      }),
    };
  }
}
```

You can then call `this.runTool("research", { query: "..." })` from inside `onChatMessage()` or from a downstream agent.

---

## 4️⃣ Deploy the Worker

Add the Workers‑AI binding to `wrangler.toml` (the starter already includes it):

```toml
# wrangler.toml
[env.production]
workers_dev = true
compatibility_date = "2024-11-01"

[[kv_namespaces]]
binding = "AI"
id = "your‑ai‑binding‑id"
```

Deploy:

```bash
wrangler deploy
# or for local dev:
wrangler dev
```

The agent is now reachable at `https://<your‑project>.workers.dev/agent/chat` (the exact route is defined in `src/routes.ts` of the starter).

---

## 5️⃣ Front‑end – using **assistant‑ui** with the Agents SDK

The starter’s React app (`src/client.tsx`) already wires everything up, but here’s the essential part so you can adapt it or understand how it works.

### 5.1 Install the UI library

```bash
npm i @cloudflare/assistant-ui
# The SDK & React hooks are already in the `agents` package
npm i agents
```

### 5.2 Hook the chat UI to the agent

```tsx
// src/client.tsx
import React from "react";
import {
  Chat,
  ChatMessage,
  ChatHeader,
  ChatInput,
  ChatMessageList,
} from "@cloudflare/assistant-ui";
import { useAgentChat } from "agents/react";

export default function App() {
  // `useAgentChat` creates a WebSocket connection to the Worker,
  // handles state syncing, streaming, and reconnection.
  const {
    messages,          // array of UI‑ready messages
    sendMessage,       // function to push a new user message
    isSending,         // UI state while the LLM streams
    error,             // any transport or agent error
  } = useAgentChat({
    // The name must match the Agent class you exported in server.ts
    agent: "ChatAgent",
    // Optional: custom headers, auth token, etc.
  });

  return (
    <Chat>
      <ChatHeader title="Cloudflare AI Assistant" />
      <ChatMessageList>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
      </ChatMessageList>

      <ChatInput
        disabled={isSending}
        onSend={(text) => sendMessage(text)}
        placeholder="Ask me anything…"
      />

      {error && <div style={{ color: "red" }}>{error.message}</div>}
    </Chat>
  );
}
```

**What happens under the hood**

| Hook / Component | What it does |
|------------------|--------------|
| `useAgentChat`   | Opens a **WebSocket** to the `/agent/chat` endpoint, syncs the conversation state (`this.messages` on the server) and returns a list of UI‑friendly message objects. |
| `ChatMessageList` / `ChatMessage` | Render the stream of messages (both user and assistant). |
| `ChatInput`      | Sends a new user message (`agent.stub.chat(message)` behind the scenes). |
| `isSending`      | Turns true while the LLM is streaming – perfect for disabling the input or showing a spinner. |

Because the server returns `result.toUIMessageStreamResponse()`, the streaming chunks are automatically translated into the shape `assistant-ui` expects (`role`, `content`, `id`, …). No extra client‑side parsing is required.

---

## 6️⃣ Using a **different model** with the **AI SDK** (optional)

If you prefer OpenAI, Anthropic, Gemini, etc., just swap the model inside `onChatMessage()`:

```ts
import { openai } from "@ai-sdk/openai";   // npm i @ai-sdk/openai
import { generateText } from "ai";

async onChatMessage() {
  const { text } = await generateText({
    model: openai("gpt-4o"),               // any OpenAI‑compatible endpoint
    messages: await convertToModelMessages(this.messages),
  });
  // Convert the simple text result into the UI stream format
  return new Response(JSON.stringify({ role: "assistant", content: text }));
}
```

The SDK works with **any OpenAI‑compatible provider**, so you could also call Google Gemini, Anthropic, or a self‑hosted server—just install the respective `@ai-sdk/*` package and reference the model name.

---

## 7️⃣ Full folder overview (from the starter)

```
/src
 ├─ server.ts          ← Agent definitions (ChatAgent, tools, etc.)
 ├─ client.tsx         ← React UI that uses @cloudflare/assistant-ui
 ├─ routes.ts          ← HTTP routing; maps /agent/chat → useAgent()
 └─ index.ts           ← Exported entry point for Wrangler
```

You can modify any of these files; the core pattern stays the same:

1. **Agent class** → `AIChatAgent` (or plain `Agent` for non‑chat use‑cases)  
2. **Streaming response** → `streamText(...).toUIMessageStreamResponse()`  
3. **Front‑end** → `useAgentChat` + `assistant-ui` components.

---

## 8️⃣ Quick recap checklist

| ✅ | Task |
|---|------|
| **Create** the starter (`npm create cloudflare@latest agents-starter …`) |
| **Define** `ChatAgent` that extends `AIChatAgent` and calls `streamText` |
| **(Optional)** Add tool(s) with `agentTool()` |
| **Deploy** with `wrangler dev` / `wrangler deploy` |
| **Install** `@cloudflare/assistant-ui` on the front‑end |
| **Connect** UI with `useAgentChat` and render messages |
| **Swap model** via the AI SDK if you need a different provider |

---

## 9️⃣ Where to find more details

* **Agents SDK changelog** – Feb 25 2025: https://developers.cloudflare.com/changelog/post/2025-02-25-agents-sdk/  
* **API reference – agent tools** – https://developers.cloudflare.com/agents/api-reference/agent-tools/  
* **Building a chat agent** – https://developers.cloudflare.com/agents/getting-started/build-a-chat-agent/  
* **Using AI models (ai‑sdk)** – https://developers.cloudflare.com/agents/api-reference/using-ai-models/  

If you follow the steps above you’ll have a fully functional, **state‑ful, streaming AI chat agent** backed by Cloudflare Workers AI, exposed through the **assistant‑UI** React components, and ready to add custom server‑side tools or swap in any OpenAI‑compatible model. Happy building!

Sources (Top 3):

✅ Response saved to clipboard.

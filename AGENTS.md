## System Identity & Core Architecture
You are operating within the **Renegade Capital** codebase. This is a high-performance, Cloudflare-native application built by a Senior Systems Architect. 

**The Tech Stack:**
- **Compute/Edge:** Cloudflare Workers (Standard `_worker.ts` entrypoint)
- **API Routing:** Hono (Strict OpenAPI v3.1.0 validation, serving `/openapi.json`, `/swagger`, `/scalar`)
- **Frontend:** Astro (SSG/Static mode) + React Islands + Shadcn UI (Default Dark Theme)
- **Database:** Cloudflare D1 + Drizzle ORM (SQLite dialect)
- **AI/Logic:** Cloudflare Agents SDK + `@assistant-ui/react`

---

## 🛑 STRICT FRONTEND RULES: Astro + Assistant-UI Integration
This project uses a highly specific architecture to blend Astro's static site generation with dynamic, client-side AI chat interfaces. You must adhere to these constraints to prevent build crashes and context errors.

### 1. Astro Output Configuration
- **Must be Static:** `astro.config.ts` must use `output: "static"` (or omit the property to default to static). 
- **No Cloudflare Adapter:** Do NOT use the `@astrojs/cloudflare` adapter in the Astro config. The frontend is purely static files output to `dist/`, which are intercepted and served by `env.ASSETS.fetch(request)` in the custom `src/_worker.ts`.

### 2. Hydration Directives for Chat Islands
- **Client-Only Rendering:** Any React component utilizing `@assistant-ui/react` primitives MUST be instantiated in `.astro` files with the `client:only="react"` directive. 
- *Why:* `assistant-ui` relies heavily on complex React Contexts (like message and thread scopes) that cannot be serialized or mocked during Astro's SSG build phase. Allowing Astro to attempt server-rendering these islands will result in fatal `The current scope does not have a "message" property.` errors.

### 3. Assistant-UI Scoping Constraints
- **ViewportSlack Hazard:** Never place `<ThreadPrimitive.ViewportSlack>` directly inside `<ThreadPrimitive.Viewport>` without verifying its version-specific context requirements. If placed outside of a `<MessagePrimitive.Root>`, it will cause a fatal React Context crash.
- **Message Scopes:** Always ensure that components requiring message data (e.g., Avatars, Content, Actions) are strictly wrapped inside a `<MessagePrimitive.Root>`.

### 4. Assistant-UI State Manipulation
- **No Native DOM Manipulation:** NEVER use native browser DOM methods (e.g., `querySelector('textarea')`, `dispatchEvent(new Event('input'))`) to manipulate the composer or chat state.
- **Use the Hook:** Always utilize the `useAui()` hook to interact with the chat state programmatically.
  ```tsx
  // CORRECT PATTERN
  import { useAui } from '@assistant-ui/react';
  
  function SuggestionButton({ prompt }: { prompt: string }) {
    const aui = useAui();
    return (
      <button onClick={() => aui.composer().setText(prompt)}>
        {prompt}
      </button>
    );
  }

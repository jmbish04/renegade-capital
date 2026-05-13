# Feature Implementation Workflow

## Overview
This workflow defines the standard operating procedure for implementing new features or making structural changes to the Renegade Capital platform. It ensures that all modifications align with the core media standards and architectural constraints defined in `.agent/rules/`.

## Phase 1: Context & Validation
1. **Rule Check:** Before modifying any generator script (`scripts/`), review `.agent/rules/media-standards.md` to ensure the proposed change does not violate tone, visual, or metadata constraints.
2. **Architecture Check:** If modifying the frontend, review `AGENTS.md` (specifically the Astro + Assistant-UI integration rules) to prevent breaking SSG builds or React Context isolation.
3. **Data Integrity:** Verify if the change requires updating the relational D1 mappings (e.g., adding a new policy or guest relationship).

## Phase 2: Execution
1. **Backend First:** Implement any required database schema changes or API route updates (`src/backend/api/`).
2. **Pipeline Integration:** Update the Python RAG/Audio ingestion scripts (`scripts/`) to populate the new data structures. Ensure strict Pydantic model enforcement.
3. **Frontend Hydration:** Update Astro/React components (`src/frontend/`) to consume the new API payloads. Avoid placing context-dependent React components outside of their required `assistant-ui` roots.

## Phase 3: Verification
1. **Local Testing:** Run the dev server (`npm run dev`) and verify UI rendering.
2. **Script Validation:** Trigger a dry run of the modified Python script to ensure successful AI Gateway routing and correct JSON schema returns.
3. **Observability:** Check `deploy:tail` to ensure no silent failures or memory leaks are introduced in the Cloudflare Worker.

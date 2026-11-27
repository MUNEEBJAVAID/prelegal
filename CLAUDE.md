# Prelegal Project

## Overview

This is a SaaS product that lets users draft legal agreements based on the templates in `templates/`.
The user chats with an AI to establish which document they want and how to fill in its fields.
The available documents are listed in `catalog.json` in the project root, included here:

@catalog.json

**Target for V1:** every document type in the catalog, drafted via AI chat, with real user authentication and document persistence. See "Current status" below for what exists today.

The templates are Common Paper standards (CC BY 4.0). Treat them as source documents and don't reword them.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira (tickets are `PL-N`)
2. Develop the feature. Don't skip any step of the 7-step feature-dev process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your GitHub tools
5. The GitHub MCP token can't merge (403) and `gh` isn't installed, so merge locally: `git checkout main && git pull --ff-only && git merge --no-ff <branch> && git push origin main`, then move the Jira ticket to Done and stay on `main`

Branches are named `feature/PL-N-short-name` and commit messages start with `PL-N: `.

## AI design

When writing code that calls LLMs, use your Cerebras skill to call the `openrouter/openai/gpt-oss-120b` model through LiteLLM via OpenRouter, with Cerebras as the inference provider. Use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an `OPENROUTER_API_KEY` in the `.env` file in the project root. The backend loads it itself at startup; never print or commit its value.

## Technical design

The entire project should be packaged into a Docker container.
The backend lives in `backend/` and is a uv project using FastAPI.
The frontend lives in `frontend/`.
The database is SQLite and is created from scratch each time the app starts, with a users table for sign up and sign in.
The frontend is statically built and served by FastAPI.
`scripts/` has start and stop scripts for each platform:
```bash
scripts/start-mac.sh      scripts/stop-mac.sh
scripts/start-linux.sh    scripts/stop-linux.sh
scripts/start-windows.ps1 scripts/stop-windows.ps1
```
The app is available at http://localhost:8000.

## Commands

```bash
# Backend (from backend/)
uv run prelegal-backend            # API + static frontend on :8000
uv run pytest                      # all backend tests
uv run pytest tests/test_auth.py   # one file

# Frontend (from frontend/)
npm run dev                        # :3000, proxies /api to the backend on :8000
npm test                           # Vitest; one file: npx vitest run src/lib/nda.test.ts
npm run lint
npm run build                      # static export to frontend/out/
```

## Architecture notes

- **LLM:** `backend/src/prelegal_backend/llm.py` has `complete_structured(messages, Schema)`, which returns a validated Pydantic model. Schemas must be strict: `extra="forbid"`, with every field required, using `| None` for "no value". The callable lives in `app.state.llm`, so tests pass a fake with `create_app(settings, llm=fake)` and never hit the network. LiteLLM is imported lazily and warmed in a background thread at startup, because the import takes about 15 seconds. The backend loads the repo-root `.env` itself.
- **Backend:** `create_app(settings, llm)` in `backend/src/prelegal_backend/main.py`. Routers are mounted under `/api`, and the static frontend (`FRONTEND_DIR`, default `frontend/out`) is mounted last at `/`. The lifespan hook runs `init_db()`, which deletes and recreates the SQLite file (`DATABASE_PATH`). It uses the standard-library `sqlite3`, not an ORM. Tests pass a `Settings` that points at `tmp_path`.
- **Frontend static export:**
  - `next.config.ts` sets `output: "export"` and `trailingSlash` for builds, and in `next dev` rewrites `/api` to the backend instead.
  - Export mode rules out PPR, `cacheComponents`, `"use cache"`, server actions, route handlers and dynamic server rendering.
  - Server components may only read files at build time. For example, `lib/standardTerms.ts` reads `../templates/Mutual-NDA.md` relative to `frontend/`.
- **Document registry:** `documents.json` at the repo root is the single source of truth for supported document types. It defines their parties (each role expands to `<role>.company/.name/.title/.noticeAddress`) and their fields; shared fields live in `commonFields`. The backend (`documents.py`) and the frontend (`lib/registry.ts`, read at build time by `lib/catalog.server.ts`) both expand it, so keep the two in sync. A field's label, plus its `refs` aliases, is the template term it defines. A test asserts that every term each template references resolves to a party or field.
- **Generic documents:** `parseClauses` (`lib/terms.ts`) parses any template's nested list. `buildGenericDocument` (`lib/genericDocument.ts`) generates the cover page, signature table and Standard Terms, using the same `DocumentModel` the NDA uses, so all renderers work unchanged. The Mutual NDA keeps its own model (`lib/document.ts`, `NdaData`) and maps to flat field values with `ndaToValues`/`ndaFromValues`.
- **Chat:** `POST /api/chat` takes `{messages, documentType, values}` and returns `{reply, documentType, updates: [{field, value}]}`. `documentType` is restricted to the registry ids, and updates are filtered to the document's fields and kinds. `components/DraftingWorkspace.tsx` (route `/draft/`) applies each turn through `applyFieldUpdates`.
  - When the model switches to a new document, `chat.py` calls it a second time with that document's fields and the `JUST_SELECTED` instruction, so details already given are filled in the same turn. If that call fails, the first answer is kept.
  - Tests use `FakeLLM`/`SequenceLLM` in `backend/tests/test_chat.py`.
- **Mutual NDA creator:**
  - One format-neutral document model, `buildNdaDocument()` in `lib/document.ts`, feeds the preview and the PDF, Word and Markdown renderers in `lib/render/`. Change agreement wording there, never in a renderer.
  - The renderers are loaded with dynamic `import()`.
  - Each `REQUIRED_FIELDS` id in `lib/nda.ts` must match the DOM id of its form control.
  - The NDA is stored as flat field values like every other document, and is rebuilt through `ndaFromValues`/`parseDraft`.
- **Auth:** `auth.py` hashes passwords with scrypt and keeps sessions in a `sessions` table (30 days), sent as the HttpOnly `prelegal_session` cookie. `CurrentUser` is the dependency for protected routes (`/api/chat`, `/api/documents`). Tests use `sign_up()` and the `user_client` fixture in `tests/conftest.py`.
- **Saved documents:** `drafts.py` serves `/api/documents` (CRUD, always scoped to the user; another user's id is a 404). A document stores `documentType`, flat `values` and the chat `messages`; the title is derived from the type and party names.
- **Client stores** (`lib/draftStore.ts`: the current draft, auto-saved to the server about 800ms after each change, with a `generation` counter so late results for another draft are dropped; `lib/session.ts`: the signed-in user from `/api/auth/me`) follow one pattern: a module-level `useSyncExternalStore` store whose server snapshot is static, so hydration never mismatches.

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

These are available as Tailwind colours `brand-yellow`, `brand-blue`, `brand-purple`, `brand-navy` and `brand-gray` in `frontend/src/app/globals.css`. So far only the login screen and app chrome use them. The NDA creator still uses its original "paper/ink" palette.

## Current status

- **PL-3:** Common Paper templates and `catalog.json`.
- **PL-4:** Mutual NDA creator: form, live preview, and PDF, Word and Markdown export, with the draft saved in localStorage.
- **PL-5:** V1 foundation:
  - The FastAPI backend serves the static frontend.
  - The SQLite `users` table is recreated on every start.
  - Login was a placeholder until PL-9.
  - `/` is the sign-in page, and the app sits behind `AuthGate` (now at `/draft/`).
  - The start and stop scripts currently run the app locally (pid and logs in `.run/`). **Docker packaging is still to do.**
- **PL-6:** AI chat for the Mutual NDA.
  - This ticket added the first chat endpoint (`/api/chat/nda`); PL-7 replaced it with `/api/chat`.
  - The left panel has **Chat | Edit fields** tabs. PL-9 moved the conversation to the saved document.
- **PL-7:** All 11 document types from the catalog.
  - The AI identifies the document the user needs. For an unsupported document, it explains that and suggests the closest one, then fills the fields in.
  - `/draft/` has a document picker, Chat | Edit fields tabs (with a generic field form for the 10 non-NDA documents), a live preview, and PDF, Word and Markdown downloads for every document.
- **UI polish** (no ticket, PR #7):
  - Starter prompts in the empty chat, and a progress meter for required details.
  - Picking a document by hand adds an assistant message saying what happens next.
  - Focus returns to the chat input after each reply.
  - The login form validates in the browser.
  - When the AI first chooses a document, the backend asks it a second time with that document's fields (`just_selected`), so details the user already gave are filled in the same turn.
- **Running it now:** `scripts/start-windows.ps1` (or the mac/linux script) builds the frontend and serves everything at http://localhost:8000. Create an account at `/signup/`. Accounts and documents are lost when the server restarts, because the database is recreated.
- **Tests:** about 39 backend (pytest) and 121 frontend (Vitest) tests. Lint, `tsc` and `npm run build` should stay clean.
- **PL-9:** sign up and sign in, per-user documents auto-saved to the server, a **My documents** dashboard (`/documents/`, reopen with `/draft/?id=N`), an app shell with the brand palette, and a "draft, subject to legal review" disclaimer in the app and at the end of every PDF, Word and Markdown export (`DISCLAIMER_BLOCK` in `lib/document.ts`).
- **Not built yet:** Docker packaging, and a persistent database.

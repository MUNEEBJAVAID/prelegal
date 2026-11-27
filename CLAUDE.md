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

Branches are named `feature/PL-N-short-name` and commit messages start with `PL-N: `.

## AI design

When writing code that calls LLMs, use your Cerebras skill to call the `openrouter/openai/gpt-oss-120b` model through LiteLLM via OpenRouter, with Cerebras as the inference provider. Use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an `OPENROUTER_API_KEY` in the `.env` file in the project root. The start scripts pass `.env` to the backend.

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

- **Backend:** `create_app(settings)` in `backend/src/prelegal_backend/main.py`. Routers are mounted under `/api`, and the static frontend (`FRONTEND_DIR`, default `frontend/out`) is mounted last at `/`. The lifespan hook runs `init_db()`, which deletes and recreates the SQLite file (`DATABASE_PATH`). It uses the standard-library `sqlite3`, not an ORM. Tests pass a `Settings` that points at `tmp_path`.
- **Frontend static export:**
  - `next.config.ts` sets `output: "export"` and `trailingSlash` for builds, and in `next dev` rewrites `/api` to the backend instead.
  - Export mode rules out PPR, `cacheComponents`, `"use cache"`, server actions, route handlers and dynamic server rendering.
  - Server components may only read files at build time. For example, `lib/standardTerms.ts` reads `../templates/Mutual-NDA.md` relative to `frontend/`.
- **Mutual NDA creator:**
  - One format-neutral document model, `buildNdaDocument()` in `lib/document.ts`, feeds the preview and the PDF, Word and Markdown renderers in `lib/render/`. Change agreement wording there, never in a renderer.
  - The renderers are loaded with dynamic `import()`.
  - Each `REQUIRED_FIELDS` id in `lib/nda.ts` must match the DOM id of its form control.
  - Drafts are stored in localStorage and always pass through `parseDraft`.
- **Client stores** (`lib/draftStore.ts`, `lib/session.ts`) follow one pattern: a module-level `useSyncExternalStore` store whose server snapshot is static, so hydration never mismatches.

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
  - **Login is fake.** `POST /api/auth/login` accepts any email and password, and the user is kept in sessionStorage.
  - `/` is the sign-in page, and `/nda/` is the creator behind `AuthGate`.
  - The start and stop scripts currently run the app locally (pid and logs in `.run/`). **Docker packaging is still to do.**
- Not built yet: AI chat, real authentication, server-side document persistence, and document types other than the Mutual NDA.

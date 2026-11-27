# prelegal
A platform for drafting common legal agreements

> **🚧 Status: In progress**
>
> This project is under active development and is expected to be completed within **1 week** (target: **November 23, 2026**). Features, setup instructions, and documentation will be added as development progresses.

## Running locally

Requires [Node.js](https://nodejs.org/) 22+ and [uv](https://docs.astral.sh/uv/).

```bash
# macOS / Linux
scripts/start-mac.sh      # or scripts/start-linux.sh
scripts/stop-mac.sh       # or scripts/stop-linux.sh

# Windows (PowerShell)
scripts/start-windows.ps1
scripts/stop-windows.ps1
```

The start script builds the frontend as static files and runs the backend in the background at
http://localhost:8000 (logs in `.run/backend.log`). Docker packaging will replace these local scripts.

Create an account at `/signup/`, then sign in. Your drafts are auto-saved under **My documents**. The database is recreated on every start, so accounts and documents don't survive a restart.

## Layout

- `backend/`: FastAPI app (uv project). Serves the JSON API under `/api` and the static frontend.
  The SQLite database is temporary and rebuilt from scratch on every start.
- `frontend/`: Next.js app, built with `output: "export"` (see [frontend/README.md](frontend/README.md)).
- `templates/`, `catalog.json`: Common Paper agreement templates (CC BY 4.0).

## Development

```bash
cd backend && uv run prelegal-backend   # API on http://127.0.0.1:8000
cd frontend && npm run dev              # UI on http://localhost:3000, proxies /api to the backend
cd backend && uv run pytest             # backend tests
cd frontend && npm test                 # frontend tests
```

# Prelegal frontend

Next.js app (static export, served by the FastAPI backend) for drafting Common Paper agreements.

- `/` is sign-in and `/signup/` is sign-up. The session is an HttpOnly cookie set by the backend.
- `/documents/` lists the user's saved documents. `/draft/?id=N` reopens one, and `/draft/` starts a new one.
- `/draft/` is the drafting workspace. **Chat** with the AI assistant, which works out which of the 11 supported documents you need (or suggests the closest one) and fills it in from your answers. You can also pick a document and use **Edit fields**.
- The completed document (cover page plus Standard Terms) updates live beside the chat. Hover a Standard Terms reference such as *Governing Law* to see its value, and click it to jump to the cover page.
- Download as **PDF**, **Word (.docx)** or **Markdown**. Drafts and the conversation are auto-saved to your account.

## Development

```bash
npm install
npm run dev     # http://localhost:3000 (proxies /api to the backend on :8000)
npm test        # Vitest unit tests
npm run build   # static export to out/, served by the FastAPI backend
npm run lint
```

Run the backend (`cd ../backend && uv run prelegal-backend`) for sign-in and chat to work in `next dev`.

## How it works

The templates (`../templates/*.md`) and the document registry (`../documents.json`) are read at build
time, so the repository stays the single source of truth.

Every output is produced from one format-neutral **document model**:

```
Mutual NDA:   NdaData + StandardTerms ──► buildNdaDocument()     ─┐
Others:       values + registry + clauses ─► buildGenericDocument() ─┴► blocks ──┬─ DocumentPreview
                                                                                   ├─ render/pdf.tsx
                                                                                   ├─ render/docx.ts
                                                                                   └─ render/markdown.ts
```

The PDF and Word libraries are loaded only when a download is requested.

| Path | Purpose |
| --- | --- |
| `src/app/draft/page.tsx` | Loads the catalog (registry and parsed templates) and renders the workspace |
| `src/components/DraftingWorkspace.tsx` | Header, downloads, Chat/Edit fields tabs, preview or document picker |
| `src/components/ChatPanel.tsx` | AI chat; turns pick the document and update fields |
| `src/components/NdaForm.tsx`, `GenericForm.tsx` | Direct field editing (Mutual NDA / other documents) |
| `src/lib/registry.ts`, `catalog.server.ts` | Document registry types and the build-time loader |
| `src/lib/terms.ts` | Template parsers (`parseStandardTerms` for the NDA, `parseClauses` for the rest) |
| `src/lib/document.ts`, `genericDocument.ts` | Document model builders |
| `src/lib/render/*` | PDF, Word and Markdown renderers |
| `src/lib/draftStore.ts` | The current draft, auto-saved to `/api/documents` |
| `src/lib/session.ts`, `src/lib/api.ts` | Signed-in user; API client |

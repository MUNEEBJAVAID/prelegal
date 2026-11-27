# Prelegal frontend — Mutual NDA Creator

A Next.js prototype (PL-4) for drafting a [Common Paper Mutual NDA](https://commonpaper.com/standards/mutual-nda/1.0).

- **Chat** with the AI drafting assistant (PL-6): it asks about the parties and terms and fills in
  the NDA from your answers, noting which fields each reply updated. The conversation is saved in this browser.
- Or use **Edit fields** to fill in the key details (parties, purpose, effective date, terms, governing law)
  directly, in five numbered steps. A progress meter shows how many required details are complete.
- The completed Mutual NDA — cover page plus Standard Terms — updates live beside the form
  (on phones, switch between **Draft** and **Preview** tabs). Hover a Standard Terms reference
  such as *Governing Law* to see the value you entered; click it to jump to that cover-page section.
- Download as **PDF**, **Word (.docx)** or **Markdown**. If required details are blank you're asked
  to fill them in first, or you can download anyway with placeholders.
- Your draft is saved in this browser (localStorage), so a refresh doesn't lose your work.

## Development

```bash
npm install
npm run dev     # http://localhost:3000 (proxies /api to the backend on :8000)
npm test        # Vitest unit tests
npm run build   # static export to out/, served by the FastAPI backend
npm run lint
```

`/` is a placeholder sign-in screen (any email and password; the user is kept in sessionStorage)
and the creator lives at `/nda/` behind `AuthGate`. Run the backend (`cd ../backend && uv run prelegal-backend`)
for sign-in to work in `next dev`.

## How it works

The Standard Terms are read at build time from `../templates/Mutual-NDA.md`, so the repository
template stays the single source of truth.

Every output is produced from one format-neutral **document model**:

```
NdaData (form) + StandardTerms (template)
        └─ buildNdaDocument() ──► blocks ──┬─ DocumentPreview (React, on screen)
                                           ├─ render/pdf.tsx   (@react-pdf/renderer)
                                           ├─ render/docx.ts   (docx)
                                           └─ render/markdown.ts
```

The PDF and Word libraries are loaded only when a download is requested.

| Path | Purpose |
| --- | --- |
| `src/app/page.tsx` | Loads the Standard Terms and renders the creator |
| `src/components/NdaCreator.tsx` | Page shell: header, downloads, mobile tabs, missing-fields flow |
| `src/components/NdaForm.tsx` | Key-information form with progress and required-field flags |
| `src/components/DocumentPreview.tsx` | On-screen rendering of the document model |
| `src/components/MissingFieldsDialog.tsx` | Confirmation before downloading an incomplete NDA |
| `src/lib/nda.ts` | Form data model, defaults, required fields, draft parsing |
| `src/lib/terms.ts` | Pure parser for the Standard Terms template |
| `src/lib/document.ts` | Format-neutral document model (`buildNdaDocument`) |
| `src/lib/render/*` | PDF, Word and Markdown renderers |
| `src/lib/draftStore.ts` | localStorage-backed draft (hydration-safe) |
| `src/lib/download.ts` | File naming, lazy rendering and saving |
| `src/lib/standardTerms.ts` | Server-only template loader |

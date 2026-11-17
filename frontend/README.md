# Prelegal frontend — Mutual NDA Creator

A Next.js prototype (PL-4) for drafting a [Common Paper Mutual NDA](https://commonpaper.com/standards/mutual-nda/1.0).

- Fill in the key details (parties, purpose, effective date, terms, governing law) in the form.
- The completed Mutual NDA — cover page plus Standard Terms — updates live next to the form.
- Download the result as a PDF (via the browser's print dialog → "Save as PDF") or as Markdown.

The Standard Terms are read at build time from `../templates/Mutual-NDA.md`, so the
repository-level template stays the single source of truth.

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
```

## Structure

| Path | Purpose |
| --- | --- |
| `src/app/page.tsx` | Loads the Standard Terms and renders the creator |
| `src/components/NdaCreator.tsx` | Client state, header actions and downloads |
| `src/components/NdaForm.tsx` | Key-information form |
| `src/components/NdaDocument.tsx` | Rendered Mutual NDA (screen + print) |
| `src/lib/nda.ts` | Data model, defaults and Markdown generation |
| `src/lib/standardTerms.ts` | Server-only loader/parser for the template |

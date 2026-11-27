import type { DocDef } from "@/lib/registry";

/** Shown in place of the preview until a document is chosen (by chat or by clicking). */
export function DocumentPicker({ documents, onSelect }: { documents: DocDef[]; onSelect: (id: string) => void }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="font-serif text-xl font-semibold text-ink">What would you like to draft?</h2>
      <p className="mt-1 text-sm text-muted">
        Tell the assistant about your situation, or pick a document to start with. All documents are based on Common
        Paper standard agreements.
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {documents.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onSelect(d.id)}
              className="h-full w-full rounded-lg border border-line bg-paper p-4 text-left shadow-sm transition-colors hover:border-ink/40 hover:bg-panel focus-visible:outline-2 focus-visible:outline-ink"
            >
              <span className="block font-serif font-semibold text-ink">{d.name}</span>
              <span className="mt-1 block text-sm text-muted">{d.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

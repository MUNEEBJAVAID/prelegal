import type { Block, DocumentModel, SectionContent } from "@/lib/document";
import type { Run } from "@/lib/terms";

const anchor = (id: string) => `cover-${id}`;

type Refs = DocumentModel["refs"];

function Runs({ runs, refs }: { runs: Run[]; refs?: Refs }) {
  return runs.map((r, i) => {
    if (r.href)
      return (
        <a key={i} href={r.href} target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong underline-offset-2 hover:decoration-ink">
          {r.text}
        </a>
      );
    const ref = r.ref ? refs?.[r.ref] : undefined;
    if (ref)
      return (
        <a
          key={i}
          href={ref.target ? `#${anchor(ref.target)}` : undefined}
          data-value={ref.value || "Not filled in yet"}
          className="term-ref rounded-sm font-semibold text-ink underline decoration-ink/30 decoration-dotted underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          {r.text}
        </a>
      );
    if (r.placeholder)
      return (
        <span key={i} className="rounded bg-flag-wash px-1 font-sans text-[0.85em] font-medium text-flag">
          {r.text}
        </span>
      );
    if (r.bold) return <strong key={i}>{r.text}</strong>;
    return <span key={i} className="whitespace-pre-line">{r.text}</span>;
  });
}

function Content({ content }: { content: SectionContent }) {
  if (content.type === "paragraph")
    return (
      <p>
        <Runs runs={content.runs} />
      </p>
    );
  return (
    <ul className="space-y-1.5">
      {content.options.map((o, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden
            className={`mt-[0.3em] flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border text-[10px] leading-none ${
              o.checked ? "border-ink bg-ink text-white" : "border-line-strong"
            }`}
          >
            {o.checked && "✓"}
          </span>
          <span className={o.checked ? "" : "text-muted/70"}>
            <span className="sr-only">{o.checked ? "Selected: " : "Not selected: "}</span>
            <Runs runs={o.runs} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function PreviewBlock({ block, refs }: { block: Block; refs: Refs }) {
  switch (block.type) {
    case "title":
      return <h2 className="mb-5 text-center text-[1.65rem] font-semibold tracking-tight text-ink">{block.text}</h2>;
    case "paragraph":
      return (
        <p className={block.muted ? "mt-4 text-xs text-muted" : "mb-4"}>
          <Runs runs={block.runs} />
        </p>
      );
    case "section":
      return (
        <section id={anchor(block.id)} className="scroll-mt-24 border-t border-line py-3.5 target:bg-ink-wash/60">
          <h3 className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink">{block.title}</h3>
          {block.hint && <p className="text-xs italic text-muted">{block.hint}</p>}
          <div className="mt-1.5 space-y-1">
            {block.content.map((c, i) => (
              <Content key={i} content={c} />
            ))}
          </div>
        </section>
      );
    case "signatures":
      return (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="mt-1 w-full min-w-[30rem] table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-[26%]" />
                {block.parties.map((p) => (
                  <th key={p} className="border border-line-strong bg-panel p-2 font-sans text-[0.7rem] tracking-[0.14em] text-ink">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r) => (
                <tr key={r.label}>
                  <th className="border border-line-strong p-2 text-left font-semibold">{r.label}</th>
                  {r.cells.map((c, i) => (
                    <td key={i} className={`border border-line-strong p-2 break-words ${r.blank ? "h-12" : ""}`}>
                      <Runs runs={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "heading":
      return (
        <h2 className="mt-12 mb-5 border-t border-line pt-10 text-center text-xl font-semibold text-ink">
          {block.text}
        </h2>
      );
    case "clause":
      return (
        <p
          className={`flex gap-2 text-justify text-[0.9rem] hyphens-auto ${block.level === 0 && block.runs[0]?.bold ? "mt-5 mb-2" : "mb-3"}`}
          style={{ marginLeft: `${block.level * 1.25}rem` }}
        >
          <span className="min-w-6 shrink-0 tabular-nums text-muted">{block.label}</span>
          <span>
            <Runs runs={block.runs} refs={refs} />
          </span>
        </p>
      );
  }
}

/** On-screen rendering of the document model as a sheet of paper. */
export function DocumentPreview({ doc }: { doc: DocumentModel }) {
  return (
    <article className="mx-auto max-w-[8.5in] rounded-sm bg-paper px-6 py-10 font-serif text-[0.95rem] leading-relaxed text-text shadow-[0_1px_2px_rgba(31,42,68,0.06),0_12px_40px_-12px_rgba(31,42,68,0.18)] ring-1 ring-line sm:px-12 sm:py-14">
      {doc.blocks.map((b, i) => (
        <PreviewBlock key={i} block={b} refs={doc.refs} />
      ))}
    </article>
  );
}

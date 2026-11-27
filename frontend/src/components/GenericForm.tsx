"use client";

import { fieldId } from "@/lib/genericDocument";
import { partyKey, type DocDef, type FieldDef, type Values } from "@/lib/registry";

type Props = {
  doc: DocDef;
  values: Values;
  onChange: (values: Values) => void;
  /** Ids of required fields that are empty and should be flagged. */
  flagged: ReadonlySet<string>;
};

const controlClass =
  "w-full rounded-md border bg-paper px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink";

/** Direct editing of a generic document's fields, grouped by party and key terms. */
export function GenericForm({ doc, values, onChange, flagged }: Props) {
  const groups: { title: string; fields: FieldDef[] }[] = [
    ...doc.parties.map((role) => ({
      title: role,
      fields: doc.fields.filter((f) => f.key.startsWith(`${partyKey(role)}.`)),
    })),
    {
      title: doc.coverTitle,
      fields: doc.fields.filter((f) => !doc.parties.some((role) => f.key.startsWith(`${partyKey(role)}.`))),
    },
  ];

  return (
    <div className="space-y-4">
      {groups.map((g, n) => (
        <section key={g.title} className="rounded-lg border border-line bg-paper/70 p-4 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2.5 font-serif text-[1.05rem] font-semibold text-ink">
            <span className="flex size-6 items-center justify-center rounded-full bg-ink font-sans text-xs font-semibold text-white">
              {n + 1}
            </span>
            {g.title}
          </h2>
          <div className="space-y-4">
            {g.fields.map((f) => {
              const id = fieldId(f.key);
              const isFlagged = flagged.has(id);
              const props = {
                id,
                value: values[f.key] ?? "",
                onChange: (e: { target: { value: string } }) => onChange({ ...values, [f.key]: e.target.value }),
                "aria-invalid": isFlagged || undefined,
                className: `${controlClass} ${isFlagged ? "border-flag bg-flag-wash/40" : "border-line-strong"}`,
              };
              const label = g.title === doc.coverTitle ? f.label : f.label.slice(g.title.length + 1);
              return (
                <div key={f.key}>
                  <label htmlFor={id} className="mb-1 flex items-baseline justify-between gap-2 text-sm font-medium text-text">
                    <span>
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                      {!f.required && <span className="ml-1.5 font-normal text-muted">optional</span>}
                    </span>
                    {isFlagged && <span className="text-xs font-medium text-flag">Required</span>}
                  </label>
                  {f.kind === "longtext" ? (
                    <textarea rows={3} {...props} />
                  ) : (
                    <input type={f.kind === "date" ? "date" : "text"} {...props} />
                  )}
                  {f.description && <p className="mt-1 text-xs text-muted">{f.description}</p>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

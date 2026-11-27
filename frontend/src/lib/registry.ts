/**
 * Supported document types, from `documents.json` at the repository root
 * (read at build time by catalog.server.ts). Keep `expandFields` in sync with
 * `backend/src/prelegal_backend/documents.py`.
 */

export type FieldKind = "text" | "longtext" | "date" | "number" | "choice";

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  description?: string;
  options?: string[];
  /** Extra template term names this field defines (besides its label). */
  refs?: string[];
};

export type DocDef = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  template: string;
  kind: "nda" | "generic";
  /** Heading of the generated cover page ("Cover Page", "Key Terms", "Order Form"). */
  coverTitle: string;
  parties: string[];
  /** Party fields first, then the document's own fields. */
  fields: FieldDef[];
};

/** Field values of a generic document, keyed by FieldDef.key. */
export type Values = Record<string, string>;

type RawField = Omit<FieldDef, "required" | "kind"> & Partial<Pick<FieldDef, "required" | "kind">>;
export type RawRegistry = {
  commonFields: Record<string, Omit<RawField, "key">>;
  documents: (Omit<DocDef, "fields" | "kind" | "coverTitle"> &
    Partial<Pick<DocDef, "kind" | "coverTitle">> & { fields: (string | RawField)[] })[];
};

const PARTY_FIELDS = [
  ["company", "company", "Legal name of the company"],
  ["name", "signer name", "Name of the person signing"],
  ["title", "signer title", "Job title of the person signing"],
  ["noticeAddress", "notice address", "Email or postal address for legal notices"],
] as const;

export const partyKey = (role: string) => role.charAt(0).toLowerCase() + role.slice(1).replace(/ /g, "");

export function expandRegistry(raw: RawRegistry): DocDef[] {
  return raw.documents.map((d) => {
    const partyFields: FieldDef[] = d.parties.flatMap((role) =>
      PARTY_FIELDS.map(([key, label, description]) => ({
        key: `${partyKey(role)}.${key}`,
        label: `${role} ${label}`,
        kind: "text" as const,
        required: true,
        description,
      })),
    );
    const own = d.fields.map((f): FieldDef => {
      const def: RawField = typeof f === "string" ? { key: f, ...raw.commonFields[f] } : f;
      return { ...def, kind: def.kind ?? "text", required: def.required ?? false };
    });
    return { ...d, kind: d.kind ?? "generic", coverTitle: d.coverTitle ?? "Key Terms", fields: [...partyFields, ...own] };
  });
}

/** "Provider’s" → "Provider", so possessives resolve to the defined term. */
const baseTerm = (term: string) => term.replace(/[’']s$/, "").trim();

/**
 * Finds what a template term refers to: a party (its company name), the
 * parties' notice addresses, or a field (by label or alias, ignoring a plural "s").
 */
export function resolveTerm(doc: DocDef, term: string): { field?: FieldDef; party?: string; notice?: true } {
  const t = baseTerm(term);
  const party = doc.parties.find((p) => p === t);
  if (party) return { party };
  if (t === "Notice Address") return { notice: true };
  const names = (f: FieldDef) => [f.label, ...(f.refs ?? [])];
  const candidates = [t, t.endsWith("s") ? t.slice(0, -1) : `${t}s`];
  for (const c of candidates) {
    const field = doc.fields.find((f) => names(f).includes(c));
    if (field) return { field };
  }
  return {};
}

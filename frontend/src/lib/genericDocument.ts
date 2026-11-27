/**
 * Builds the document model for every document type except the Mutual NDA
 * (which has its own Common Paper cover page, see document.ts): a generated
 * cover page from the registry's fields, a signature table, then the
 * template's Standard Terms.
 */
import { DISCLAIMER_BLOCK, valueRuns, type Block, type DocumentModel, type RefInfo, type SignatureRow } from "./document";
import { LICENSE_URL, formatDate, type RequiredField } from "./nda";
import { partyKey, resolveTerm, type DocDef, type FieldDef, type Values } from "./registry";
import type { ClauseLine, Run } from "./terms";

export const fieldId = (key: string) => `field-${key.replace(/\./g, "-")}`;
const sectionId = (key: string) => key.replace(/\./g, "-");

/** The text a field shows on the cover page ("" when blank). */
export function displayValue(field: FieldDef, values: Values): string {
  const v = (values[field.key] ?? "").trim();
  return field.kind === "date" ? formatDate(v) || v : v;
}

const isPartyField = (doc: DocDef, f: FieldDef) => doc.parties.some((p) => f.key.startsWith(`${partyKey(p)}.`));

export function getMissingGenericFields(doc: DocDef, values: Values): RequiredField[] {
  return doc.fields
    .filter((f) => f.required && !(values[f.key] ?? "").trim())
    .map((f) => ({ id: fieldId(f.key), label: f.label, value: () => "" }));
}

function signatureRows(doc: DocDef, values: Values): SignatureRow[] {
  const [a, b] = doc.parties.map(partyKey);
  const blank = (label: string): SignatureRow => ({ label, cells: [[], []], blank: true });
  const row = (label: string, field: string): SignatureRow => ({
    label,
    cells: [valueRuns(values[`${a}.${field}`] ?? "", label), valueRuns(values[`${b}.${field}`] ?? "", label)],
  });
  return [
    blank("Signature"),
    row("Print Name", "name"),
    row("Title", "title"),
    row("Company", "company"),
    row("Notice Address", "noticeAddress"),
    blank("Date"),
  ];
}

function resolveRefs(doc: DocDef, values: Values, clauses: ClauseLine[]): Record<string, RefInfo> {
  const refs: Record<string, RefInfo> = {};
  const terms = new Set(clauses.flatMap((c) => c.runs.flatMap((r) => (r.ref ? [r.ref] : []))));
  for (const term of terms) {
    const { field, party, notice } = resolveTerm(doc, term);
    if (party) refs[term] = { value: (values[`${partyKey(party)}.company`] ?? "").trim(), target: "parties" };
    else if (notice)
      refs[term] = {
        value: doc.parties
          .map((p) => [p, (values[`${partyKey(p)}.noticeAddress`] ?? "").trim()])
          .filter(([, v]) => v)
          .map(([p, v]) => `${p}: ${v}`)
          .join("; "),
        target: "parties",
      };
    else if (field) refs[term] = { value: displayValue(field, values), target: sectionId(field.key) };
  }
  return refs;
}

export function buildGenericDocument(doc: DocDef, values: Values, clauses: ClauseLine[]): DocumentModel {
  const [roleA, roleB] = doc.parties;
  const keyTerms = doc.fields.filter((f) => !isPartyField(doc, f));
  const text = (t: string): Run[] => [{ text: t }];

  const blocks: Block[] = [
    { type: "title", text: doc.name },
    {
      type: "paragraph",
      runs: [
        { text: `This ${doc.name} consists of: (1) this ${doc.coverTitle} (“` },
        { text: doc.coverTitle, bold: true },
        { text: `”) and (2) the Common Paper ${doc.name} Standard Terms (“` },
        { text: "Standard Terms", bold: true },
        {
          text: `”). Capitalized terms used in the Standard Terms have the meanings given on this ${doc.coverTitle}, which controls over conflicts with the Standard Terms.`,
        },
      ],
    },
    {
      type: "section",
      id: "parties",
      title: "Parties",
      content: [
        { type: "paragraph", runs: [{ text: `${roleA}: ` }, ...valueRuns(values[`${partyKey(roleA)}.company`] ?? "", `${roleA}`)] },
        { type: "paragraph", runs: [{ text: `${roleB}: ` }, ...valueRuns(values[`${partyKey(roleB)}.company`] ?? "", `${roleB}`)] },
      ],
    },
    ...keyTerms.map(
      (f): Block => ({
        type: "section",
        id: sectionId(f.key),
        title: f.label,
        content: [
          {
            type: "paragraph",
            runs: f.required ? valueRuns(displayValue(f, values), f.label) : text(displayValue(f, values) || "None."),
          },
        ],
      }),
    ),
    { type: "paragraph", runs: text(`By signing this ${doc.coverTitle}, each party agrees to enter into this ${doc.name}.`) },
    { type: "signatures", parties: [roleA.toUpperCase(), roleB.toUpperCase()], rows: signatureRows(doc, values) },
    {
      type: "paragraph",
      muted: true,
      runs: [
        { text: `Based on the Common Paper ${doc.name}, free to use under ` },
        { text: "CC BY 4.0", href: LICENSE_URL },
        { text: "." },
      ],
    },
    { type: "heading", text: "Standard Terms", newPage: true },
    ...clauses.map((c): Block => ({ type: "clause", label: c.label, level: c.level, runs: c.runs })),
    DISCLAIMER_BLOCK,
  ];

  return { title: doc.name, blocks, refs: resolveRefs(doc, values, clauses) };
}

/** Applies field updates from the AI; returns the new values and the labels of changed fields. */
export function applyFieldUpdates(
  doc: DocDef,
  values: Values,
  updates: { field: string; value: string }[],
): { values: Values; changed: string[] } {
  const next = { ...values };
  const changed: string[] = [];
  for (const { field, value } of updates) {
    const def = doc.fields.find((f) => f.key === field);
    if (!def || (next[field] ?? "") === value) continue;
    next[field] = value;
    if (!changed.includes(def.label)) changed.push(def.label);
  }
  return { values: next, changed };
}

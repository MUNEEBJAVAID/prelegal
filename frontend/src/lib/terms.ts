/**
 * Pure parsing of the Common Paper Mutual NDA Standard Terms template
 * (templates/Mutual-NDA.md). Safe to use on both server and client.
 */

/** Cover Page terms the Standard Terms refer back to. */
export type TermRef =
  | "Purpose"
  | "Effective Date"
  | "MNDA Term"
  | "Term of Confidentiality"
  | "Governing Law"
  | "Jurisdiction";

/** A run of inline text with optional formatting. */
export type Run = {
  text: string;
  bold?: boolean;
  href?: string;
  /** This run names a Cover Page term. */
  ref?: TermRef;
  /** This run stands in for a value the user has not entered yet. */
  placeholder?: boolean;
};

export type Clause = { number: number; runs: Run[] };

export type StandardTerms = {
  clauses: Clause[];
  /** Trailing attribution line. */
  footer: Run[];
};

const TERM_REFS: readonly string[] = [
  "Purpose",
  "Effective Date",
  "MNDA Term",
  "Term of Confidentiality",
  "Governing Law",
  "Jurisdiction",
];

// The subset of inline Markdown used by the templates: **bold**, [links](url)
// and <span class="coverpage_link">Cover Page references</span>.
const INLINE_TOKEN =
  /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|<span class="coverpage_link">(.+?)<\/span>/g;

export function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) runs.push({ text: text.slice(last, index) });
    const [, bold, linkText, href, ref] = m;
    if (bold !== undefined) runs.push({ text: bold, bold: true });
    else if (linkText !== undefined) runs.push({ text: linkText, href });
    else if (ref !== undefined)
      runs.push(TERM_REFS.includes(ref) ? { text: ref, ref: ref as TermRef } : { text: ref });
    last = index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}

export function parseStandardTerms(markdown: string): StandardTerms {
  const blocks = markdown
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const clauses: Clause[] = [];
  const other: string[] = [];
  for (const block of blocks) {
    if (block.startsWith("#")) continue;
    const match = /^(\d+)\.\s+([\s\S]*)$/.exec(block);
    if (match) clauses.push({ number: Number(match[1]), runs: parseInline(match[2]) });
    else other.push(block);
  }
  return { clauses, footer: parseInline(other.join(" ")) };
}

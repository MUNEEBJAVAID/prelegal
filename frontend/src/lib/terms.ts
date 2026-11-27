/**
 * Pure parsing of the Common Paper Standard Terms templates (templates/*.md).
 * Safe to use on both server and client.
 */

/** Cover Page terms the Mutual NDA Standard Terms refer back to. */
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
  /** This run names a term defined on the cover page (e.g. "Governing Law", "Provider"). */
  ref?: string;
  /** This run stands in for a value the user has not entered yet. */
  placeholder?: boolean;
};

export type Clause = { number: number; runs: Run[] };

export type StandardTerms = {
  clauses: Clause[];
  /** Trailing attribution line. */
  footer: Run[];
};

// The subset of inline Markdown/HTML used by the templates: **bold**, [links](url) and spans:
// class="*_link" names a cover-page term, class="header_*" is a clause title, others are anchors.
const INLINE_TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|<span([^>]*)>(.*?)<\/span>/g;

export function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_TOKEN)) {
    const index = m.index ?? 0;
    if (index > last) runs.push({ text: text.slice(last, index) });
    const [, bold, linkText, href, attrs, inner] = m;
    // Bold text may itself contain term references.
    if (bold !== undefined) runs.push(...parseInline(bold).map((r) => ({ ...r, bold: true })));
    else if (linkText !== undefined) runs.push({ text: linkText, href });
    else {
      const cls = /class="([^"]+)"/.exec(attrs)?.[1] ?? "";
      if (cls.endsWith("_link")) runs.push({ text: inner, ref: inner });
      else if (cls.startsWith("header_")) runs.push(...parseInline(inner).map((r) => ({ ...r, bold: true })));
      else runs.push(...parseInline(inner));
    }
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

/** One numbered line of a Standard Terms template, e.g. level 1 "2.3" or level 2 "(a)". */
export type ClauseLine = { level: number; label: string; runs: Run[] };

const LIST_ITEM = /^( *)(\d+|[a-z]{1,4})\.\s+(.*)$/;

/**
 * Parses a Standard Terms template whose clauses are a nested Markdown list
 * (4 spaces per level): "1." sections, "1." clauses, "a." and "i." sub-items.
 * Numbers are recomputed so labels read "1.", "1.1", "(a)", "(i)".
 */
export function parseClauses(markdown: string): ClauseLine[] {
  const counters: number[] = [];
  const lines: ClauseLine[] = [];
  for (const raw of markdown.replace(/\r\n/g, "\n").split("\n")) {
    if (!raw.trim() || raw.startsWith("#")) continue;
    const m = LIST_ITEM.exec(raw);
    if (!m) {
      // A continuation paragraph: attach to the previous line.
      lines.at(-1)?.runs.push({ text: " " }, ...parseInline(raw.trim()));
      continue;
    }
    const [, indent, marker, text] = m;
    const level = Math.min(Math.floor(indent.length / 4), 3);
    counters.length = level + 1;
    counters[level] = (counters[level] ?? 0) + 1;
    const label =
      level === 0 ? `${counters[0]}.` : level === 1 ? `${counters[0]}.${counters[1]}` : `(${marker})`;
    lines.push({ level, label, runs: parseInline(text) });
  }
  return lines;
}

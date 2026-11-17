import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Clause } from "./nda";

export type StandardTerms = {
  /** Raw Markdown of the Standard Terms, used for the downloaded document. */
  markdown: string;
  clauses: Clause[];
  /** Trailing attribution line. */
  footer: string;
};

// The legal templates live at the repository root, one level above the Next.js app.
const TEMPLATE_PATH = path.join(process.cwd(), "..", "templates", "Mutual-NDA.md");

export async function loadStandardTerms(): Promise<StandardTerms> {
  "use cache";
  const markdown = await readFile(TEMPLATE_PATH, "utf8");
  const blocks = markdown
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const clauses: Clause[] = [];
  const other: string[] = [];
  for (const block of blocks) {
    if (block.startsWith("#")) continue;
    const match = block.match(/^(\d+)\.\s+([\s\S]*)$/);
    if (match) clauses.push({ number: Number(match[1]), text: match[2] });
    else other.push(block);
  }

  return { markdown, clauses, footer: other.join(" ") };
}

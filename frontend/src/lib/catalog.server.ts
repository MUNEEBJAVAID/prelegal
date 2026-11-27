import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expandRegistry, type DocDef, type RawRegistry } from "./registry";
import { loadStandardTerms } from "./standardTerms";
import { parseClauses, type ClauseLine, type StandardTerms } from "./terms";

/** Everything the drafting workspace needs, read at build time from the repository root. */
export type Catalog = {
  documents: DocDef[];
  /** Parsed Standard Terms of each generic document, by document id. */
  clauses: Record<string, ClauseLine[]>;
  ndaTerms: StandardTerms;
};

const REPO_ROOT = path.join(process.cwd(), "..");

export async function loadCatalog(): Promise<Catalog> {
  const raw = JSON.parse(await readFile(path.join(REPO_ROOT, "documents.json"), "utf8")) as RawRegistry;
  const documents = expandRegistry(raw);
  const generic = documents.filter((d) => d.kind === "generic");
  const parsed = await Promise.all(
    generic.map(async (d) => [d.id, parseClauses(await readFile(path.join(REPO_ROOT, d.template), "utf8"))] as const),
  );
  return { documents, clauses: Object.fromEntries(parsed), ndaTerms: await loadStandardTerms() };
}

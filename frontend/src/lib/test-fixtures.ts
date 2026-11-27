import { readFileSync } from "node:fs";
import path from "node:path";
import { defaultNdaData, type NdaData } from "./nda";
import { expandRegistry, type RawRegistry } from "./registry";
import { parseClauses, parseStandardTerms } from "./terms";

export const templateMarkdown = readFileSync(
  path.resolve(__dirname, "../../../templates/Mutual-NDA.md"),
  "utf8",
);

export const terms = parseStandardTerms(templateMarkdown);

export const completeData: NdaData = {
  ...defaultNdaData,
  effectiveDate: "2026-11-17",
  mndaTermYears: 2,
  confidentialityType: "perpetuity",
  governingLaw: "Delaware",
  jurisdiction: "New Castle, DE",
  party1: { company: "Acme | Inc", name: "Jane Doe", title: "CEO", noticeAddress: "legal@acme.com\n1 Main St" },
  party2: { company: "Globex LLC", name: "John Roe", title: "COO", noticeAddress: "notices@globex.com" },
};

const repo = (p: string) => path.resolve(__dirname, "../../..", p);

/** All document types, expanded like loadCatalog() does at build time. */
export const documents = expandRegistry(JSON.parse(readFileSync(repo("documents.json"), "utf8")) as RawRegistry);

export const docDef = (id: string) => {
  const doc = documents.find((d) => d.id === id);
  if (!doc) throw new Error(`Unknown document ${id}`);
  return doc;
};

export const clausesOf = (id: string) => parseClauses(readFileSync(repo(docDef(id).template), "utf8"));

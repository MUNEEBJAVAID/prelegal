import { readFileSync } from "node:fs";
import path from "node:path";
import { defaultNdaData, type NdaData } from "./nda";
import { parseStandardTerms } from "./terms";

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

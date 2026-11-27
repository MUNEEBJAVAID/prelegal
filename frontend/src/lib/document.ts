/**
 * Format-neutral document model. Every output (on-screen preview, PDF, Word,
 * Markdown) renders these blocks, so an agreement's wording is defined in
 * exactly one place: buildNdaDocument here, buildGenericDocument for the rest.
 */
import {
  LICENSE_URL,
  PARTY_FIELD_LABELS,
  STANDARD_TERMS_URL,
  formatDate,
  years,
  type NdaData,
  type Party,
} from "./nda";
import type { Run, StandardTerms, TermRef } from "./terms";

export type SectionId = string;

export type OptionItem = { checked: boolean; runs: Run[] };

export type SectionContent =
  | { type: "paragraph"; runs: Run[] }
  | { type: "options"; options: OptionItem[] };

export type SignatureRow = {
  label: string;
  cells: [Run[], Run[]];
  /** Left blank for a handwritten entry (signature, date). */
  blank?: boolean;
};

export type Block =
  | { type: "title"; text: string }
  | { type: "paragraph"; runs: Run[]; muted?: boolean }
  | { type: "section"; id: SectionId; title: string; hint?: string; content: SectionContent[] }
  | { type: "signatures"; parties: [string, string]; rows: SignatureRow[] }
  | { type: "heading"; text: string; newPage?: boolean }
  /** A Standard Terms clause: level 0 "1.", level 1 "1.1", level 2 "(a)", level 3 "(i)". */
  | { type: "clause"; label: string; level: number; runs: Run[] };

/** What a Standard Terms reference resolves to: its cover-page value and section. */
export type RefInfo = { value: string; target?: SectionId };

/** Shown in the app and closes every generated document, in every format. */
export const DISCLAIMER =
  "This document was generated with Prelegal from Common Paper standard terms. It is a draft and is subject to legal review: have a qualified lawyer review it before anyone signs it. Prelegal does not provide legal advice.";

/** The closing disclaimer paragraph every document model ends with. */
export const DISCLAIMER_BLOCK: Block = {
  type: "paragraph",
  muted: true,
  runs: [{ text: "Draft subject to legal review. ", bold: true }, { text: DISCLAIMER }],
};

export type DocumentModel = {
  title: string;
  blocks: Block[];
  /** Keyed by the referenced term's text, e.g. "Governing Law". */
  refs: Record<string, RefInfo>;
};

/** Which Cover Page section each Standard Terms reference points at. */
export const REF_SECTION: Record<TermRef, SectionId> = {
  Purpose: "purpose",
  "Effective Date": "effective-date",
  "MNDA Term": "mnda-term",
  "Term of Confidentiality": "confidentiality",
  "Governing Law": "governing-law",
  Jurisdiction: "governing-law",
};

/** A user-entered value, or a placeholder run when it is still blank. */
export function valueRuns(value: string, placeholder: string): Run[] {
  const v = value.trim();
  return v ? [{ text: v }] : [{ text: `[${placeholder}]`, placeholder: true }];
}

const text = (t: string): Run[] => [{ text: t }];

export function mndaTermText(data: NdaData): string {
  return data.mndaTermType === "expires"
    ? `Expires ${years(data.mndaTermYears)} from Effective Date.`
    : "Continues until terminated in accordance with the terms of the MNDA.";
}

export function confidentialityText(data: NdaData): string {
  return data.confidentialityType === "years"
    ? `${years(data.confidentialityYears)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`
    : "In perpetuity.";
}

function signatureRows(p1: Party, p2: Party): SignatureRow[] {
  const blankRow = (label: string): SignatureRow => ({ label, cells: [[], []], blank: true });
  // Row order follows the Common Paper cover page template.
  const order: (keyof Party)[] = ["name", "title", "company", "noticeAddress"];
  const fields = order.map(
    (field): SignatureRow => {
      const label = PARTY_FIELD_LABELS[field];
      return { label, cells: [valueRuns(p1[field], label), valueRuns(p2[field], label)] };
    },
  );
  return [blankRow("Signature"), ...fields, blankRow("Date")];
}

export function buildNdaDocument(data: NdaData, terms: StandardTerms): DocumentModel {
  const expires = data.mndaTermType === "expires";
  const forYears = data.confidentialityType === "years";

  const blocks: Block[] = [
    { type: "title", text: "Mutual Non-Disclosure Agreement" },
    {
      type: "paragraph",
      runs: [
        { text: "This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“" },
        { text: "Cover Page", bold: true },
        { text: "”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“" },
        { text: "Standard Terms", bold: true },
        { text: "”) identical to those posted at " },
        { text: "commonpaper.com/standards/mutual-nda/1.0", href: STANDARD_TERMS_URL },
        {
          text: ". Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.",
        },
      ],
    },
    {
      type: "section",
      id: "purpose",
      title: "Purpose",
      hint: "How Confidential Information may be used",
      content: [{ type: "paragraph", runs: valueRuns(data.purpose, "Purpose") }],
    },
    {
      type: "section",
      id: "effective-date",
      title: "Effective Date",
      content: [
        { type: "paragraph", runs: valueRuns(formatDate(data.effectiveDate), "Effective Date") },
      ],
    },
    {
      type: "section",
      id: "mnda-term",
      title: "MNDA Term",
      hint: "The length of this MNDA",
      content: [
        {
          type: "options",
          options: [
            { checked: expires, runs: text(`Expires ${years(data.mndaTermYears)} from Effective Date.`) },
            {
              checked: !expires,
              runs: text("Continues until terminated in accordance with the terms of the MNDA."),
            },
          ],
        },
      ],
    },
    {
      type: "section",
      id: "confidentiality",
      title: "Term of Confidentiality",
      hint: "How long Confidential Information is protected",
      content: [
        {
          type: "options",
          options: [
            {
              checked: forYears,
              runs: text(
                `${years(data.confidentialityYears)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`,
              ),
            },
            { checked: !forYears, runs: text("In perpetuity.") },
          ],
        },
      ],
    },
    {
      type: "section",
      id: "governing-law",
      title: "Governing Law & Jurisdiction",
      content: [
        {
          type: "paragraph",
          runs: [{ text: "Governing Law: " }, ...valueRuns(data.governingLaw, "Governing Law")],
        },
        {
          type: "paragraph",
          runs: [{ text: "Jurisdiction: " }, ...valueRuns(data.jurisdiction, "Jurisdiction")],
        },
      ],
    },
    {
      type: "section",
      id: "modifications",
      title: "MNDA Modifications",
      content: [{ type: "paragraph", runs: text(data.modifications.trim() || "None.") }],
    },
    {
      type: "paragraph",
      runs: text(
        "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.",
      ),
    },
    { type: "signatures", parties: ["PARTY 1", "PARTY 2"], rows: signatureRows(data.party1, data.party2) },
    {
      type: "paragraph",
      muted: true,
      runs: [
        { text: "Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under " },
        { text: "CC BY 4.0", href: LICENSE_URL },
        { text: "." },
      ],
    },
    { type: "heading", text: "Standard Terms", newPage: true },
    ...terms.clauses.map((c): Block => ({ type: "clause", label: `${c.number}.`, level: 0, runs: c.runs })),
  ];
  if (terms.footer.length) blocks.push({ type: "paragraph", muted: true, runs: terms.footer });
  blocks.push(DISCLAIMER_BLOCK);

  const values: Record<TermRef, string> = {
    Purpose: data.purpose.trim(),
    "Effective Date": formatDate(data.effectiveDate),
    "MNDA Term": mndaTermText(data),
    "Term of Confidentiality": confidentialityText(data),
    "Governing Law": data.governingLaw.trim(),
    Jurisdiction: data.jurisdiction.trim(),
  };
  const refs = Object.fromEntries(
    (Object.keys(values) as TermRef[]).map((ref) => [ref, { value: values[ref], target: REF_SECTION[ref] }]),
  );
  return { title: "Mutual Non-Disclosure Agreement", blocks, refs };
}

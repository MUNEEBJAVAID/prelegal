export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
};

export type Clause = { number: number; text: string };

export type NdaData = {
  purpose: string;
  effectiveDate: string; // ISO yyyy-mm-dd, "" when not set
  mndaTermType: "expires" | "until-terminated";
  mndaTermYears: number;
  confidentialityType: "years" | "perpetuity";
  confidentialityYears: number;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
};

export const emptyParty: Party = {
  name: "",
  title: "",
  company: "",
  noticeAddress: "",
};

export const defaultNdaData: NdaData = {
  purpose:
    "Evaluating whether to enter into a business relationship with the other party.",
  effectiveDate: "",
  mndaTermType: "expires",
  mndaTermYears: 1,
  confidentialityType: "years",
  confidentialityYears: 1,
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: { ...emptyParty },
  party2: { ...emptyParty },
};

export const STANDARD_TERMS_URL = "https://commonpaper.com/standards/mutual-nda/1.0";
export const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

/** Formats an ISO date (yyyy-mm-dd) as e.g. "November 17, 2026". */
export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Today's date in the user's local time zone as yyyy-mm-dd. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function years(n: number): string {
  return `${n} year${n === 1 ? "" : "s"}`;
}

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

/** Replaces the cover-page reference spans in the standard terms with plain text. */
export function stripCoverpageSpans(text: string): string {
  return text.replace(/<span class="coverpage_link">(.*?)<\/span>/g, "$1");
}

function orBlank(value: string, placeholder: string): string {
  return value.trim() || `[${placeholder}]`;
}

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

/** Builds the completed MNDA (cover page + standard terms) as Markdown. */
export function buildNdaMarkdown(data: NdaData, standardTermsMarkdown: string): string {
  const check = (on: boolean) => (on ? "[x]" : "[ ]");
  const p1 = data.party1;
  const p2 = data.party2;
  const row = (label: string, a: string, b: string) =>
    `| ${label} | ${cell(a)} | ${cell(b)} |`;

  return `# Mutual Non-Disclosure Agreement

This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“**Cover Page**”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“**Standard Terms**”) identical to those posted at [commonpaper.com/standards/mutual-nda/1.0](${STANDARD_TERMS_URL}). Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.

### Purpose
${orBlank(data.purpose, "Purpose")}

### Effective Date
${formatDate(data.effectiveDate) || "[Effective Date]"}

### MNDA Term
- ${check(data.mndaTermType === "expires")} Expires ${years(data.mndaTermYears)} from Effective Date.
- ${check(data.mndaTermType === "until-terminated")} Continues until terminated in accordance with the terms of the MNDA.

### Term of Confidentiality
- ${check(data.confidentialityType === "years")} ${years(data.confidentialityYears)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.
- ${check(data.confidentialityType === "perpetuity")} In perpetuity.

### Governing Law & Jurisdiction
Governing Law: ${orBlank(data.governingLaw, "Governing Law")}

Jurisdiction: ${orBlank(data.jurisdiction, "Jurisdiction")}

### MNDA Modifications
${data.modifications.trim() || "None."}

By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.

| | PARTY 1 | PARTY 2 |
|:--- | :----: | :----: |
${row("Signature", "", "")}
${row("Print Name", p1.name, p2.name)}
${row("Title", p1.title, p2.title)}
${row("Company", p1.company, p2.company)}
${row("Notice Address", p1.noticeAddress, p2.noticeAddress)}
${row("Date", "", "")}

Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under [CC BY 4.0](${LICENSE_URL}).

---

${stripCoverpageSpans(standardTermsMarkdown).trim()}
`;
}

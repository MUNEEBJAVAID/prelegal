export type Party = {
  company: string;
  name: string;
  title: string;
  noticeAddress: string;
};

export type PartyKey = "party1" | "party2";

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

export const STANDARD_TERMS_URL = "https://commonpaper.com/standards/mutual-nda/1.0";
export const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

export const emptyParty: Party = { company: "", name: "", title: "", noticeAddress: "" };

export const defaultNdaData: NdaData = {
  purpose: "Evaluating whether to enter into a business relationship with the other party.",
  effectiveDate: "",
  mndaTermType: "expires",
  mndaTermYears: 1,
  confidentialityType: "years",
  confidentialityYears: 1,
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: emptyParty,
  party2: emptyParty,
};

export const PARTY_FIELD_LABELS: Record<keyof Party, string> = {
  company: "Company",
  name: "Print Name",
  title: "Title",
  noticeAddress: "Notice Address",
};

/** A required field: `id` is the id of its form control. */
export type RequiredField = { id: string; label: string; value: (d: NdaData) => string };

const partyFields = (key: PartyKey, label: string): RequiredField[] =>
  (Object.keys(PARTY_FIELD_LABELS) as (keyof Party)[]).map((field) => ({
    id: `${key}-${field}`,
    label: `${label} ${PARTY_FIELD_LABELS[field].toLowerCase()}`,
    value: (d) => d[key][field],
  }));

export const REQUIRED_FIELDS: RequiredField[] = [
  ...partyFields("party1", "Party 1"),
  ...partyFields("party2", "Party 2"),
  { id: "purpose", label: "Purpose", value: (d) => d.purpose },
  { id: "effectiveDate", label: "Effective date", value: (d) => d.effectiveDate },
  { id: "governingLaw", label: "Governing law", value: (d) => d.governingLaw },
  { id: "jurisdiction", label: "Jurisdiction", value: (d) => d.jurisdiction },
];

export function getMissingFields(data: NdaData): RequiredField[] {
  return REQUIRED_FIELDS.filter((f) => !f.value(data).trim());
}

/** Formats an ISO date (yyyy-mm-dd) as e.g. "November 17, 2026"; "" if invalid. */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Today's date in the user's local time zone as yyyy-mm-dd. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function years(n: number): string {
  return `${n} year${n === 1 ? "" : "s"}`;
}

export function clampYears(n: number): number {
  return Number.isFinite(n) ? Math.min(99, Math.max(1, Math.round(n))) : 1;
}

/**
 * Rebuilds NdaData from untrusted input (e.g. a saved draft), keeping only
 * well-typed values and falling back to defaults for anything else.
 */
export function parseDraft(input: unknown, fallback: NdaData = defaultNdaData): NdaData {
  if (!input || typeof input !== "object") return fallback;
  const src = input as Record<string, unknown>;
  const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);
  const num = (v: unknown, d: number) => (typeof v === "number" ? clampYears(v) : d);
  const party = (v: unknown, d: Party): Party => {
    const p = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    return {
      company: str(p.company, d.company),
      name: str(p.name, d.name),
      title: str(p.title, d.title),
      noticeAddress: str(p.noticeAddress, d.noticeAddress),
    };
  };
  return {
    purpose: str(src.purpose, fallback.purpose),
    effectiveDate: str(src.effectiveDate, fallback.effectiveDate),
    mndaTermType:
      src.mndaTermType === "expires" || src.mndaTermType === "until-terminated"
        ? src.mndaTermType
        : fallback.mndaTermType,
    mndaTermYears: num(src.mndaTermYears, fallback.mndaTermYears),
    confidentialityType:
      src.confidentialityType === "years" || src.confidentialityType === "perpetuity"
        ? src.confidentialityType
        : fallback.confidentialityType,
    confidentialityYears: num(src.confidentialityYears, fallback.confidentialityYears),
    governingLaw: str(src.governingLaw, fallback.governingLaw),
    jurisdiction: str(src.jurisdiction, fallback.jurisdiction),
    modifications: str(src.modifications, fallback.modifications),
    party1: party(src.party1, fallback.party1),
    party2: party(src.party2, fallback.party2),
  };
}

/** The draft as flat field values keyed like documents.json ("party1.company", "mndaTermYears", ...). */
export function ndaToValues(data: NdaData): Record<string, string> {
  const { party1, party2, ...rest } = data;
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(rest)) values[k] = String(v);
  for (const [key, party] of [["party1", party1], ["party2", party2]] as const) {
    for (const [k, v] of Object.entries(party)) values[`${key}.${k}`] = v;
  }
  return values;
}

/** Rebuilds the draft from flat field values, validated like a saved draft. */
export function ndaFromValues(values: Record<string, string>, fallback: NdaData): NdaData {
  const src: Record<string, unknown> = { party1: {}, party2: {} };
  for (const [key, value] of Object.entries(values)) {
    const [head, field] = key.split(".");
    if (field && (head === "party1" || head === "party2")) (src[head] as Record<string, string>)[field] = value;
    else src[key] = key.endsWith("Years") ? Number(value) : value;
  }
  return parseDraft(src, fallback);
}

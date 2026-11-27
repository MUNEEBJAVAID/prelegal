import { ApiError } from "./api";
import { parseDraft, type NdaData, type Party } from "./nda";

/** A chat bubble. `updated` lists the fields an assistant turn filled in. */
export type ChatMessage = { role: "user" | "assistant"; content: string; updated?: string[] };

export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I’ll help you draft a Mutual NDA. Let’s start with the parties: which two companies are entering into this agreement, and who will sign for each?",
};

/** Field changes returned by the AI. `null` means "leave unchanged". */
type Nullable<T> = { [K in keyof T]: T[K] | null };
export type NdaUpdates = Partial<Nullable<Omit<NdaData, "party1" | "party2">>> & {
  party1?: Partial<Nullable<Party>> | null;
  party2?: Partial<Nullable<Party>> | null;
};

export type ChatTurn = { reply: string; updates: NdaUpdates };

/** The backend caps the history it accepts; older turns are dropped first. */
export const MAX_HISTORY = 40;

const FIELD_LABELS: Record<Exclude<keyof NdaData, "party1" | "party2">, string> = {
  purpose: "Purpose",
  effectiveDate: "Effective date",
  mndaTermType: "MNDA term",
  mndaTermYears: "MNDA term",
  confidentialityType: "Term of confidentiality",
  confidentialityYears: "Term of confidentiality",
  governingLaw: "Governing law",
  jurisdiction: "Jurisdiction",
  modifications: "Modifications",
};

const PARTY_LABELS: Record<keyof Party, string> = {
  company: "company",
  name: "signer",
  title: "signer title",
  noticeAddress: "notice address",
};

const definedValues = <T extends object>(obj: T | null | undefined): Partial<T> =>
  Object.fromEntries(Object.entries(obj ?? {}).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;

/**
 * Applies the AI's updates to the draft. Values are validated the same way as
 * a saved draft (wrong types are ignored, year counts clamped). Returns the new
 * data and human-readable labels of the fields that actually changed.
 */
export function applyUpdates(data: NdaData, updates: NdaUpdates): { data: NdaData; changed: string[] } {
  const { party1, party2, ...rest } = updates;
  const merged = {
    ...data,
    ...definedValues(rest),
    party1: { ...data.party1, ...definedValues(party1) },
    party2: { ...data.party2, ...definedValues(party2) },
  };
  const next = parseDraft(merged, data);

  const changed = new Set<string>();
  for (const key of Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[]) {
    if (next[key] !== data[key]) changed.add(FIELD_LABELS[key]);
  }
  for (const [key, label] of [["party1", "Party 1"], ["party2", "Party 2"]] as const) {
    for (const field of Object.keys(PARTY_LABELS) as (keyof Party)[]) {
      if (next[key][field] !== data[key][field]) changed.add(`${label} ${PARTY_LABELS[field]}`);
    }
  }
  return { data: next, changed: [...changed] };
}

/** Asks the AI for its next turn, given the conversation so far and the current draft. */
export async function sendChat(
  messages: ChatMessage[],
  document: NdaData,
  fetchImpl: typeof fetch = fetch,
): Promise<ChatTurn> {
  let res: Response;
  try {
    res = await fetchImpl("/api/chat/nda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages.slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content })),
        document,
      }),
    });
  } catch {
    throw new ApiError("Couldn’t reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b: { detail?: unknown }) => (typeof b.detail === "string" ? b.detail : null))
      .catch(() => null);
    throw new ApiError(detail ?? "The AI assistant couldn’t reply. Please try again.");
  }
  return (await res.json()) as ChatTurn;
}

/** Rebuilds a saved conversation from untrusted JSON; falls back to just the greeting. */
export function parseChat(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [GREETING];
  const messages = input.flatMap((m): ChatMessage[] => {
    if (!m || typeof m !== "object") return [];
    const { role, content, updated } = m as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content) return [];
    const labels = Array.isArray(updated) ? updated.filter((u): u is string => typeof u === "string") : [];
    return [labels.length ? { role, content, updated: labels } : { role, content }];
  });
  return messages.length ? messages : [GREETING];
}

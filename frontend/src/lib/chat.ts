import { ApiError } from "./api";
import type { Values } from "./registry";

/** A chat bubble. `updated` lists the fields an assistant turn filled in. */
export type ChatMessage = { role: "user" | "assistant"; content: string; updated?: string[] };

export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I’ll help you draft a legal agreement. What do you need? For example a Mutual NDA, a Cloud Service Agreement, a Data Processing Agreement or a Pilot Agreement. Describe your situation and I’ll suggest the right document.",
};

export type FieldUpdate = { field: string; value: string };

/** The AI's turn: its reply, the document being drafted (once agreed) and field changes. */
export type ChatTurn = { reply: string; documentType: string | null; updates: FieldUpdate[] };

/** The backend caps the history it accepts; older turns are dropped first. */
export const MAX_HISTORY = 40;

/** Asks the AI for its next turn, given the conversation, the selected document and its values. */
export async function sendChat(
  messages: ChatMessage[],
  documentType: string | null,
  values: Values,
  fetchImpl: typeof fetch = fetch,
): Promise<ChatTurn> {
  let res: Response;
  try {
    res = await fetchImpl("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages.slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content })),
        documentType,
        values,
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

import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { GREETING, MAX_HISTORY, applyUpdates, parseChat, sendChat, type ChatMessage } from "./chat";
import { defaultNdaData } from "./nda";
import { completeData } from "./test-fixtures";

describe("applyUpdates", () => {
  it("applies non-null values and reports what changed", () => {
    const { data, changed } = applyUpdates(defaultNdaData, {
      governingLaw: "Delaware",
      jurisdiction: null,
      party1: { company: "Acme Inc.", name: null },
      party2: null,
    });
    expect(data.governingLaw).toBe("Delaware");
    expect(data.jurisdiction).toBe("");
    expect(data.party1).toEqual({ ...defaultNdaData.party1, company: "Acme Inc." });
    expect(data.party2).toEqual(defaultNdaData.party2);
    expect(changed).toEqual(["Governing law", "Party 1 company"]);
  });

  it("reports nothing when values are unchanged", () => {
    const { data, changed } = applyUpdates(completeData, { governingLaw: completeData.governingLaw });
    expect(changed).toEqual([]);
    expect(data).toEqual(completeData);
  });

  it("validates values like a saved draft", () => {
    const { data } = applyUpdates(defaultNdaData, {
      mndaTermYears: 500,
      confidentialityType: "forever" as never,
      purpose: 42 as never,
    });
    expect(data.mndaTermYears).toBe(99);
    expect(data.confidentialityType).toBe(defaultNdaData.confidentialityType);
    expect(data.purpose).toBe(defaultNdaData.purpose);
  });

  it("labels paired term fields once", () => {
    const { changed } = applyUpdates(defaultNdaData, { mndaTermType: "expires", mndaTermYears: 3 });
    expect(changed).toEqual(["MNDA term"]);
  });
});

describe("sendChat", () => {
  const ok = (body: unknown) => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body)));

  it("posts role/content history and the draft", async () => {
    const turn = { reply: "Hi", updates: {} };
    const fetchImpl = ok(turn);
    const history: ChatMessage[] = [GREETING, { role: "user", content: "Acme" }, { role: "assistant", content: "Ok", updated: ["Purpose"] }];

    await expect(sendChat(history, completeData, fetchImpl)).resolves.toEqual(turn);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/chat/nda");
    const body = JSON.parse(init?.body as string);
    expect(body.document).toEqual(completeData);
    expect(body.messages[2]).toEqual({ role: "assistant", content: "Ok" });
  });

  it("sends only the most recent messages", async () => {
    const fetchImpl = ok({ reply: "", updates: {} });
    const history: ChatMessage[] = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({ role: "user", content: `m${i}` }));
    await sendChat(history, completeData, fetchImpl);
    const { messages } = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string);
    expect(messages).toHaveLength(MAX_HISTORY);
    expect(messages.at(-1).content).toBe(`m${MAX_HISTORY + 4}`);
  });

  it("surfaces the server's error detail", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ detail: "AI down" }), { status: 502 }));
    await expect(sendChat([GREETING], completeData, fetchImpl)).rejects.toThrow("AI down");
  });

  it("falls back to a generic error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("oops", { status: 500 }));
    await expect(sendChat([GREETING], completeData, fetchImpl)).rejects.toThrow(ApiError);
  });

  it("reports network failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(sendChat([GREETING], completeData, fetchImpl)).rejects.toThrow(/reach the server/);
  });
});

describe("parseChat", () => {
  it("keeps valid messages", () => {
    const saved = [GREETING, { role: "user", content: "hi" }, { role: "assistant", content: "ok", updated: ["Purpose", 3] }];
    expect(parseChat(saved)).toEqual([GREETING, { role: "user", content: "hi" }, { role: "assistant", content: "ok", updated: ["Purpose"] }]);
  });

  it("drops invalid entries", () => {
    expect(parseChat([{ role: "system", content: "x" }, { role: "user", content: "" }, null, { role: "user", content: "hi" }])).toEqual([
      { role: "user", content: "hi" },
    ]);
  });

  it.each([null, {}, "x", []])("falls back to the greeting for %j", (input) => {
    expect(parseChat(input)).toEqual([GREETING]);
  });
});

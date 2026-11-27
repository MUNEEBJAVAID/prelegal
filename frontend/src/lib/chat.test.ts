import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { GREETING, MAX_HISTORY, parseChat, sendChat, type ChatMessage } from "./chat";

const values = { "provider.company": "Acme" };

describe("sendChat", () => {
  const ok = (body: unknown) => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body)));

  it("posts role/content history, the document type and its values", async () => {
    const turn = { reply: "Hi", documentType: "csa", updates: [] };
    const fetchImpl = ok(turn);
    const history: ChatMessage[] = [GREETING, { role: "user", content: "Acme" }, { role: "assistant", content: "Ok", updated: ["Purpose"] }];

    await expect(sendChat(history, "csa", values, fetchImpl)).resolves.toEqual(turn);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/chat");
    const body = JSON.parse(init?.body as string);
    expect(body.documentType).toBe("csa");
    expect(body.values).toEqual(values);
    expect(body.messages[2]).toEqual({ role: "assistant", content: "Ok" });
  });

  it("sends only the most recent messages", async () => {
    const fetchImpl = ok({ reply: "", documentType: null, updates: [] });
    const history: ChatMessage[] = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({ role: "user", content: `m${i}` }));
    await sendChat(history, null, {}, fetchImpl);
    const { messages } = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string);
    expect(messages).toHaveLength(MAX_HISTORY);
    expect(messages.at(-1).content).toBe(`m${MAX_HISTORY + 4}`);
  });

  it("surfaces the server's error detail", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ detail: "AI down" }), { status: 502 }));
    await expect(sendChat([GREETING], null, {}, fetchImpl)).rejects.toThrow("AI down");
  });

  it("falls back to a generic error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("oops", { status: 500 }));
    await expect(sendChat([GREETING], null, {}, fetchImpl)).rejects.toThrow(ApiError);
  });

  it("reports network failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(sendChat([GREETING], null, {}, fetchImpl)).rejects.toThrow(/reach the server/);
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

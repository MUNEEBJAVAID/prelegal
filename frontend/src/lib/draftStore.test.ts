import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { SavedDocument } from "./api";
import { GREETING } from "./chat";
import { SAVE_DELAY_MS, draftActions, getDraft, hasContent, parseDraftContent } from "./draftStore";

const store = () => draftActions;

const saved = (id: number, body: Partial<SavedDocument> = {}) =>
  new Response(
    JSON.stringify({
      id,
      documentType: null,
      values: {},
      messages: [],
      ...body,
    }),
    { status: 200 },
  );

let fetchMock: Mock;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  store().startNew();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseDraftContent", () => {
  it("keeps a valid saved document", () => {
    const doc = {
      documentType: "csa",
      values: { "provider.company": "Acme" },
      messages: [GREETING],
    };
    expect(parseDraftContent(doc)).toEqual(doc);
  });

  it("drops invalid entries", () => {
    const bad = {
      documentType: 3,
      values: { a: 1, b: "ok" },
      messages: "x",
    } as unknown as SavedDocument;
    expect(parseDraftContent(bad)).toEqual({
      documentType: null,
      values: { b: "ok" },
      messages: [GREETING],
    });
  });
});

describe("hasContent", () => {
  it("is false for an untouched draft", () => {
    expect(hasContent({ documentType: null, values: {}, messages: [GREETING] })).toBe(false);
  });

  it("is true once a document is chosen or the user writes", () => {
    expect(hasContent({ documentType: "sla", values: {}, messages: [GREETING] })).toBe(true);
    expect(
      hasContent({
        documentType: null,
        values: {},
        messages: [GREETING, { role: "user", content: "hi" }],
      }),
    ).toBe(true);
  });
});

describe("draft auto-save", () => {
  it("doesn't save an untouched draft", async () => {
    store().update({ values: {} });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getDraft().status).toBe("new");
  });

  it("creates the document once, then updates it", async () => {
    fetchMock.mockResolvedValueOnce(saved(5)).mockResolvedValueOnce(saved(5));
    store().update({ documentType: "csa" });
    store().update({ values: { "provider.company": "Acme" } });
    expect(getDraft().status).toBe("pending");

    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/documents");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      documentType: "csa",
      values: { "provider.company": "Acme" },
      messages: [GREETING],
    });
    expect(getDraft()).toMatchObject({ id: 5, status: "saved" });

    store().update({ values: { "provider.company": "Acme Inc" } });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/documents/5");
    expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
  });

  it("saves changes made while a save is in flight", async () => {
    let finish: (r: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((r) => (finish = r))).mockResolvedValueOnce(saved(9));
    store().update({ documentType: "sla" });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    store().update({ values: { targetUptime: "99.9%" } });
    finish(saved(9));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/documents/9");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).values).toEqual({
      targetUptime: "99.9%",
    });
  });

  it("reports a failed save and retries on request", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 })).mockResolvedValueOnce(saved(3));
    store().update({ documentType: "dpa" });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(getDraft().status).toBe("error");
    store().saveNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(getDraft()).toMatchObject({ id: 3, status: "saved" });
  });

  it("ignores a late save of a draft that was replaced", async () => {
    let finish: (r: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((r) => (finish = r)));
    store().update({ documentType: "psa" });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    store().open({
      id: 42,
      documentType: "csa",
      title: "x",
      createdAt: "",
      updatedAt: "",
      values: {},
      messages: [],
    });
    finish(saved(8));
    await vi.advanceTimersByTimeAsync(0);
    expect(getDraft()).toMatchObject({
      id: 42,
      documentType: "csa",
      status: "saved",
    });
  });
});

describe("flush", () => {
  it("saves a waiting change immediately", async () => {
    fetchMock.mockResolvedValueOnce(saved(4));
    store().update({ documentType: "baa" });
    store().flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getDraft()).toMatchObject({ id: 4, status: "saved" });
  });

  it("does nothing without a waiting change", async () => {
    store().flush();
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("switching drafts", () => {
  it("saves the old draft's waiting change before loading another", async () => {
    fetchMock.mockResolvedValue(saved(1));
    store().update({ documentType: "csa" });
    store().startNew();
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).documentType).toBe("csa");
    expect(getDraft()).toMatchObject({ id: null, documentType: null, status: "new" });
  });

  it("discards without saving", async () => {
    store().update({ documentType: "csa" });
    store().discard();
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves the new draft even while the old one's save is in flight", async () => {
    let finish: (r: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((r) => (finish = r))).mockResolvedValueOnce(saved(2));
    store().update({ documentType: "psa" });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    store().startNew();
    store().update({ documentType: "sla" });
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getDraft()).toMatchObject({ id: 2, documentType: "sla", status: "saved" });
    finish(saved(1));
    await vi.advanceTimersByTimeAsync(0);
    expect(getDraft().id).toBe(2);
  });

  it("gives each loaded draft a new key", () => {
    const before = getDraft().key;
    store().startNew();
    expect(getDraft().key).not.toBe(before);
  });
});

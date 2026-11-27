import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createDocument,
  deleteDocument,
  fetchMe,
  login,
  setUnauthorizedHandler,
  signUp,
  updateDocument,
} from "./api";

const respond = (status: number, body: unknown = {}) =>
  vi
    .fn<typeof fetch>()
    .mockImplementation(async () => new Response(status === 204 ? null : JSON.stringify(body), { status }));

const content = {
  documentType: "csa",
  values: { "provider.company": "Acme" },
  messages: [],
};

describe("auth", () => {
  it("posts the credentials and returns the user", async () => {
    const fetchImpl = respond(200, { id: 1, email: "jane@example.com" });
    await expect(login("jane@example.com", "pw", fetchImpl)).resolves.toEqual({
      id: 1,
      email: "jane@example.com",
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      email: "jane@example.com",
      password: "pw",
    });
  });

  it("shows the server's message", async () => {
    await expect(login("a@b.co", "pw", respond(401, { detail: "Incorrect email or password." }))).rejects.toThrow(
      "Incorrect email or password.",
    );
    await expect(
      signUp("a@b.co", "password1", respond(409, { detail: "An account with this email already exists." })),
    ).rejects.toThrow(/already exists/);
  });

  it("falls back to a generic message", async () => {
    const err = await login("a@b.co", "pw", respond(500)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
  });

  it("reports network failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(login("a@b.co", "pw", fetchImpl)).rejects.toThrow(/reach the server/);
  });

  it("treats a 401 from /me as signed out", async () => {
    await expect(fetchMe(respond(401))).resolves.toBeNull();
    await expect(fetchMe(respond(200, { id: 2, email: "a@b.co" }))).resolves.toEqual({ id: 2, email: "a@b.co" });
  });
});

describe("documents", () => {
  it("creates and updates with the draft as JSON", async () => {
    const fetchImpl = respond(200, { id: 7, ...content });
    await createDocument(content, fetchImpl);
    await updateDocument(7, content, fetchImpl);
    expect(fetchImpl.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/documents", "POST"],
      ["/api/documents/7", "PUT"],
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[1][1]?.body as string)).toEqual(content);
  });

  it("handles empty 204 responses", async () => {
    await expect(deleteDocument(7, respond(204))).resolves.toBeUndefined();
  });

  it("reports an expired session outside the auth routes", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(deleteDocument(7, respond(401, { detail: "Please sign in." }))).rejects.toThrow("Please sign in.");
    await fetchMe(respond(401));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

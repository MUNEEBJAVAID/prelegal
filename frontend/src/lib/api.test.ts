import { describe, expect, it, vi } from "vitest";
import { ApiError, login } from "./api";

const respond = (status: number, body: unknown = {}) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("login", () => {
  it("posts the credentials and returns the user", async () => {
    const fetchImpl = respond(200, { id: 1, email: "jane@example.com" });
    await expect(login("jane@example.com", "pw", fetchImpl)).resolves.toEqual({ id: 1, email: "jane@example.com" });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ email: "jane@example.com", password: "pw" });
  });

  it("explains invalid input", async () => {
    await expect(login("x", "pw", respond(422))).rejects.toThrow(/valid email/);
  });

  it("reports server errors", async () => {
    await expect(login("a@b.co", "pw", respond(500))).rejects.toThrow(ApiError);
  });

  it("reports network failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(login("a@b.co", "pw", fetchImpl)).rejects.toThrow(/reach the server/);
  });
});

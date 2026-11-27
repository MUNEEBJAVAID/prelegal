import { describe, expect, it } from "vitest";
import { validateAuth } from "./AuthForm";
import { formatUpdated } from "./DocumentsDashboard";

describe("validateAuth", () => {
  it("accepts a valid sign-in", () => {
    expect(validateAuth("signin", " jane@acme.com ", "x")).toBeNull();
  });

  it.each(["", "jane", "jane@acme", "jane @acme.com"])("rejects the email %j", (email) => {
    expect(validateAuth("signin", email, "x")).toMatchObject({
      field: "email",
      message: expect.stringMatching(/valid email/),
    });
  });

  it("requires a password", () => {
    expect(validateAuth("signin", "jane@acme.com", "")).toMatchObject({
      field: "password",
    });
  });

  it("requires 8 characters to sign up", () => {
    expect(validateAuth("signup", "jane@acme.com", "short")?.message).toMatch(/at least 8/);
    expect(validateAuth("signup", "jane@acme.com", "long enough")).toBeNull();
  });
});

describe("formatUpdated", () => {
  const now = new Date(2026, 10, 28, 15, 0);

  it("names today and yesterday", () => {
    expect(formatUpdated(new Date(2026, 10, 28, 9, 5).toISOString(), now)).toBe("Today, 09:05");
    expect(formatUpdated(new Date(2026, 10, 27, 23, 30).toISOString(), now)).toBe("Yesterday, 23:30");
  });

  it("uses the date for older edits", () => {
    expect(formatUpdated(new Date(2026, 2, 3, 12).toISOString(), now)).toBe("3 Mar 2026");
  });

  it("ignores invalid dates", () => {
    expect(formatUpdated("nope", now)).toBe("");
  });
});

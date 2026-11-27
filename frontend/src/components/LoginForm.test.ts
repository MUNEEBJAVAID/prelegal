import { describe, expect, it } from "vitest";
import { validateLogin } from "./LoginForm";

describe("validateLogin", () => {
  it("accepts any email and password", () => {
    expect(validateLogin(" jane@acme.com ", "x")).toBeNull();
  });

  it.each(["", "jane", "jane@acme", "jane @acme.com"])("rejects the email %j", (email) => {
    expect(validateLogin(email, "x")).toMatch(/valid email/);
  });

  it("requires a password", () => {
    expect(validateLogin("jane@acme.com", "")).toMatch(/password/);
  });
});

import { describe, expect, it } from "vitest";
import { parseSession } from "./session";

describe("parseSession", () => {
  it("reads a stored user", () => {
    expect(parseSession('{"id":3,"email":"a@b.co"}')).toEqual({ id: 3, email: "a@b.co" });
  });

  it("drops unknown fields", () => {
    expect(parseSession('{"id":3,"email":"a@b.co","admin":true}')).toEqual({ id: 3, email: "a@b.co" });
  });

  it.each([null, "", "not json", "null", "[]", '{"id":"3","email":"a@b.co"}', '{"id":3,"email":""}', '{"id":3}'])(
    "treats %j as signed out",
    (raw) => {
      expect(parseSession(raw)).toBeNull();
    },
  );
});

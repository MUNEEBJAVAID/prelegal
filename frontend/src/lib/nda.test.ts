import { describe, expect, it } from "vitest";
import {
  REQUIRED_FIELDS,
  clampYears,
  defaultNdaData,
  formatDate,
  getMissingFields,
  parseDraft,
  todayIso,
  years,
} from "./nda";
import { completeData } from "./test-fixtures";

describe("getMissingFields", () => {
  it("lists every empty required field for a blank NDA (purpose has a default)", () => {
    const ids = getMissingFields(defaultNdaData).map((f) => f.id);
    expect(ids).toHaveLength(REQUIRED_FIELDS.length - 1);
    expect(ids).not.toContain("purpose");
    expect(ids).toContain("party2-noticeAddress");
  });

  it("returns nothing when everything is filled in", () => {
    expect(getMissingFields(completeData)).toEqual([]);
  });

  it("treats whitespace-only values as missing", () => {
    const ids = getMissingFields({ ...completeData, governingLaw: "   " }).map((f) => f.id);
    expect(ids).toEqual(["governingLaw"]);
  });
});

describe("formatDate", () => {
  it("formats ISO dates without time-zone drift", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("rejects empty and invalid dates", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("2026-02-30")).toBe("");
    expect(formatDate("not a date")).toBe("");
  });
});

describe("helpers", () => {
  it("pluralizes years", () => {
    expect(years(1)).toBe("1 year");
    expect(years(3)).toBe("3 years");
  });

  it("clamps years to 1–99", () => {
    expect(clampYears(0)).toBe(1);
    expect(clampYears(150)).toBe(99);
    expect(clampYears(Number.NaN)).toBe(1);
    expect(clampYears(2.4)).toBe(2);
  });

  it("formats today's date in local time", () => {
    expect(todayIso(new Date(2026, 10, 7))).toBe("2026-11-07");
  });
});

describe("parseDraft", () => {
  it("round-trips valid data", () => {
    expect(parseDraft(JSON.parse(JSON.stringify(completeData)))).toEqual(completeData);
  });

  it("falls back to defaults for missing or malformed values", () => {
    const parsed = parseDraft({
      purpose: 42,
      mndaTermType: "forever",
      mndaTermYears: 500,
      party1: { company: "Acme", name: null },
      party2: "nope",
    });
    expect(parsed.purpose).toBe(defaultNdaData.purpose);
    expect(parsed.mndaTermType).toBe("expires");
    expect(parsed.mndaTermYears).toBe(99);
    expect(parsed.party1).toEqual({ ...defaultNdaData.party1, company: "Acme" });
    expect(parsed.party2).toEqual(defaultNdaData.party2);
  });

  it("returns the fallback for non-objects", () => {
    expect(parseDraft(null)).toBe(defaultNdaData);
    expect(parseDraft("x")).toBe(defaultNdaData);
  });
});

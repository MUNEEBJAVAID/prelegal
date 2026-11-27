import { describe, expect, it } from "vitest";
import { fileBaseName } from "./download";
import { applyFieldUpdates } from "./genericDocument";
import { defaultNdaData, ndaFromValues, ndaToValues } from "./nda";
import { completeData, docDef } from "./test-fixtures";

describe("NDA flat values", () => {
  it("round-trips the draft", () => {
    expect(ndaFromValues(ndaToValues(completeData), defaultNdaData)).toEqual(completeData);
  });

  it("uses the registry's field keys", () => {
    const keys = docDef("mutual-nda")
      .fields.map((f) => f.key)
      .sort();
    expect(Object.keys(ndaToValues(completeData)).sort()).toEqual(keys);
  });

  it("applies AI updates through the registry and validates them", () => {
    const nda = docDef("mutual-nda");
    const { values, changed } = applyFieldUpdates(nda, ndaToValues(defaultNdaData), [
      { field: "party1.company", value: "Acme" },
      { field: "mndaTermYears", value: "500" },
      { field: "confidentialityType", value: "perpetuity" },
    ]);
    const data = ndaFromValues(values, defaultNdaData);
    expect(data.party1.company).toBe("Acme");
    expect(data.mndaTermYears).toBe(99);
    expect(data.confidentialityType).toBe("perpetuity");
    expect(changed).toEqual(["Party 1 company", "MNDA Term years", "Term of Confidentiality type"]);
  });
});

describe("fileBaseName", () => {
  it("slugs the prefix and company names", () => {
    expect(fileBaseName("csa", ["Acme Inc.", "", "  Beta & Co "])).toBe("csa-acme-inc-beta-co");
  });
});

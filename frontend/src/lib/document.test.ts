import { describe, expect, it } from "vitest";
import { buildNdaDocument, type Block } from "./document";
import { defaultNdaData } from "./nda";
import { completeData, terms } from "./test-fixtures";

const section = (blocks: Block[], id: string) => {
  const b = blocks.find((x) => x.type === "section" && x.id === id);
  if (!b || b.type !== "section") throw new Error(`no section ${id}`);
  return b;
};

describe("buildNdaDocument", () => {
  it("fills in the cover page from the form data", () => {
    const { blocks } = buildNdaDocument(completeData, terms);
    expect(section(blocks, "effective-date").content).toEqual([
      { type: "paragraph", runs: [{ text: "November 17, 2026" }] },
    ]);
    const mndaTerm = section(blocks, "mnda-term").content[0];
    expect(mndaTerm.type === "options" && mndaTerm.options.map((o) => o.checked)).toEqual([true, false]);
    expect(JSON.stringify(mndaTerm)).toContain("Expires 2 years from Effective Date.");
    const conf = section(blocks, "confidentiality").content[0];
    expect(conf.type === "options" && conf.options.map((o) => o.checked)).toEqual([false, true]);
  });

  it("uses placeholders for blank values", () => {
    const { blocks } = buildNdaDocument(defaultNdaData, terms);
    const law = section(blocks, "governing-law").content[0];
    expect(law).toEqual({
      type: "paragraph",
      runs: [{ text: "Governing Law: " }, { text: "[Governing Law]", placeholder: true }],
    });
    expect(section(blocks, "modifications").content[0]).toEqual({
      type: "paragraph",
      runs: [{ text: "None." }],
    });
  });

  it("builds the signature table with blank signature and date rows", () => {
    const sig = buildNdaDocument(completeData, terms).blocks.find((b) => b.type === "signatures");
    if (sig?.type !== "signatures") throw new Error("no signature table");
    expect(sig.rows.map((r) => r.label)).toEqual(["Signature", "Print Name", "Title", "Company", "Notice Address", "Date"]);
    expect(sig.rows[0].blank).toBe(true);
    expect(sig.rows[1].cells).toEqual([[{ text: "Jane Doe" }], [{ text: "John Roe" }]]);
  });

  it("includes every Standard Terms clause after the cover page", () => {
    const { blocks } = buildNdaDocument(completeData, terms);
    const headingAt = blocks.findIndex((b) => b.type === "heading");
    expect(blocks.slice(headingAt).filter((b) => b.type === "clause")).toHaveLength(11);
  });

  it("resolves Cover Page references to the entered values", () => {
    const { refs } = buildNdaDocument(completeData, terms);
    expect(refs["Governing Law"]).toEqual({ value: "Delaware", target: "governing-law" });
    expect(refs["Term of Confidentiality"].value).toBe("In perpetuity.");
    expect(buildNdaDocument(defaultNdaData, terms).refs.Jurisdiction.value).toBe("");
  });
});

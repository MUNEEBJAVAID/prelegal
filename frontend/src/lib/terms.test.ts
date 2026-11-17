import { describe, expect, it } from "vitest";
import { parseInline, parseStandardTerms } from "./terms";
import { terms } from "./test-fixtures";

describe("parseInline", () => {
  it("parses bold, links and Cover Page references", () => {
    expect(
      parseInline(
        'A **bold** [link](https://x.test) for the <span class="coverpage_link">Purpose</span>.',
      ),
    ).toEqual([
      { text: "A " },
      { text: "bold", bold: true },
      { text: " " },
      { text: "link", href: "https://x.test" },
      { text: " for the " },
      { text: "Purpose", ref: "Purpose" },
      { text: "." },
    ]);
  });

  it("keeps unknown references as plain text", () => {
    expect(parseInline('<span class="coverpage_link">Other</span>')).toEqual([{ text: "Other" }]);
  });
});

describe("parseStandardTerms", () => {
  it("parses all 11 clauses of the Mutual NDA template", () => {
    expect(terms.clauses.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(terms.clauses[0].runs[0]).toEqual({ text: "Introduction", bold: true });
  });

  it("finds every Cover Page reference", () => {
    const refs = new Set(terms.clauses.flatMap((c) => c.runs.map((r) => r.ref).filter(Boolean)));
    expect(refs).toEqual(
      new Set(["Purpose", "Effective Date", "MNDA Term", "Term of Confidentiality", "Governing Law", "Jurisdiction"]),
    );
  });

  it("keeps the attribution footer and skips headings", () => {
    expect(terms.footer.map((r) => r.text).join("")).toContain("Common Paper Mutual Non-Disclosure Agreement");
    expect(JSON.stringify(terms)).not.toContain("# Standard Terms");
  });

  it("handles Windows line endings", () => {
    expect(parseStandardTerms("# T\r\n\r\n1. **A**. x\r\n\r\n2. **B**. y").clauses).toHaveLength(2);
  });
});

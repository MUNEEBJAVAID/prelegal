import { Packer } from "docx";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { buildNdaDocument } from "../document";
import { defaultNdaData } from "../nda";
import { completeData, terms } from "../test-fixtures";
import { buildDocx } from "./docx";
import { renderMarkdown } from "./markdown";
import { NdaPdf } from "./pdf";

const doc = buildNdaDocument(completeData, terms);

describe("renderMarkdown", () => {
  const md = renderMarkdown(doc);

  it("renders the cover page with checkboxes reflecting the selections", () => {
    expect(md).toMatch(/^# Mutual Non-Disclosure Agreement\n/);
    expect(md).toContain("- [x] Expires 2 years from Effective Date.");
    expect(md).toContain("- [ ] 1 year from Effective Date");
    expect(md).toContain("- [x] In perpetuity.");
    expect(md).toContain("Governing Law: Delaware");
  });

  it("escapes pipes and line breaks inside table cells", () => {
    expect(md).toContain("| Company | Acme \\| Inc | Globex LLC |");
    expect(md).toContain("| Notice Address | legal@acme.com<br>1 Main St | notices@globex.com |");
  });

  it("includes all Standard Terms without template markup", () => {
    expect(md).toContain("## Standard Terms");
    expect(md).toMatch(/^11\. \*\*General\*\*/m);
    expect(md).not.toContain("<span");
  });

  it("shows placeholders for blank fields", () => {
    expect(renderMarkdown(buildNdaDocument(defaultNdaData, terms))).toContain("Jurisdiction: [Jurisdiction]");
  });
});

describe("binary renderers", () => {
  it("produces a Word (.docx) package", async () => {
    const buf = await Packer.toBuffer(buildDocx(doc));
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });

  it("produces a PDF", async () => {
    const buf = await renderToBuffer(createElement(NdaPdf, { doc }) as never);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildNdaDocument } from "@/lib/document";
import { buildGenericDocument } from "@/lib/genericDocument";
import { clausesOf, completeData, docDef, documents, terms } from "@/lib/test-fixtures";
import { DocumentPicker } from "./DocumentPicker";
import { DocumentPreview } from "./DocumentPreview";
import { DraftingWorkspace } from "./DraftingWorkspace";
import { GenericForm } from "./GenericForm";

// Smoke tests: components render (server-side) without throwing.
const generic = documents.filter((d) => d.kind === "generic");
const catalog = {
  documents,
  clauses: Object.fromEntries(generic.map((d) => [d.id, clausesOf(d.id)])),
  ndaTerms: terms,
};

describe("DraftingWorkspace", () => {
  it("starts with the chat and the document picker", () => {
    const html = renderToStaticMarkup(createElement(DraftingWorkspace, { catalog }));
    expect(html).toContain("What would you like to draft?");
    expect(html).toContain("I’ll help you draft a legal agreement");
    for (const d of documents) expect(html).toContain(d.name);
  });
});

describe("DocumentPreview", () => {
  it("renders the Mutual NDA", () => {
    const html = renderToStaticMarkup(createElement(DocumentPreview, { doc: buildNdaDocument(completeData, terms) }));
    expect(html).toContain("PARTY 1");
    expect(html).toContain('data-value="Delaware"');
  });

  it.each(generic.map((d) => d.id))("renders %s with term references linked to the cover page", (id) => {
    const doc = docDef(id);
    const company = `${doc.parties[0]} Co`;
    const values = { [`${doc.parties[0].toLowerCase()}.company`]: company };
    const html = renderToStaticMarkup(
      createElement(DocumentPreview, { doc: buildGenericDocument(doc, values, clausesOf(id)) }),
    );
    expect(html).toContain(doc.parties[0].toUpperCase());
    expect(html).toContain('href="#cover-parties"');
    expect(html).toContain(`data-value="${company}"`);
  });
});

describe("GenericForm", () => {
  it("renders inputs for every field, flagging missing ones", () => {
    const doc = docDef("dpa");
    const html = renderToStaticMarkup(
      createElement(GenericForm, { doc, values: {}, onChange: () => {}, flagged: new Set(["field-agreement"]) }),
    );
    for (const f of doc.fields) expect(html).toContain(`id="field-${f.key.replace(".", "-")}"`);
    expect(html).toContain("Required");
    expect(html).toContain('type="date"');
  });
});

describe("DocumentPicker", () => {
  it("lists every document", () => {
    const html = renderToStaticMarkup(createElement(DocumentPicker, { documents, onSelect: () => {} }));
    expect(html.match(/<button/g)).toHaveLength(documents.length);
  });
});

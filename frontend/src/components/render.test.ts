import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DISCLAIMER, buildNdaDocument } from "@/lib/document";
import { buildGenericDocument } from "@/lib/genericDocument";
import { clausesOf, completeData, docDef, documents, terms } from "@/lib/test-fixtures";
import { AuthForm } from "./AuthForm";
import { DocumentPicker } from "./DocumentPicker";
import { DocumentPreview } from "./DocumentPreview";
import { DocumentsDashboard } from "./DocumentsDashboard";
import { DraftingWorkspace } from "./DraftingWorkspace";
import { GenericForm } from "./GenericForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {}, push: () => {} }),
  usePathname: () => "/draft/",
  useSearchParams: () => new URLSearchParams(),
}));

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

describe("AuthForm", () => {
  it.each([
    ["signin", "Welcome back", "Create an account"],
    ["signup", "Create your account", "Sign in"],
  ] as const)("renders the %s screen", (mode, title, link) => {
    const html = renderToStaticMarkup(createElement(AuthForm, { mode }));
    expect(html).toContain(title);
    expect(html).toContain(link);
  });
});

describe("DocumentsDashboard", () => {
  it("shows a loading state first", () => {
    const html = renderToStaticMarkup(createElement(DocumentsDashboard));
    expect(html).toContain("My documents");
    expect(html).toContain("aria-busy");
  });
});

describe("disclaimer", () => {
  it("closes every document model", () => {
    const models = [
      buildNdaDocument(completeData, terms),
      ...generic.map((d) => buildGenericDocument(d, {}, clausesOf(d.id))),
    ];
    for (const m of models) {
      const last = m.blocks.at(-1);
      expect(last?.type === "paragraph" && last.runs.map((r) => r.text).join("")).toContain(DISCLAIMER);
    }
  });
});

describe("DocumentPreview", () => {
  it("renders the Mutual NDA", () => {
    const html = renderToStaticMarkup(
      createElement(DocumentPreview, {
        doc: buildNdaDocument(completeData, terms),
      }),
    );
    expect(html).toContain("PARTY 1");
    expect(html).toContain('data-value="Delaware"');
  });

  it.each(generic.map((d) => d.id))("renders %s with term references linked to the cover page", (id) => {
    const doc = docDef(id);
    const company = `${doc.parties[0]} Co`;
    const values = { [`${doc.parties[0].toLowerCase()}.company`]: company };
    const html = renderToStaticMarkup(
      createElement(DocumentPreview, {
        doc: buildGenericDocument(doc, values, clausesOf(id)),
      }),
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
      createElement(GenericForm, {
        doc,
        values: {},
        onChange: () => {},
        flagged: new Set(["field-agreement"]),
      }),
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

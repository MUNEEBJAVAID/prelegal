import { describe, expect, it } from "vitest";
import {
  applyFieldUpdates,
  buildGenericDocument,
  displayValue,
  fieldId,
  getMissingGenericFields,
} from "./genericDocument";
import { resolveTerm } from "./registry";
import { renderMarkdown } from "./render/markdown";
import { parseClauses } from "./terms";
import { clausesOf, docDef, documents } from "./test-fixtures";

const generic = documents.filter((d) => d.kind === "generic");

describe("registry", () => {
  it("has 11 document types, the Mutual NDA plus 10 generic ones", () => {
    expect(documents).toHaveLength(11);
    expect(generic).toHaveLength(10);
  });

  it.each(generic.map((d) => d.id))("%s: every term its template references resolves", (id) => {
    const doc = docDef(id);
    const terms = new Set(clausesOf(id).flatMap((c) => c.runs.flatMap((r) => (r.ref ? [r.ref] : []))));
    expect(terms.size).toBeGreaterThan(0);
    const unresolved = [...terms].filter((t) => Object.keys(resolveTerm(doc, t)).length === 0);
    expect(unresolved).toEqual([]);
  });

  it("resolves parties, possessives, plurals and aliases", () => {
    const csa = docDef("csa");
    expect(resolveTerm(csa, "Customer’s")).toEqual({ party: "Customer" });
    expect(resolveTerm(csa, "Subscription Periods").field?.key).toBe("subscriptionPeriod");
    expect(resolveTerm(csa, "Provider Covered Claim").field?.key).toBe("providerCoveredClaims");
    expect(resolveTerm(docDef("psa"), "Deliverable").field?.key).toBe("deliverables");
    expect(resolveTerm(docDef("pilot"), "Notice Address")).toEqual({ notice: true });
    expect(resolveTerm(csa, "Nonsense")).toEqual({});
  });
});

describe("parseClauses", () => {
  it("numbers sections, clauses and sub-items", () => {
    const lines = parseClauses(
      "# T\n\n1. <span class=\"header_2\">Service</span>\n    1. <span class=\"header_3\">Use.</span> Text.\n        a. First\n            i. Deep\n    2. Second\n2. <span class=\"header_2\">Next</span>\n    1. Again\n",
    );
    expect(lines.map((l) => [l.level, l.label])).toEqual([
      [0, "1."],
      [1, "1.1"],
      [2, "(a)"],
      [3, "(i)"],
      [1, "1.2"],
      [0, "2."],
      [1, "2.1"],
    ]);
    expect(lines[0].runs).toEqual([{ text: "Service", bold: true }]);
  });

  it.each(generic.map((d) => d.id))("%s: parses the template without leftover markup", (id) => {
    const lines = clausesOf(id);
    expect(lines.length).toBeGreaterThan(10);
    expect(lines[0]).toMatchObject({ level: 0, label: "1." });
    const text = lines.flatMap((l) => l.runs.map((r) => r.text)).join(" ");
    expect(text).not.toMatch(/<span|<\/span>|\*\*/);
  });
});

describe("buildGenericDocument", () => {
  const sla = docDef("sla");
  const values = {
    "provider.company": "Acme Cloud",
    "customer.company": "Beta Corp",
    "customer.noticeAddress": "legal@beta.test",
    effectiveDate: "2026-12-01",
    targetUptime: "99.9%",
  };
  const doc = buildGenericDocument(sla, values, clausesOf("sla"));

  it("generates a cover page with every key term, then the Standard Terms", () => {
    const md = renderMarkdown(doc);
    expect(md).toMatch(/^# Service Level Agreement\n/);
    expect(md).toContain("this Order Form (“**Order Form**”)");
    expect(md).toContain("Provider: Acme Cloud");
    expect(md).toContain("### Target Uptime\n\n99.9%");
    expect(md).toContain("### Effective Date\n\nDecember 1, 2026");
    expect(md).toContain("### Support Channel\n\n[Support Channel]");
    expect(md).toContain("### Scheduled Downtime\n\nNone.");
    expect(md).toContain("| | PROVIDER | CUSTOMER |");
    expect(md).toContain("| Company | Acme Cloud | Beta Corp |");
    expect(md).toContain("## Standard Terms");
    expect(md).toMatch(/^1\. \*\*Uptime\*\*/m);
    expect(md).toMatch(/^ {4}1\.1 \*\*Target Uptime\.\*\*/m);
  });

  it("resolves template references to cover page values", () => {
    expect(doc.refs["Target Uptime"]).toEqual({ value: "99.9%", target: "targetUptime" });
    expect(doc.refs.Provider).toEqual({ value: "Acme Cloud", target: "parties" });
    expect(doc.refs["Provider’s"]).toEqual({ value: "Acme Cloud", target: "parties" });
    expect(doc.refs["Support Channel"].value).toBe("");
  });

  it("joins both parties' notice addresses for 'Notice Address'", () => {
    const pilot = buildGenericDocument(
      docDef("pilot"),
      { "provider.noticeAddress": "a@acme.test", "customer.noticeAddress": "b@beta.test" },
      clausesOf("pilot"),
    );
    expect(pilot.refs["Notice Address"].value).toBe("Provider: a@acme.test; Customer: b@beta.test");
  });

  it.each(generic.map((d) => d.id))("%s: builds with empty values", (id) => {
    const built = buildGenericDocument(docDef(id), {}, clausesOf(id));
    expect(built.title).toBe(docDef(id).name);
    expect(built.blocks.filter((b) => b.type === "clause").length).toBe(clausesOf(id).length);
  });
});

describe("getMissingGenericFields", () => {
  it("lists blank required fields with their form ids", () => {
    const missing = getMissingGenericFields(docDef("pilot"), { "provider.company": "Acme", pilotPeriod: " " });
    const ids = missing.map((m) => m.id);
    expect(ids).toContain(fieldId("pilotPeriod"));
    expect(ids).toContain("field-customer-company");
    expect(ids).not.toContain("field-provider-company");
    expect(missing.find((m) => m.id === fieldId("pilotPeriod"))?.label).toBe("Pilot Period");
  });
});

describe("applyFieldUpdates", () => {
  it("applies known fields and reports changed labels once", () => {
    const { values, changed } = applyFieldUpdates(docDef("pilot"), { pilotPeriod: "30 days" }, [
      { field: "provider.company", value: "Acme" },
      { field: "pilotPeriod", value: "30 days" },
      { field: "unknown", value: "x" },
    ]);
    expect(values).toEqual({ pilotPeriod: "30 days", "provider.company": "Acme" });
    expect(changed).toEqual(["Provider company"]);
  });
});

describe("displayValue", () => {
  it("formats dates and keeps other text", () => {
    const sla = docDef("sla");
    const date = sla.fields.find((f) => f.key === "effectiveDate")!;
    const text = sla.fields.find((f) => f.key === "targetUptime")!;
    expect(displayValue(date, { effectiveDate: "2026-01-05" })).toBe("January 5, 2026");
    expect(displayValue(date, { effectiveDate: "soon" })).toBe("soon");
    expect(displayValue(text, { targetUptime: " 99% " })).toBe("99%");
  });
});

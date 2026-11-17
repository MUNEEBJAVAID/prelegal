import type { ReactNode } from "react";
import { InlineMarkdown } from "./InlineMarkdown";
import {
  LICENSE_URL,
  STANDARD_TERMS_URL,
  confidentialityText,
  formatDate,
  mndaTermText,
  type NdaData,
} from "@/lib/nda";
import type { Clause } from "@/lib/nda";

type Props = {
  data: NdaData;
  clauses: Clause[];
  footer: string;
};

/** A user-entered value, or a highlighted placeholder when it is still blank. */
function Field({ value, placeholder }: { value: string; placeholder: string }) {
  const v = value.trim();
  if (v) return <span className="whitespace-pre-line">{v}</span>;
  return (
    <span className="rounded bg-amber-100 px-1 text-amber-900 print:bg-transparent print:text-neutral-500">
      [{placeholder}]
    </span>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-neutral-200 py-3">
      <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
      {hint && <p className="text-xs italic text-neutral-500">{hint}</p>}
      <div className="mt-1">{children}</div>
    </section>
  );
}

function Option({ checked, children }: { checked: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="font-mono">{checked ? "☒" : "☐"}</span>
      <span className={checked ? "" : "text-neutral-400 line-through print:no-underline"}>
        {children}
      </span>
    </li>
  );
}

export function NdaDocument({ data, clauses, footer }: Props) {
  const { party1: p1, party2: p2 } = data;
  const rows: [string, string, string][] = [
    ["Print Name", p1.name, p2.name],
    ["Title", p1.title, p2.title],
    ["Company", p1.company, p2.company],
    ["Notice Address", p1.noticeAddress, p2.noticeAddress],
  ];

  return (
    <article className="nda-document mx-auto max-w-[8.5in] bg-white px-10 py-12 font-serif text-[15px] leading-relaxed text-neutral-900 shadow-lg ring-1 ring-neutral-200 print:max-w-none print:p-0 print:shadow-none print:ring-0">
      <h1 className="mb-4 text-center text-2xl font-bold">Mutual Non-Disclosure Agreement</h1>

      <p className="mb-4 text-sm">
        This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page
        (“<strong>Cover Page</strong>”) and (2) the Common Paper Mutual NDA Standard Terms Version
        1.0 (“<strong>Standard Terms</strong>”) identical to those posted at{" "}
        <a href={STANDARD_TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline">
          commonpaper.com/standards/mutual-nda/1.0
        </a>
        . Any modifications of the Standard Terms should be made on the Cover Page, which will
        control over conflicts with the Standard Terms.
      </p>

      <Section title="Purpose" hint="How Confidential Information may be used">
        <Field value={data.purpose} placeholder="Purpose" />
      </Section>

      <Section title="Effective Date">
        <Field value={formatDate(data.effectiveDate)} placeholder="Effective Date" />
      </Section>

      <Section title="MNDA Term" hint="The length of this MNDA">
        <ul>
          <Option checked={data.mndaTermType === "expires"}>
            {data.mndaTermType === "expires"
              ? mndaTermText(data)
              : "Expires a fixed number of years from Effective Date."}
          </Option>
          <Option checked={data.mndaTermType === "until-terminated"}>
            Continues until terminated in accordance with the terms of the MNDA.
          </Option>
        </ul>
      </Section>

      <Section title="Term of Confidentiality" hint="How long Confidential Information is protected">
        <ul>
          <Option checked={data.confidentialityType === "years"}>
            {data.confidentialityType === "years"
              ? confidentialityText(data)
              : "A fixed number of years from Effective Date (trade secrets protected while they remain trade secrets)."}
          </Option>
          <Option checked={data.confidentialityType === "perpetuity"}>In perpetuity.</Option>
        </ul>
      </Section>

      <Section title="Governing Law & Jurisdiction">
        <p>
          Governing Law: <Field value={data.governingLaw} placeholder="Governing Law" />
        </p>
        <p>
          Jurisdiction: <Field value={data.jurisdiction} placeholder="Jurisdiction" />
        </p>
      </Section>

      <Section title="MNDA Modifications">
        <span className="whitespace-pre-line">{data.modifications.trim() || "None."}</span>
      </Section>

      <p className="border-t border-neutral-200 pt-3">
        By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective
        Date.
      </p>

      <table className="mt-3 w-full table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-1/4" />
            <th className="border border-neutral-300 bg-neutral-50 p-2">PARTY 1</th>
            <th className="border border-neutral-300 bg-neutral-50 p-2">PARTY 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className="border border-neutral-300 p-2 text-left font-semibold">Signature</th>
            <td className="h-14 border border-neutral-300" />
            <td className="h-14 border border-neutral-300" />
          </tr>
          {rows.map(([label, a, b]) => (
            <tr key={label}>
              <th className="border border-neutral-300 p-2 text-left font-semibold">{label}</th>
              <td className="border border-neutral-300 p-2 break-words">
                <Field value={a} placeholder={label} />
              </td>
              <td className="border border-neutral-300 p-2 break-words">
                <Field value={b} placeholder={label} />
              </td>
            </tr>
          ))}
          <tr>
            <th className="border border-neutral-300 p-2 text-left font-semibold">Date</th>
            <td className="h-10 border border-neutral-300" />
            <td className="h-10 border border-neutral-300" />
          </tr>
        </tbody>
      </table>

      <p className="mt-3 text-xs text-neutral-500">
        Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under{" "}
        <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="underline">
          CC BY 4.0
        </a>
        .
      </p>

      <h2 className="mt-10 mb-4 text-center text-xl font-bold print:break-before-page">
        Standard Terms
      </h2>
      <ol className="space-y-3 text-sm text-justify">
        {clauses.map((c) => (
          <li key={c.number} className="flex gap-2">
            <span className="shrink-0">{c.number}.</span>
            <span>
              <InlineMarkdown text={c.text} />
            </span>
          </li>
        ))}
      </ol>
      {footer && (
        <p className="mt-6 text-xs text-neutral-500">
          <InlineMarkdown text={footer} />
        </p>
      )}
    </article>
  );
}

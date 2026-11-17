"use client";

import type { ReactNode } from "react";
import { todayIso, type NdaData, type Party } from "@/lib/nda";

type Props = {
  data: NdaData;
  onChange: (data: NdaData) => void;
};

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";

function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-neutral-800">
      {children}
      {hint && <span className="ml-1 font-normal text-neutral-500">— {hint}</span>}
    </label>
  );
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function YearsInput({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <input
      id={id}
      type="number"
      min={1}
      max={99}
      value={value}
      disabled={disabled}
      aria-label="Number of years"
      onChange={(e) => onChange(Math.min(99, Math.max(1, Number(e.target.value) || 1)))}
      className={`${inputClass} w-20 disabled:bg-neutral-100 disabled:text-neutral-400`}
    />
  );
}

function PartyFields({
  id,
  label,
  party,
  onChange,
}: {
  id: string;
  label: string;
  party: Party;
  onChange: (p: Party) => void;
}) {
  const set = (key: keyof Party) => (e: { target: { value: string } }) =>
    onChange({ ...party, [key]: e.target.value });
  return (
    <Fieldset legend={label}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-company`}>Company</Label>
          <input id={`${id}-company`} className={inputClass} value={party.company} onChange={set("company")} placeholder="Acme, Inc." />
        </div>
        <div>
          <Label htmlFor={`${id}-name`}>Signer name</Label>
          <input id={`${id}-name`} className={inputClass} value={party.name} onChange={set("name")} placeholder="Jane Doe" autoComplete="off" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`${id}-title`}>Signer title</Label>
          <input id={`${id}-title`} className={inputClass} value={party.title} onChange={set("title")} placeholder="CEO" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`${id}-address`} hint="email or postal address">
            Notice address
          </Label>
          <textarea id={`${id}-address`} rows={2} className={inputClass} value={party.noticeAddress} onChange={set("noticeAddress")} placeholder="legal@acme.com" />
        </div>
      </div>
    </Fieldset>
  );
}

export function NdaForm({ data, onChange }: Props) {
  const update = <K extends keyof NdaData>(key: K, value: NdaData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <PartyFields id="party1" label="Party 1" party={data.party1} onChange={(p) => update("party1", p)} />
      <PartyFields id="party2" label="Party 2" party={data.party2} onChange={(p) => update("party2", p)} />

      <Fieldset legend="Agreement details">
        <div>
          <Label htmlFor="purpose" hint="how Confidential Information may be used">
            Purpose
          </Label>
          <textarea id="purpose" rows={3} className={inputClass} value={data.purpose} onChange={(e) => update("purpose", e.target.value)} />
        </div>

        <div>
          <Label htmlFor="effectiveDate">Effective date</Label>
          <div className="flex gap-2">
            <input id="effectiveDate" type="date" className={inputClass} value={data.effectiveDate} onChange={(e) => update("effectiveDate", e.target.value)} />
            <button
              type="button"
              onClick={() => update("effectiveDate", todayIso())}
              className="shrink-0 rounded-md border border-neutral-300 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Today
            </button>
          </div>
        </div>

        <div role="radiogroup" aria-labelledby="mndaTerm-label">
          <p id="mndaTerm-label" className="mb-1 text-sm font-medium text-neutral-800">
            MNDA term <span className="font-normal text-neutral-500">— the length of this MNDA</span>
          </p>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="mndaTerm" checked={data.mndaTermType === "expires"} onChange={() => update("mndaTermType", "expires")} />
              Expires
              <YearsInput id="mndaTermYears" value={data.mndaTermYears} disabled={data.mndaTermType !== "expires"} onChange={(n) => update("mndaTermYears", n)} />
              year(s) from Effective Date
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="mndaTerm" checked={data.mndaTermType === "until-terminated"} onChange={() => update("mndaTermType", "until-terminated")} />
              Continues until terminated
            </label>
          </div>
        </div>

        <div role="radiogroup" aria-labelledby="confidentiality-label">
          <p id="confidentiality-label" className="mb-1 text-sm font-medium text-neutral-800">
            Term of confidentiality{" "}
            <span className="font-normal text-neutral-500">— how long information is protected</span>
          </p>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="confidentiality" checked={data.confidentialityType === "years"} onChange={() => update("confidentialityType", "years")} />
              <YearsInput id="confidentialityYears" value={data.confidentialityYears} disabled={data.confidentialityType !== "years"} onChange={(n) => update("confidentialityYears", n)} />
              year(s) from Effective Date
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="confidentiality" checked={data.confidentialityType === "perpetuity"} onChange={() => update("confidentialityType", "perpetuity")} />
              In perpetuity
            </label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="governingLaw">Governing law (state)</Label>
            <input id="governingLaw" className={inputClass} value={data.governingLaw} onChange={(e) => update("governingLaw", e.target.value)} placeholder="Delaware" />
          </div>
          <div>
            <Label htmlFor="jurisdiction">Jurisdiction</Label>
            <input id="jurisdiction" className={inputClass} value={data.jurisdiction} onChange={(e) => update("jurisdiction", e.target.value)} placeholder="New Castle, DE" />
          </div>
        </div>

        <div>
          <Label htmlFor="modifications" hint="optional">
            MNDA modifications
          </Label>
          <textarea id="modifications" rows={3} className={inputClass} value={data.modifications} onChange={(e) => update("modifications", e.target.value)} placeholder="List any modifications to the Standard Terms" />
        </div>
      </Fieldset>
    </form>
  );
}

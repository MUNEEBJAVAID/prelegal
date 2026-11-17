"use client";

import type { ChangeEvent, ReactNode } from "react";
import {
  PARTY_FIELD_LABELS,
  REQUIRED_FIELDS,
  clampYears,
  todayIso,
  type NdaData,
  type Party,
  type PartyKey,
} from "@/lib/nda";

type Props = {
  data: NdaData;
  onChange: (data: NdaData) => void;
  /** Ids of required fields that are empty and should be flagged. */
  flagged: ReadonlySet<string>;
  missingCount: number;
};

const controlClass =
  "w-full rounded-md border bg-paper px-3 py-2 text-sm text-text shadow-[inset_0_1px_1px_rgba(0,0,0,0.03)] placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink";

function controlBorder(isFlagged: boolean) {
  return isFlagged ? "border-flag bg-flag-wash/40" : "border-line-strong";
}

function Field({
  id,
  label,
  hint,
  flagged,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  flagged?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-baseline justify-between gap-2 text-sm font-medium text-text">
        <span>
          {label}
          {hint && <span className="ml-1.5 font-normal text-muted">{hint}</span>}
        </span>
        {flagged && (
          <span id={`${id}-error`} className="text-xs font-medium text-flag">
            Required
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-paper/70 p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2.5 font-serif text-[1.05rem] font-semibold text-ink">
        <span className="flex size-6 items-center justify-center rounded-full bg-ink font-sans text-xs font-semibold text-white">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
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
      inputMode="numeric"
      min={1}
      max={99}
      value={value}
      disabled={disabled}
      aria-label="Number of years"
      onChange={(e) => onChange(clampYears(e.target.valueAsNumber))}
      className={`${controlClass} ${controlBorder(false)} w-16 px-2 py-1 text-center disabled:opacity-40`}
    />
  );
}

function RadioOption({
  name,
  checked,
  onSelect,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
        checked ? "border-ink bg-ink-wash/60" : "border-line-strong hover:bg-panel"
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="accent-ink" />
      {children}
    </label>
  );
}

export function NdaForm({ data, onChange, flagged, missingCount }: Props) {
  const update = <K extends keyof NdaData>(key: K, value: NdaData[K]) => onChange({ ...data, [key]: value });

  const text = (key: "purpose" | "governingLaw" | "jurisdiction" | "modifications" | "effectiveDate") => ({
    id: key,
    value: data[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(key, e.target.value),
    className: `${controlClass} ${controlBorder(flagged.has(key))}`,
    "aria-invalid": flagged.has(key) || undefined,
    "aria-describedby": flagged.has(key) ? `${key}-error` : undefined,
  });

  const partyInput = (party: PartyKey, field: keyof Party) => {
    const id = `${party}-${field}`;
    return {
      id,
      value: data[party][field],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        update(party, { ...data[party], [field]: e.target.value }),
      className: `${controlClass} ${controlBorder(flagged.has(id))}`,
      "aria-invalid": flagged.has(id) || undefined,
      "aria-describedby": flagged.has(id) ? `${id}-error` : undefined,
    };
  };

  const total = REQUIRED_FIELDS.length;
  const done = total - missingCount;

  return (
    <form className="space-y-4" onSubmit={(e) => e.preventDefault()} noValidate>
      <div className="rounded-lg border border-line bg-paper/70 px-4 py-3" aria-live="polite">
        <div className="mb-1.5 flex justify-between text-xs font-medium">
          <span className="text-text">{missingCount === 0 ? "All required details filled in" : "Required details"}</span>
          <span className="tabular-nums text-muted">
            {done} / {total}
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Required details completed"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>

      {(["party1", "party2"] as const).map((party, i) => (
        <Step key={party} n={i + 1} title={`Party ${i + 1}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${party}-company`} label="Company" flagged={flagged.has(`${party}-company`)}>
              <input {...partyInput(party, "company")} placeholder={i === 0 ? "Acme, Inc." : "Globex LLC"} autoComplete="organization" />
            </Field>
            <Field id={`${party}-name`} label="Signer name" flagged={flagged.has(`${party}-name`)}>
              <input {...partyInput(party, "name")} placeholder="Full name" autoComplete="off" />
            </Field>
            <div className="sm:col-span-2">
              <Field id={`${party}-title`} label="Signer title" flagged={flagged.has(`${party}-title`)}>
                <input {...partyInput(party, "title")} placeholder="e.g. Chief Executive Officer" autoComplete="off" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field
                id={`${party}-noticeAddress`}
                label={PARTY_FIELD_LABELS.noticeAddress}
                hint="email or postal"
                flagged={flagged.has(`${party}-noticeAddress`)}
              >
                <textarea {...partyInput(party, "noticeAddress")} rows={2} placeholder="legal@example.com" />
              </Field>
            </div>
          </div>
        </Step>
      ))}

      <Step n={3} title="Purpose & timing">
        <Field id="purpose" label="Purpose" hint="how information may be used" flagged={flagged.has("purpose")}>
          <textarea {...text("purpose")} rows={3} />
        </Field>
        <Field id="effectiveDate" label="Effective date" flagged={flagged.has("effectiveDate")}>
          <div className="flex gap-2">
            <input {...text("effectiveDate")} type="date" />
            <button
              type="button"
              onClick={() => update("effectiveDate", todayIso())}
              className="shrink-0 rounded-md border border-line-strong px-3 text-sm font-medium text-ink-soft hover:bg-panel"
            >
              Today
            </button>
          </div>
        </Field>
      </Step>

      <Step n={4} title="Terms">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-text">
            MNDA term <span className="font-normal text-muted">length of this agreement</span>
          </legend>
          <div className="space-y-2">
            <RadioOption name="mndaTerm" checked={data.mndaTermType === "expires"} onSelect={() => update("mndaTermType", "expires")}>
              Expires after
              <YearsInput
                id="mndaTermYears"
                value={data.mndaTermYears}
                disabled={data.mndaTermType !== "expires"}
                onChange={(n) => update("mndaTermYears", n)}
              />
              year(s)
            </RadioOption>
            <RadioOption
              name="mndaTerm"
              checked={data.mndaTermType === "until-terminated"}
              onSelect={() => update("mndaTermType", "until-terminated")}
            >
              Continues until terminated
            </RadioOption>
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-text">
            Confidentiality <span className="font-normal text-muted">how long information is protected</span>
          </legend>
          <div className="space-y-2">
            <RadioOption
              name="confidentiality"
              checked={data.confidentialityType === "years"}
              onSelect={() => update("confidentialityType", "years")}
            >
              <YearsInput
                id="confidentialityYears"
                value={data.confidentialityYears}
                disabled={data.confidentialityType !== "years"}
                onChange={(n) => update("confidentialityYears", n)}
              />
              year(s) from the effective date
            </RadioOption>
            <RadioOption
              name="confidentiality"
              checked={data.confidentialityType === "perpetuity"}
              onSelect={() => update("confidentialityType", "perpetuity")}
            >
              In perpetuity
            </RadioOption>
          </div>
        </fieldset>
      </Step>

      <Step n={5} title="Law & changes">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="governingLaw" label="Governing law" hint="state" flagged={flagged.has("governingLaw")}>
            <input {...text("governingLaw")} placeholder="Delaware" />
          </Field>
          <Field id="jurisdiction" label="Jurisdiction" hint="courts" flagged={flagged.has("jurisdiction")}>
            <input {...text("jurisdiction")} placeholder="New Castle, DE" />
          </Field>
        </div>
        <Field id="modifications" label="Modifications" hint="optional">
          <textarea {...text("modifications")} rows={3} placeholder="Any changes to the Standard Terms" />
        </Field>
      </Step>
    </form>
  );
}

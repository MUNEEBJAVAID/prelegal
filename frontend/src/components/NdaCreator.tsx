"use client";

import { useMemo, useState } from "react";
import { DocumentPreview } from "./DocumentPreview";
import { MissingFieldsDialog } from "./MissingFieldsDialog";
import { NdaForm } from "./NdaForm";
import { buildNdaDocument } from "@/lib/document";
import { FORMAT_LABELS, fileBaseName, renderDocument, saveBlob, type DownloadFormat } from "@/lib/download";
import { useNdaDraft } from "@/lib/draftStore";
import { getMissingFields } from "@/lib/nda";
import type { StandardTerms } from "@/lib/terms";

type View = "form" | "preview";

const FORMATS: DownloadFormat[] = ["pdf", "docx", "md"];

export function NdaCreator({ terms }: { terms: StandardTerms }) {
  const { data, persisted, setData, reset } = useNdaDraft();
  const [view, setView] = useState<View>("form");
  const [showErrors, setShowErrors] = useState(false);
  const [pending, setPending] = useState<DownloadFormat | null>(null);
  const [busy, setBusy] = useState<DownloadFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doc = useMemo(() => buildNdaDocument(data, terms), [data, terms]);
  const missing = useMemo(() => getMissingFields(data), [data]);
  const flagged = useMemo(() => new Set(showErrors ? missing.map((f) => f.id) : []), [missing, showErrors]);

  async function download(format: DownloadFormat) {
    setPending(null);
    setError(null);
    setBusy(format);
    try {
      const blob = await renderDocument(doc, format);
      saveBlob(blob, `${fileBaseName(data)}.${format}`);
    } catch (e) {
      console.error(e);
      setError(`Couldn’t create the ${FORMAT_LABELS[format]} file. Please try again.`);
    } finally {
      setBusy(null);
    }
  }

  function requestDownload(format: DownloadFormat) {
    if (missing.length) setPending(format);
    else void download(format);
  }

  function goToMissing() {
    setPending(null);
    setShowErrors(true);
    setView("form");
    const first = missing[0];
    // Wait for the form to be visible (mobile) before focusing.
    requestAnimationFrame(() => {
      const el = first && document.getElementById(first.id);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    });
  }

  function handleReset() {
    if (window.confirm("Clear all details and start a new NDA?")) {
      reset();
      setShowErrors(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/75">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="font-serif text-xl font-semibold leading-tight text-ink">
              Prelegal
              <span className="ml-2 font-sans text-sm font-normal text-muted">Mutual NDA</span>
            </p>
            <p className="text-xs text-muted" aria-live="polite">
              {persisted ? "Draft saved in this browser" : "Draft can’t be saved in this browser"}
              {" · "}
              <button type="button" onClick={handleReset} className="underline underline-offset-2 hover:text-ink">
                Start over
              </button>
            </p>
          </div>

          <div className="flex items-center gap-1.5" role="group" aria-label="Download">
            {FORMATS.map((f) => {
              const primary = f === "pdf";
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => requestDownload(f)}
                  disabled={busy !== null}
                  aria-busy={busy === f}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${
                    primary
                      ? "bg-ink text-white shadow-sm hover:bg-ink-soft"
                      : "border border-line-strong bg-paper text-ink hover:bg-panel"
                  }`}
                >
                  {busy === f ? (
                    <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    primary && (
                      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current stroke-[1.75]">
                        <path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )
                  )}
                  {primary ? "Download PDF" : FORMAT_LABELS[f]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-2 sm:px-6 lg:hidden">
          <div role="tablist" aria-label="View" className="grid grid-cols-2 rounded-lg bg-line/70 p-1 text-sm font-medium">
            {(["form", "preview"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                id={`tab-${v}`}
                aria-selected={view === v}
                aria-controls={`panel-${v}`}
                onClick={() => setView(v)}
                className={`rounded-md py-1.5 transition-colors ${view === v ? "bg-paper text-ink shadow-sm" : "text-muted"}`}
              >
                {v === "form" ? `Details${missing.length ? ` · ${missing.length} left` : ""}` : "Preview"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6">
          <p className="flex items-center justify-between gap-4 rounded-md border border-flag/40 bg-flag-wash px-4 py-2.5 text-sm text-flag">
            {error}
            <button type="button" onClick={() => setError(null)} className="font-medium underline">
              Dismiss
            </button>
          </p>
        </div>
      )}

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
        <div
          id="panel-form"
          role="tabpanel"
          aria-labelledby="tab-form"
          className={`${view === "form" ? "" : "hidden"} lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-2`}
        >
          <NdaForm data={data} onChange={setData} flagged={flagged} missingCount={missing.length} />
        </div>
        <div
          id="panel-preview"
          role="tabpanel"
          aria-labelledby="tab-preview"
          className={`${view === "preview" ? "" : "hidden"} min-w-0 lg:block`}
        >
          <DocumentPreview doc={doc} />
        </div>
      </main>

      {pending && (
        <MissingFieldsDialog
          formatLabel={FORMAT_LABELS[pending]}
          missing={missing}
          onComplete={goToMissing}
          onDownloadAnyway={() => void download(pending)}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}

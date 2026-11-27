"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChatPanel } from "./ChatPanel";
import { DocumentPicker } from "./DocumentPicker";
import { DocumentPreview } from "./DocumentPreview";
import { GenericForm } from "./GenericForm";
import { MissingFieldsDialog } from "./MissingFieldsDialog";
import { NdaForm } from "./NdaForm";
import type { Catalog } from "@/lib/catalog.server";
import type { ChatTurn } from "@/lib/chat";
import { useChat } from "@/lib/chatStore";
import { buildNdaDocument, type DocumentModel } from "@/lib/document";
import { FORMAT_LABELS, fileBaseName, renderDocument, saveBlob, type DownloadFormat } from "@/lib/download";
import { useNdaDraft } from "@/lib/draftStore";
import { applyFieldUpdates, buildGenericDocument, getMissingGenericFields } from "@/lib/genericDocument";
import { getMissingFields, ndaFromValues, ndaToValues, type RequiredField } from "@/lib/nda";
import { partyKey, type DocDef, type Values } from "@/lib/registry";
import { useWorkspace } from "@/lib/workspaceStore";

type View = "form" | "preview";
/** Left panel: AI chat, or the fields for direct edits. */
type Panel = "chat" | "fields";

const FORMATS: DownloadFormat[] = ["pdf", "docx", "md"];

/** The selected document, in the shape the workspace works with. */
type ActiveDocument = {
  def: DocDef;
  model: DocumentModel;
  values: Values;
  missing: RequiredField[];
  fileBase: string;
  form: (flagged: ReadonlySet<string>) => ReactNode;
};

export function DraftingWorkspace({ catalog }: { catalog: Catalog }) {
  const { data: ndaData, setData: setNdaData, persisted, reset: resetNda } = useNdaDraft();
  const { documentType, values: docValues, setDocumentType, setValues, reset: resetWorkspace } = useWorkspace();
  const { reset: resetChat } = useChat();
  const [view, setView] = useState<View>("form");
  const [panel, setPanel] = useState<Panel>("chat");
  const [showErrors, setShowErrors] = useState(false);
  const [pending, setPending] = useState<DownloadFormat | null>(null);
  const [busy, setBusy] = useState<DownloadFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const findDoc = useCallback((id: string | null) => catalog.documents.find((d) => d.id === id), [catalog]);
  const def = findDoc(documentType);

  const active = useMemo((): ActiveDocument | null => {
    if (!def) return null;
    if (def.kind === "nda") {
      return {
        def,
        model: buildNdaDocument(ndaData, catalog.ndaTerms),
        values: ndaToValues(ndaData),
        missing: getMissingFields(ndaData),
        fileBase: fileBaseName("mutual-nda", [ndaData.party1.company, ndaData.party2.company]),
        form: (flagged) => (
          <NdaForm data={ndaData} onChange={setNdaData} flagged={flagged} missingCount={getMissingFields(ndaData).length} />
        ),
      };
    }
    const values = docValues[def.id] ?? {};
    return {
      def,
      model: buildGenericDocument(def, values, catalog.clauses[def.id] ?? []),
      values,
      missing: getMissingGenericFields(def, values),
      fileBase: fileBaseName(def.id, def.parties.map((p) => values[`${partyKey(p)}.company`] ?? "")),
      form: (flagged) => (
        <GenericForm doc={def} values={values} onChange={(v) => setValues(def.id, v)} flagged={flagged} />
      ),
    };
  }, [def, ndaData, setNdaData, docValues, setValues, catalog]);

  const missing = useMemo(() => active?.missing ?? [], [active]);
  const flagged = useMemo(() => new Set(showErrors ? missing.map((f) => f.id) : []), [missing, showErrors]);

  // Chat replies arrive asynchronously: apply them to the latest drafts, not the ones at send time.
  const latest = useRef({ nda: ndaData, values: docValues });
  useEffect(() => {
    latest.current = { nda: ndaData, values: docValues };
  }, [ndaData, docValues]);

  const handleTurn = useCallback(
    (turn: ChatTurn): string[] => {
      const target = findDoc(turn.documentType);
      if (!target) return [];
      if (target.id !== documentType) {
        setDocumentType(target.id);
        setShowErrors(false);
      }
      if (target.kind === "nda") {
        const current = latest.current.nda;
        const { values, changed } = applyFieldUpdates(target, ndaToValues(current), turn.updates);
        if (changed.length) setNdaData(ndaFromValues(values, current));
        return changed;
      }
      const { values, changed } = applyFieldUpdates(target, latest.current.values[target.id] ?? {}, turn.updates);
      if (changed.length) setValues(target.id, values);
      return changed;
    },
    [findDoc, documentType, setDocumentType, setValues, setNdaData],
  );

  async function download(format: DownloadFormat) {
    if (!active) return;
    setPending(null);
    setError(null);
    setBusy(format);
    try {
      const blob = await renderDocument(active.model, format);
      saveBlob(blob, `${active.fileBase}.${format}`);
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
    setPanel("fields");
    const first = missing[0];
    // Wait for the form to be visible before focusing.
    requestAnimationFrame(() => {
      const el = first && document.getElementById(first.id);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    });
  }

  function selectDocument(id: string | null) {
    setDocumentType(id);
    setShowErrors(false);
    if (!id) setPanel("chat");
  }

  function handleReset() {
    if (window.confirm("Clear all documents and the conversation, and start over?")) {
      resetNda();
      resetWorkspace();
      resetChat();
      setShowErrors(false);
      setPanel("chat");
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/75">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="font-serif text-xl font-semibold leading-tight text-ink">
              Prelegal
              <span className="ml-2 font-sans text-sm font-normal text-muted">{def ? def.shortName : "New document"}</span>
            </p>
            <p className="text-xs text-muted" aria-live="polite">
              {persisted ? "Drafts saved in this browser" : "Drafts can’t be saved in this browser"}
              {def && (
                <>
                  {" · "}
                  <button type="button" onClick={() => selectDocument(null)} className="underline underline-offset-2 hover:text-ink">
                    Change document
                  </button>
                </>
              )}
              {" · "}
              <button type="button" onClick={handleReset} className="underline underline-offset-2 hover:text-ink">
                Start over
              </button>
            </p>
          </div>

          {active && (
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
          )}
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
                {v === "form" ? `Draft${missing.length ? ` · ${missing.length} left` : ""}` : def ? "Preview" : "Documents"}
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
          <div role="tablist" aria-label="Drafting mode" className="mb-3 flex gap-1 border-b border-line text-sm font-medium">
            {(["chat", "fields"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={panel === p}
                disabled={p === "fields" && !active}
                title={p === "fields" && !active ? "Choose a document first" : undefined}
                onClick={() => setPanel(p)}
                className={`-mb-px border-b-2 px-3 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  panel === p ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {p === "chat" ? "Chat" : `Edit fields${missing.length ? ` · ${missing.length} left` : ""}`}
              </button>
            ))}
          </div>
          {panel === "fields" && active ? (
            active.form(flagged)
          ) : (
            <ChatPanel documentType={def?.id ?? null} values={active?.values ?? {}} onTurn={handleTurn} />
          )}
        </div>
        <div
          id="panel-preview"
          role="tabpanel"
          aria-labelledby="tab-preview"
          className={`${view === "preview" ? "" : "hidden"} min-w-0 lg:block`}
        >
          {active ? (
            <DocumentPreview doc={active.model} />
          ) : (
            <DocumentPicker documents={catalog.documents} onSelect={selectDocument} />
          )}
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

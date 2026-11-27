"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChatPanel } from "./ChatPanel";
import { DocumentPicker } from "./DocumentPicker";
import { DocumentPreview } from "./DocumentPreview";
import { GenericForm } from "./GenericForm";
import { MissingFieldsDialog } from "./MissingFieldsDialog";
import { NdaForm } from "./NdaForm";
import { ApiError, getDocument } from "@/lib/api";
import type { Catalog } from "@/lib/catalog.server";
import type { ChatTurn } from "@/lib/chat";
import { DISCLAIMER, buildNdaDocument, type DocumentModel } from "@/lib/document";
import { FORMAT_LABELS, fileBaseName, renderDocument, saveBlob, type DownloadFormat } from "@/lib/download";
import { getDraft, useDraft, type SaveStatus } from "@/lib/draftStore";
import { applyFieldUpdates, buildGenericDocument, getMissingGenericFields } from "@/lib/genericDocument";
import {
  REQUIRED_FIELDS,
  defaultNdaData,
  getMissingFields,
  ndaFromValues,
  ndaToValues,
  todayIso,
  type NdaData,
  type RequiredField,
} from "@/lib/nda";
import { partyKey, type DocDef, type Values } from "@/lib/registry";

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
  requiredCount: number;
  fileBase: string;
  form: (flagged: ReadonlySet<string>) => ReactNode;
};

export function DraftingWorkspace({ catalog }: { catalog: Catalog }) {
  const {
    id,
    key,
    documentType,
    values: draftValues,
    messages,
    status,
    update,
    open,
    startNew,
    saveNow,
    flush,
  } = useDraft();
  const router = useRouter();
  const idParam = Number(useSearchParams().get("id")) || null;
  const [loadError, setLoadError] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const [view, setView] = useState<View>("form");
  const [panel, setPanel] = useState<Panel>("chat");
  const [showErrors, setShowErrors] = useState(false);
  const [pending, setPending] = useState<DownloadFormat | null>(null);
  const [busy, setBusy] = useState<DownloadFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const findDoc = useCallback((docId: string | null) => catalog.documents.find((d) => d.id === docId), [catalog]);
  const def = findDoc(documentType);

  /** The id this page put in the URL itself after a first save: nothing to load for it. */
  const assignedId = useRef<number | null>(null);

  // The URL names the saved document: /draft/?id=12 opens it, /draft/ starts a new one.
  useEffect(() => {
    if (idParam === null) {
      startNew();
      return;
    }
    // Keep the draft in memory only when it has changes the server doesn't have yet;
    // otherwise reload it, in case it was deleted or edited elsewhere.
    const current = getDraft();
    if (
      idParam === current.id &&
      (idParam === assignedId.current || current.status === "pending" || current.status === "saving")
    )
      return;
    let cancelled = false;
    getDocument(idParam)
      .then((doc) => !cancelled && open(doc))
      .catch((e) => {
        if (!cancelled)
          setLoadError({
            id: idParam,
            message: e instanceof ApiError ? e.message : "Couldn’t open this document.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [idParam, open, startNew]);

  // Don't lose a change still waiting for the auto-save when the user leaves.
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  // Once a new draft is first saved, put its id in the URL so a reload reopens it.
  const prevId = useRef(id);
  useEffect(() => {
    if (prevId.current === null && id !== null && idParam === null) {
      assignedId.current = id;
      router.replace(`/draft/?id=${id}`);
    }
    prevId.current = id;
  }, [id, idParam, router]);

  // The NDA is stored as flat values; a fresh one defaults its effective date to today.
  const ndaFallback = useMemo<NdaData>(() => ({ ...defaultNdaData, effectiveDate: todayIso() }), []);
  const ndaData = useMemo(() => ndaFromValues(draftValues, ndaFallback), [draftValues, ndaFallback]);
  const setNdaData = useCallback(
    (data: NdaData) => update({ values: { ...getDraft().values, ...ndaToValues(data) } }),
    [update],
  );
  /** Values for a newly chosen document: the NDA starts from its defaults. */
  const seedValues = useCallback(
    (doc: DocDef | undefined, values: Values) =>
      doc?.kind === "nda" ? { ...ndaToValues(ndaFallback), ...values } : values,
    [ndaFallback],
  );

  const active = useMemo((): ActiveDocument | null => {
    if (!def) return null;
    if (def.kind === "nda") {
      return {
        def,
        model: buildNdaDocument(ndaData, catalog.ndaTerms),
        values: ndaToValues(ndaData),
        missing: getMissingFields(ndaData),
        requiredCount: REQUIRED_FIELDS.length,
        fileBase: fileBaseName("mutual-nda", [ndaData.party1.company, ndaData.party2.company]),
        form: (flagged) => (
          <NdaForm
            data={ndaData}
            onChange={setNdaData}
            flagged={flagged}
            missingCount={getMissingFields(ndaData).length}
          />
        ),
      };
    }
    const values = draftValues;
    return {
      def,
      model: buildGenericDocument(def, values, catalog.clauses[def.id] ?? []),
      values,
      missing: getMissingGenericFields(def, values),
      requiredCount: def.fields.filter((f) => f.required).length,
      fileBase: fileBaseName(
        def.id,
        def.parties.map((p) => values[`${partyKey(p)}.company`] ?? ""),
      ),
      form: (flagged) => (
        <GenericForm doc={def} values={values} onChange={(v) => update({ values: v })} flagged={flagged} />
      ),
    };
  }, [def, ndaData, setNdaData, draftValues, update, catalog]);

  const missing = useMemo(() => active?.missing ?? [], [active]);
  const flagged = useMemo(() => new Set(showErrors ? missing.map((f) => f.id) : []), [missing, showErrors]);

  // Chat replies arrive asynchronously: apply them to the latest draft, not the one at send time.
  const handleTurn = useCallback(
    (turn: ChatTurn): string[] => {
      const target = findDoc(turn.documentType);
      if (!target) return [];
      const current = getDraft();
      let values = current.values;
      if (target.id !== current.documentType) {
        values = seedValues(target, values);
        setShowErrors(false);
      }
      const fields = target.kind === "nda" ? ndaToValues(ndaFromValues(values, ndaFallback)) : values;
      const result = applyFieldUpdates(target, fields, turn.updates);
      update({
        documentType: target.id,
        values: { ...values, ...result.values },
      });
      return result.changed;
    },
    [findDoc, seedValues, ndaFallback, update],
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

  /** Picking a document by hand (not via chat): the assistant picks up from there. */
  function selectDocument(docId: string | null) {
    const next = findDoc(docId);
    setShowErrors(false);
    setPanel("chat");
    setView("form");
    if (!next || next.id === documentType) {
      update({ documentType: docId });
      return;
    }
    const [a, b] = next.parties;
    const who = a ? `the ${a} and the ${b}` : "the two companies";
    update({
      documentType: next.id,
      values: seedValues(next, draftValues),
      messages: [
        ...messages,
        {
          role: "assistant",
          content: `Let’s draft a ${next.name}. I’ll ask a few questions and fill it in as we go. You can also type into the fields directly under “Edit fields”.\n\nTo start: who are the parties, ${who}? Please include each company’s legal name.`,
        },
      ],
    });
  }

  if (idParam !== null && (id !== idParam || loadError?.id === idParam)) {
    const failed = loadError?.id === idParam ? loadError.message : null;
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        {failed ? (
          <>
            <p className="text-sm text-flag">{failed}</p>
            <Link href="/documents/" className="text-sm font-medium text-ink underline underline-offset-2">
              Back to My documents
            </Link>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
            Opening document…
          </p>
        )}
      </main>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/75">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold leading-tight text-ink">{def ? def.name : "New document"}</h1>
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
              <SaveIndicator status={status} onRetry={saveNow} />
              {def && (
                <>
                  <span aria-hidden>·</span>
                  <button
                    type="button"
                    onClick={() => selectDocument(null)}
                    className="underline underline-offset-2 hover:text-ink"
                  >
                    Change document
                  </button>
                </>
              )}
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
                      <span
                        aria-hidden
                        className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                      />
                    ) : (
                      primary && (
                        <svg
                          aria-hidden
                          viewBox="0 0 16 16"
                          className="size-3.5 fill-none stroke-current stroke-[1.75]"
                        >
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
          <div
            role="tablist"
            aria-label="View"
            className="grid grid-cols-2 rounded-lg bg-line/70 p-1 text-sm font-medium"
          >
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
                {v === "form"
                  ? `Draft${missing.length ? ` · ${missing.length} left` : ""}`
                  : def
                    ? "Preview"
                    : "Documents"}
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
          <div
            role="tablist"
            aria-label="Drafting mode"
            className="mb-3 flex gap-1 border-b border-line text-sm font-medium"
          >
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
          {/* The NDA form shows its own progress meter. */}
          {active && !(panel === "fields" && active.def.kind === "nda") && (
            <Progress missing={missing.length} total={active.requiredCount} />
          )}
          {panel === "fields" && active ? (
            active.form(flagged)
          ) : (
            <ChatPanel key={key} documentType={def?.id ?? null} values={active?.values ?? {}} onTurn={handleTurn} />
          )}
        </div>
        <div
          id="panel-preview"
          role="tabpanel"
          aria-labelledby="tab-preview"
          className={`${view === "preview" ? "" : "hidden"} min-w-0 lg:block`}
        >
          {active ? (
            <>
              <p
                role="note"
                className="mb-4 flex gap-2.5 rounded-lg border border-brand-yellow/50 bg-brand-yellow/10 px-4 py-3 text-xs leading-relaxed text-ink"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className="mt-px size-4 shrink-0 fill-none stroke-brand-yellow stroke-[1.75]"
                >
                  <path
                    d="M8 1.75 14.5 13.5h-13L8 1.75ZM8 6v3.25M8 11.25v.01"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  <strong className="font-semibold">Draft for legal review.</strong> {DISCLAIMER}
                </span>
              </p>
              <DocumentPreview doc={active.model} />
            </>
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

/** How many required details are filled in, and whether the document is ready to download. */
function Progress({ missing, total }: { missing: number; total: number }) {
  const done = total - missing;
  const pct = total ? Math.round((done / total) * 100) : 100;
  return (
    <div className="mb-3" aria-live="polite">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className={missing ? "text-muted" : "font-medium text-ink"}>
          {missing ? `${done} of ${total} required details` : "All required details are filled in"}
        </span>
        <span className="text-muted">{missing ? `${pct}%` : "Ready to download"}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Required details completed"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const SAVE_LABELS: Record<SaveStatus, string> = {
  new: "Not saved yet",
  pending: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved to My documents",
  error: "Couldn’t save",
};

/** Auto-save state of the draft, with a retry when saving failed. */
function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const dot =
    status === "saved"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-flag"
        : status === "new"
          ? "bg-line-strong"
          : "bg-brand-yellow";
  return (
    <span aria-live="polite" className={`inline-flex items-center gap-1.5 ${status === "error" ? "text-flag" : ""}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      {SAVE_LABELS[status]}
      {status === "error" && (
        <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
          Retry
        </button>
      )}
    </span>
  );
}

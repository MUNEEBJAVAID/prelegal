"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, deleteDocument, listDocuments, type DocumentSummary } from "@/lib/api";

/** "Today, 14:05", "Yesterday, 09:12" or "3 Mar 2026". */
export function formatUpdated(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86_400_000);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; docs: DocumentSummary[] };

/** The signed-in user's saved documents, newest first. */
export function DocumentsDashboard() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listDocuments()
      .then((docs) => setLoad({ state: "ready", docs }))
      .catch((e) =>
        setLoad({
          state: "error",
          message: e instanceof ApiError ? e.message : "Couldn’t load your documents.",
        }),
      );
  }, []);
  useEffect(refresh, [refresh]);

  async function remove(doc: DocumentSummary) {
    if (!window.confirm(`Delete “${doc.title}”? This can’t be undone.`)) return;
    setDeleting(doc.id);
    setError(null);
    try {
      await deleteDocument(doc.id);
      setLoad((l) => (l.state === "ready" ? { state: "ready", docs: l.docs.filter((d) => d.id !== doc.id) } : l));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn’t delete the document.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">My documents</h1>
          <p className="mt-1 text-sm text-muted">
            Drafts save automatically as you work. Open one to keep editing or download it.
          </p>
        </div>
        <Link
          href="/draft/"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple/90"
        >
          <span aria-hidden className="text-base leading-none">
            +
          </span>{" "}
          New document
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-flag/30 bg-flag-wash px-4 py-2.5 text-sm text-flag">
          {error}
        </p>
      )}

      <section aria-label="Saved documents" className="mt-8">
        {load.state === "loading" && (
          <ul className="space-y-3" aria-busy>
            <li role="status" className="sr-only">
              Loading your documents…
            </li>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-[4.5rem] animate-pulse rounded-xl border border-line bg-white" />
            ))}
          </ul>
        )}

        {load.state === "error" && (
          <div className="rounded-xl border border-line bg-white px-6 py-10 text-center">
            <p className="text-sm text-flag">{load.message}</p>
            <button type="button" onClick={refresh} className="mt-3 text-sm font-medium text-link hover:underline">
              Try again
            </button>
          </div>
        )}

        {load.state === "ready" && load.docs.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong bg-white px-6 py-16 text-center">
            <p className="text-base font-medium text-ink">No documents yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Start a draft and tell the assistant what you need. It picks the right agreement and fills it in with you.
            </p>
            <Link href="/draft/" className="mt-5 inline-block text-sm font-semibold text-link hover:underline">
              Draft your first document →
            </Link>
          </div>
        )}

        {load.state === "ready" && load.docs.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            {load.docs.map((doc) => (
              <li
                key={doc.id}
                className="group relative flex items-center gap-4 px-5 py-4 transition-colors hover:bg-panel"
              >
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-wash text-ink">
                  <svg viewBox="0 0 20 20" className="size-5 fill-none stroke-current stroke-[1.5]">
                    <path d="M5 2.75h6.5L15 6.25v11H5z M11.5 2.75v3.5H15 M7.5 10h5M7.5 13h5" strokeLinejoin="round" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/draft/?id=${doc.id}`}
                    className="block truncate font-medium text-ink after:absolute after:inset-0 group-hover:underline"
                  >
                    {doc.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">Edited {formatUpdated(doc.updatedAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(doc)}
                  disabled={deleting === doc.id}
                  aria-label={`Delete ${doc.title}`}
                  className="relative z-10 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-flag-wash hover:text-flag disabled:opacity-50"
                >
                  {deleting === doc.id ? "Deleting…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

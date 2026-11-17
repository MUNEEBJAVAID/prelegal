"use client";

import { useEffect, useRef } from "react";
import type { RequiredField } from "@/lib/nda";

type Props = {
  formatLabel: string;
  missing: RequiredField[];
  onComplete: () => void;
  onDownloadAnyway: () => void;
  onClose: () => void;
};

/** Asks before downloading an NDA that still has empty required fields. */
export function MissingFieldsDialog({ formatLabel, missing, onComplete, onDownloadAnyway, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="missing-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-paper p-0 text-text shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-6">
        <h2 id="missing-title" className="font-serif text-lg font-semibold text-ink">
          Some details are still blank
        </h2>
        <p className="mt-1 text-sm text-muted">
          {missing.length === 1 ? "This field" : `These ${missing.length} fields`} will appear as placeholders in your{" "}
          {formatLabel} file:
        </p>
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-md border border-line bg-panel px-4 py-2.5 text-sm">
          {missing.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <span aria-hidden className="size-1.5 rounded-full bg-flag" />
              {f.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line bg-panel px-6 py-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onDownloadAnyway}
          className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-line/60"
        >
          Download anyway
        </button>
        <button
          type="button"
          autoFocus
          onClick={onComplete}
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-ink-soft"
        >
          Fill in missing details
        </button>
      </div>
    </dialog>
  );
}

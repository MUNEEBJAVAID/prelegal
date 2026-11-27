"use client";

import { useSyncExternalStore } from "react";
import { createDocument, updateDocument, type DraftContent, type SavedDocument } from "./api";
import { GREETING, parseChat } from "./chat";
import type { Values } from "./registry";

/**
 * The document being drafted (its type, field values and chat), auto-saved to
 * the signed-in user's account. A new draft is created on the server once it
 * has content; after that every change is saved shortly after it is made.
 *
 * Module-level store read through useSyncExternalStore, like session.ts: the
 * server snapshot is a fresh draft, so hydration never mismatches.
 */

/** `new`: nothing to save yet. `pending`: a change is waiting for the debounce. */
export type SaveStatus = "new" | "pending" | "saving" | "saved" | "error";

/** `key` changes whenever a different draft is loaded (use it to reset per-draft UI state). */
export type DraftState = DraftContent & {
  id: number | null;
  status: SaveStatus;
  key: number;
};

export const SAVE_DELAY_MS = 800;

const fresh = (): DraftState => ({
  id: null,
  documentType: null,
  values: {},
  messages: [GREETING],
  status: "new",
  key: 0,
});
const serverSnapshot = fresh();

/** Whether a draft is worth storing: a document is chosen or the user has said something. */
export function hasContent(d: DraftContent): boolean {
  return d.documentType !== null || d.messages.some((m) => m.role === "user");
}

/** Rebuilds draft content from an untrusted saved document. */
export function parseDraftContent(doc: Partial<SavedDocument>): DraftContent {
  const values: Values = {};
  if (doc.values && typeof doc.values === "object") {
    for (const [k, v] of Object.entries(doc.values)) if (typeof v === "string") values[k] = v;
  }
  return {
    documentType: typeof doc.documentType === "string" ? doc.documentType : null,
    values,
    messages: parseChat(doc.messages),
  };
}

let state: DraftState = serverSnapshot;
/** Bumped whenever a different draft is loaded, so late results for the old one are ignored. */
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
/** The generation whose save request is in flight, if any. */
let savingGen: number | null = null;
/** The current draft changed while its save was in flight. */
let dirty = false;
const listeners = new Set<() => void>();

function set(next: DraftState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const content = ({ documentType, values, messages }: DraftState): DraftContent => ({ documentType, values, messages });

const persist = (d: DraftState) => (d.id === null ? createDocument(content(d)) : updateDocument(d.id, content(d)));

async function save(): Promise<void> {
  timer = undefined;
  if (savingGen === generation) {
    dirty = true; // Saved again when the request in flight finishes.
    return;
  }
  if (!hasContent(state)) return;
  const gen = generation;
  const sent = state;
  savingGen = gen;
  dirty = false;
  set({ ...state, status: "saving" });
  try {
    const saved = await persist(sent);
    if (gen === generation) set({ ...state, id: saved.id, status: dirty ? "pending" : "saved" });
  } catch {
    if (gen === generation) set({ ...state, status: "error" });
  } finally {
    if (savingGen === gen) savingGen = null;
    if (gen === generation && dirty) await save();
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => void save(), SAVE_DELAY_MS);
}

/** Replaces the draft. Unless `discard`, changes to the old one still waiting to be saved are saved first. */
function load(next: DraftState, discard = false) {
  const prev = state;
  const unsaved = timer !== undefined || (savingGen === generation && dirty);
  clearTimeout(timer);
  timer = undefined;
  generation++;
  dirty = false;
  if (unsaved && !discard && hasContent(prev)) persist(prev).catch(() => {});
  set({ ...next, key: generation });
}

export const draftActions = {
  /** Starts an empty, unsaved draft. */
  startNew: () => load(fresh()),
  /** Loads a document from the server. */
  open: (doc: SavedDocument) => load({ ...parseDraftContent(doc), id: doc.id, status: "saved", key: 0 }),
  /** Forgets the draft without saving it (e.g. after signing out). */
  discard: () => load(fresh(), true),
  /** Changes the draft and schedules a save. */
  update: (patch: Partial<DraftContent>) => {
    const next = { ...state, ...patch };
    set({ ...next, status: hasContent(next) ? "pending" : next.status });
    if (savingGen === generation) dirty = true;
    else schedule();
  },
  /** Saves now instead of waiting ("Retry" after a failed save). */
  saveNow: (): Promise<void> => {
    clearTimeout(timer);
    return save();
  },
  /** Saves a change still waiting for the debounce, e.g. when leaving the page; no-op otherwise. */
  flush: (): Promise<void> => (timer !== undefined ? draftActions.saveNow() : Promise.resolve()),
};

/** The current draft's state, without subscribing (for async callbacks). */
export const getDraft = () => state;

/** Identifies the loaded draft: an async result started under another draft must be dropped. */
export const draftGeneration = () => generation;

export function useDraft() {
  const draft = useSyncExternalStore(
    subscribe,
    () => state,
    () => serverSnapshot,
  );
  return { ...draft, ...draftActions };
}

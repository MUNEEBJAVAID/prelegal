"use client";

import { useSyncExternalStore } from "react";
import { defaultNdaData, parseDraft, todayIso, type NdaData } from "./nda";

/**
 * Keeps the NDA form state in memory and mirrors it to localStorage so a
 * refresh doesn't lose the user's work. Exposed through useSyncExternalStore:
 * the server/hydration snapshot is the static default, and the client then
 * switches to the saved draft without a hydration mismatch.
 */

const STORAGE_KEY = "prelegal:mutual-nda:draft:v1";

export type DraftState = {
  data: NdaData;
  /** False when the browser refused to store the draft (private mode, quota, ...). */
  persisted: boolean;
};

const serverSnapshot: DraftState = { data: defaultNdaData, persisted: true };

/** Defaults for a fresh draft on the client: effective date defaults to today. */
function freshData(): NdaData {
  return { ...defaultNdaData, effectiveDate: todayIso() };
}

let state: DraftState | null = null;
const listeners = new Set<() => void>();

function load(): DraftState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return { data: raw ? parseDraft(JSON.parse(raw), freshData()) : freshData(), persisted: true };
  } catch {
    return { data: freshData(), persisted: false };
  }
}

function commit(data: NdaData) {
  let persisted = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    persisted = false;
  }
  state = { data, persisted };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DraftState {
  state ??= load();
  return state;
}

export function useNdaDraft() {
  const draft = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  return {
    ...draft,
    setData: commit,
    reset: () => commit(freshData()),
  };
}

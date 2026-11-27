"use client";

import { useSyncExternalStore } from "react";
import type { Values } from "./registry";

/**
 * Which document the user is drafting, plus the field values of each generic
 * document (the Mutual NDA keeps its own draft in draftStore). Mirrored to
 * localStorage with the same pattern as draftStore.
 */

export type WorkspaceState = {
  documentType: string | null;
  values: Record<string, Values>;
};

const STORAGE_KEY = "prelegal:workspace:v1";
const initial: WorkspaceState = { documentType: null, values: {} };

/** Rebuilds the workspace from untrusted JSON, keeping only string values. */
export function parseWorkspace(input: unknown): WorkspaceState {
  if (!input || typeof input !== "object") return initial;
  const { documentType, values } = input as Record<string, unknown>;
  const clean: Record<string, Values> = {};
  if (values && typeof values === "object") {
    for (const [doc, v] of Object.entries(values)) {
      if (!v || typeof v !== "object") continue;
      clean[doc] = Object.fromEntries(
        Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string"),
      );
    }
  }
  return { documentType: typeof documentType === "string" ? documentType : null, values: clean };
}

let state: WorkspaceState | null = null;
const listeners = new Set<() => void>();

function load(): WorkspaceState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseWorkspace(JSON.parse(raw)) : initial;
  } catch {
    return initial;
  }
}

function commit(next: WorkspaceState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the workspace lasts until reload.
  }
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): WorkspaceState {
  state ??= load();
  return state;
}

const actions = {
  setDocumentType: (documentType: string | null) => commit({ ...getSnapshot(), documentType }),
  setValues: (doc: string, values: Values) => {
    const current = getSnapshot();
    commit({ ...current, values: { ...current.values, [doc]: values } });
  },
  reset: () => commit(initial),
};

export function useWorkspace() {
  const { documentType, values } = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return { documentType, values, ...actions };
}

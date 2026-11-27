"use client";

import { useEffect, useSyncExternalStore } from "react";
import { fetchMe, logout, setUnauthorizedHandler, type SessionUser } from "./api";
import { draftActions } from "./draftStore";

/**
 * The signed-in user. The session itself is an HttpOnly cookie set by the
 * backend; this store only mirrors who it belongs to, asking /api/auth/me once.
 */

/** `undefined` while unknown (server render, hydration, first request), else the user or `null`. */
export type SessionState = SessionUser | null | undefined;

const RETRY_MS = 3000;

let state: SessionState;
let loading = false;
/** The session ended on its own (e.g. the server restarted), not because the user signed out. */
let expired = false;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Asks the backend who is signed in, once per page load. Network and server errors are retried. */
function ensureLoaded() {
  if (loading) return;
  loading = true;
  fetchMe().then(
    // Only fills in an unknown state: a sign-in that finished first wins.
    (user) => state === undefined && set(user),
    () =>
      setTimeout(() => {
        loading = false;
        ensureLoaded();
      }, RETRY_MS),
  );
}

export function signIn(user: SessionUser) {
  expired = false;
  draftActions.discard();
  set(user);
}

/** Saves any waiting draft change, ends the session and forgets the draft. */
export async function signOut() {
  await draftActions.flush().catch(() => {});
  try {
    await logout();
  } finally {
    draftActions.discard();
    set(null);
  }
}

/** Whether the last session ended on its own, so the sign-in screen can say so (until the next sign-in). */
export function useSessionExpired(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => expired,
    () => false,
  );
}

// Any API 401 (e.g. the server restarted and its database was reset) ends the session here too.
setUnauthorizedHandler(() => {
  if (!state) return;
  expired = true;
  draftActions.discard();
  set(null);
});

export function useSession(): SessionState {
  const session = useSyncExternalStore(
    subscribe,
    () => state,
    () => undefined,
  );
  useEffect(ensureLoaded, []);
  return session;
}

"use client";

import { useSyncExternalStore } from "react";

/**
 * The signed-in user, kept in sessionStorage so it lasts for the browser tab.
 * This is a placeholder: the backend's /api/auth/login accepts any credentials
 * and nothing here is a security boundary yet.
 */

export type SessionUser = { id: number; email: string };

/**
 * `undefined` until the client has read storage (server render and hydration),
 * then the user or `null` when signed out.
 */
export type SessionState = SessionUser | null | undefined;

const STORAGE_KEY = "prelegal:session:v1";

/** Rebuilds a session from untrusted stored JSON; null if it isn't one. */
export function parseSession(raw: string | null): SessionUser | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    const { id, email } = v as Record<string, unknown>;
    return typeof id === "number" && typeof email === "string" && email ? { id, email } : null;
  } catch {
    return null;
  }
}

let state: SessionUser | null | undefined;
const listeners = new Set<() => void>();

function read(): SessionUser | null {
  try {
    return parseSession(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function commit(user: SessionUser | null) {
  try {
    if (user) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode, quota): the session lasts until reload.
  }
  state = user;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SessionUser | null {
  if (state === undefined) state = read();
  return state;
}

export const signIn = (user: SessionUser) => commit(user);
export const signOut = () => commit(null);

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}

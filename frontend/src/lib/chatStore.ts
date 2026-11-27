"use client";

import { useSyncExternalStore } from "react";
import { GREETING, parseChat, type ChatMessage } from "./chat";

/**
 * The drafting conversation, mirrored to localStorage next to the drafts
 * (same pattern as draftStore): the server snapshot is the greeting alone.
 */

const STORAGE_KEY = "prelegal:chat:v2";
const initial: ChatMessage[] = [GREETING];

let state: ChatMessage[] | null = null;
const listeners = new Set<() => void>();

function load(): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseChat(JSON.parse(raw)) : initial;
  } catch {
    return initial;
  }
}

function commit(messages: ChatMessage[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage unavailable: the conversation lasts until reload.
  }
  state = messages;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ChatMessage[] {
  state ??= load();
  return state;
}

export function useChat() {
  const messages = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return { messages, setMessages: commit, reset: () => commit(initial) };
}

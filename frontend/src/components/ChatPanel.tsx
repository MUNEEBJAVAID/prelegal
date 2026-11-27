"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ApiError } from "@/lib/api";
import { applyUpdates, sendChat, type ChatMessage } from "@/lib/chat";
import { useChat } from "@/lib/chatStore";
import type { NdaData } from "@/lib/nda";

type Props = {
  data: NdaData;
  onChange: (data: NdaData) => void;
};

/** Free-form chat with the AI, which fills in the NDA as the user answers. */
export function ChatPanel({ data, onChange }: Props) {
  const { messages, setMessages } = useChat();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // The user may edit fields while the AI is replying: apply its updates to the latest draft.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  async function ask(history: ChatMessage[]) {
    setBusy(true);
    setError(null);
    try {
      const turn = await sendChat(history, dataRef.current);
      const { data: next, changed } = applyUpdates(dataRef.current, turn.updates);
      if (changed.length) onChange(next);
      setMessages([...history, { role: "assistant", content: turn.reply, ...(changed.length && { updated: changed }) }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The AI assistant couldn’t reply. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const content = input.trim();
    if (!content || busy) return;
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    void ask(history);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }

  // The last message is the user's when the AI failed to answer it.
  const canRetry = error && messages.at(-1)?.role === "user";

  return (
    <div className="flex h-[70vh] flex-col rounded-lg border border-line bg-paper/70 lg:h-[calc(100vh-12rem)]">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.role === "user" ? "rounded-br-sm bg-ink text-white" : "rounded-bl-sm border border-line bg-paper text-text"
              }`}
            >
              {m.content}
              {m.updated && (
                <p className="mt-1.5 border-t border-line pt-1.5 text-xs text-muted">
                  <span className="font-medium text-ink-soft">Updated:</span> {m.updated.join(", ")}
                </p>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start" aria-label="Assistant is typing">
            <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-line bg-paper px-3.5 py-3">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1.5 animate-bounce rounded-full bg-muted"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-md bg-flag-wash px-3 py-2 text-xs text-flag">
          {error}
          {canRetry && (
            <button type="button" onClick={() => void ask(messages)} className="font-medium underline">
              Retry
            </button>
          )}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-line p-3">
        <label htmlFor="chat-input" className="sr-only">
          Message the drafting assistant
        </label>
        <textarea
          id="chat-input"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={4000}
          placeholder="Type your answer… (Enter to send, Shift+Enter for a new line)"
          className="flex-1 resize-none rounded-md border border-line-strong bg-paper px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

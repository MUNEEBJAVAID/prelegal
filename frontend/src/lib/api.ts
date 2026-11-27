import type { ChatMessage } from "./chat";
import type { Values } from "./registry";

/** An API failure with a message that is safe to show the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

export type SessionUser = { id: number; email: string };

/** A saved document as listed on the dashboard. */
export type DocumentSummary = {
  id: number;
  documentType: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
};

/** What the drafting workspace saves: the document type, its field values and the chat. */
export type DraftContent = {
  documentType: string | null;
  values: Values;
  messages: ChatMessage[];
};

export type SavedDocument = DocumentSummary & DraftContent;

const OFFLINE = "Couldn’t reach the server. Check your connection and try again.";

/** Called on any 401, so the app can send the user back to sign in. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

/**
 * Same-origin JSON request (`/api/...`; proxied to FastAPI in `next dev`).
 * Throws ApiError with the server's `detail` when it is a string, else `fallback`.
 */
export async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  fallback = "Something went wrong. Please try again.",
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(path, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(OFFLINE);
  }
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b: { detail?: unknown }) => (typeof b.detail === "string" ? b.detail : null))
      .catch(() => null);
    if (res.status === 401 && !path.startsWith("/api/auth/")) onUnauthorized();
    throw new ApiError(detail ?? fallback, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

type Fetch = typeof fetch;

export const signUp = (email: string, password: string, f?: Fetch) =>
  request<SessionUser>(
    "/api/auth/signup",
    { method: "POST", body: { email, password } },
    "Sign-up failed. Please try again.",
    f,
  );

export const login = (email: string, password: string, f?: Fetch) =>
  request<SessionUser>(
    "/api/auth/login",
    { method: "POST", body: { email, password } },
    "Sign-in failed. Please try again.",
    f,
  );

export const logout = (f?: Fetch) => request<void>("/api/auth/logout", { method: "POST" }, undefined, f);

/** The signed-in user, or null when there is no valid session. */
export async function fetchMe(f?: Fetch): Promise<SessionUser | null> {
  try {
    return await request<SessionUser>("/api/auth/me", {}, undefined, f);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export const listDocuments = (f?: Fetch) =>
  request<DocumentSummary[]>("/api/documents", {}, "Couldn’t load your documents.", f);

export const getDocument = (id: number, f?: Fetch) =>
  request<SavedDocument>(`/api/documents/${id}`, {}, "Couldn’t open this document.", f);

export const createDocument = (content: DraftContent, f?: Fetch) =>
  request<SavedDocument>("/api/documents", { method: "POST", body: content }, "Couldn’t save the document.", f);

export const updateDocument = (id: number, content: DraftContent, f?: Fetch) =>
  request<SavedDocument>(`/api/documents/${id}`, { method: "PUT", body: content }, "Couldn’t save the document.", f);

export const deleteDocument = (id: number, f?: Fetch) =>
  request<void>(`/api/documents/${id}`, { method: "DELETE" }, "Couldn’t delete the document.", f);

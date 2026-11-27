import type { SessionUser } from "./session";

/** An API failure with a message that is safe to show the user. */
export class ApiError extends Error {}

/**
 * Placeholder sign-in: the backend accepts any email and password.
 * Requests are same-origin (`/api/...`); in `next dev` they are proxied to FastAPI.
 */
export async function login(email: string, password: string, fetchImpl: typeof fetch = fetch): Promise<SessionUser> {
  let res: Response;
  try {
    res = await fetchImpl("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ApiError("Couldn’t reach the server. Check your connection and try again.");
  }
  if (res.status === 422) throw new ApiError("Enter a valid email address and a password.");
  if (!res.ok) throw new ApiError("Sign-in failed. Please try again.");
  return (await res.json()) as SessionUser;
}

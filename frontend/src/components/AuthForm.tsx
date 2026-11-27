"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, login, signUp } from "@/lib/api";
import { signIn, useSession, useSessionExpired } from "@/lib/session";
import { Logo } from "./Logo";

export type AuthMode = "signin" | "signup";

export const HOME_PATH = "/documents/";
export const MIN_PASSWORD = 8;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type FormError = { field?: "email" | "password"; message: string };

/** Checks the form before calling the server; returns the first problem or null. */
export function validateAuth(mode: AuthMode, email: string, password: string): FormError | null {
  if (!EMAIL.test(email.trim()))
    return {
      field: "email",
      message: "Enter a valid email address, like name@company.com.",
    };
  if (!password) return { field: "password", message: "Enter your password." };
  if (mode === "signup" && password.length < MIN_PASSWORD)
    return {
      field: "password",
      message: `Choose a password with at least ${MIN_PASSWORD} characters.`,
    };
  return null;
}

const COPY = {
  signin: {
    title: "Welcome back",
    subtitle: "Sign in to pick up your drafts where you left off.",
    submit: "Sign in",
    busy: "Signing in…",
    switchText: "New to Prelegal?",
    switchLink: "Create an account",
    switchHref: "/signup/",
  },
  signup: {
    title: "Create your account",
    subtitle: "Draft NDAs, cloud agreements, DPAs and more with an AI assistant.",
    submit: "Create account",
    busy: "Creating account…",
    switchText: "Already have an account?",
    switchLink: "Sign in",
    switchHref: "/",
  },
} as const;

const POINTS = [
  "11 Common Paper standard agreements, from Mutual NDAs to DPAs",
  "Describe your deal in plain English: the AI fills in the details",
  "Download as PDF, Word or Markdown, and come back to any draft",
];

/** Sign-in and sign-up screen. A signed-in user is sent straight to their documents. */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const session = useSession();
  const copy = COPY[mode];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const expired = useSessionExpired();

  useEffect(() => {
    if (session) router.replace(HOME_PATH);
  }, [session, router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const invalid = validateAuth(mode, email, password);
    setError(invalid);
    if (invalid) {
      document.querySelector<HTMLInputElement>(`input[name="${invalid.field}"]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      signIn(await (mode === "signup" ? signUp : login)(email.trim(), password));
    } catch (err) {
      setError({
        message: err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      });
      setBusy(false);
    }
  }

  const input =
    "mt-1.5 block w-full rounded-lg border border-line-strong bg-white px-3 py-2.5 text-ink shadow-sm outline-none transition-colors placeholder:text-muted/60 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/25 aria-[invalid=true]:border-flag";

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-navy px-12 py-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-brand-blue/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-16 size-96 rounded-full bg-brand-purple/30 blur-3xl" />
        <Logo inverted />
        <div className="relative my-auto max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Legal agreements, drafted in a conversation.
          </h2>
          <ul className="mt-8 space-y-4 text-sm text-white/80">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-yellow" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">
          Documents are drafts and subject to legal review. Prelegal does not provide legal advice.
        </p>
      </aside>

      <main className="flex items-center justify-center bg-canvas px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{copy.title}</h1>
          <p className="mt-1.5 text-sm text-muted">{copy.subtitle}</p>

          {expired && (
            <p
              role="status"
              className="mt-6 rounded-lg border border-brand-blue/30 bg-ink-wash px-3 py-2 text-sm text-ink"
            >
              Your session ended, for example because the server restarted. Please sign in again.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <label className="block text-sm font-medium text-ink">
              Email
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="name@company.com"
                autoFocus
                required
                aria-invalid={error?.field === "email" || undefined}
                aria-describedby={error?.field === "email" ? "auth-error" : undefined}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={input}
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              Password
              <input
                type="password"
                name="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder={mode === "signup" ? `At least ${MIN_PASSWORD} characters` : undefined}
                required
                minLength={mode === "signup" ? MIN_PASSWORD : undefined}
                aria-invalid={error?.field === "password" || undefined}
                aria-describedby={error?.field === "password" ? "auth-error" : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input}
              />
            </label>

            {error && (
              <p
                id="auth-error"
                role="alert"
                className="rounded-lg border border-flag/30 bg-flag-wash px-3 py-2 text-sm text-flag"
              >
                {error.message}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || session === undefined}
              className="w-full rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple/90 disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? copy.busy : copy.submit}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {copy.switchText}{" "}
            <Link href={copy.switchHref} className="font-medium text-link hover:underline">
              {copy.switchLink}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

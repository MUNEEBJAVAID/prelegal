"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, login } from "@/lib/api";
import { signIn, useSession } from "@/lib/session";

const APP_PATH = "/nda/";

/** Placeholder sign-in screen: any email and password are accepted. */
export function LoginForm() {
  const router = useRouter();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace(APP_PATH);
  }, [session, router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      signIn(await login(email.trim(), password));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed. Please try again.");
      setBusy(false);
    }
  }

  const input =
    "mt-1 block w-full rounded-md border border-brand-gray/50 bg-white px-3 py-2 text-brand-navy shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30";

  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-3xl font-semibold tracking-tight text-brand-navy">
            Pre<span className="text-brand-yellow">legal</span>
          </p>
          <p className="mt-2 text-sm text-brand-gray">Draft common legal agreements in minutes.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-brand-gray/25 bg-white p-6 shadow-sm"
          noValidate
        >
          <h1 className="text-lg font-semibold text-brand-navy">Sign in</h1>

          <label className="block text-sm font-medium text-brand-navy">
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
          </label>

          <label className="block text-sm font-medium text-brand-navy">
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || session === undefined}
            className="w-full rounded-md bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-xs text-brand-gray">
            Preview build: any email and password will sign you in.
          </p>
        </form>
      </div>
    </main>
  );
}

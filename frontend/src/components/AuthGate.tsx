"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { signOut, useSession } from "@/lib/session";
import { Logo } from "./Logo";

const LOGIN_PATH = "/";

// "New document" is an action, so only "My documents" is ever marked as the current page.
const NAV = [
  {
    href: "/documents/",
    label: "My documents",
    short: "Documents",
    section: true,
  },
  { href: "/draft/", label: "New document", short: "New", section: false },
];

/** Shows its children, inside the app shell, only to a signed-in user; everyone else goes to sign-in. */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();

  useEffect(() => {
    if (session === null) router.replace(LOGIN_PATH);
  }, [session, router]);

  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-busy>
        <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <nav className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:gap-6 sm:px-6">
          <Logo href="/documents/" compact />
          <div className="flex gap-1 text-sm font-medium">
            {NAV.map(({ href, label, short, section }) => {
              const current = section && (pathname === href || pathname === href.slice(0, -1));
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors sm:px-3 ${
                    current ? "bg-ink-wash text-ink" : "text-muted hover:bg-panel hover:text-ink"
                  }`}
                >
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden items-center gap-2 text-muted sm:flex">
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-full bg-brand-blue/15 text-xs font-semibold uppercase text-brand-navy"
              >
                {session.email[0]}
              </span>
              <span className="max-w-48 truncate">{session.email}</span>
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="whitespace-nowrap rounded-md border border-line-strong px-2.5 py-1.5 font-medium text-ink transition-colors hover:bg-panel sm:px-3"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
      {children}
    </>
  );
}

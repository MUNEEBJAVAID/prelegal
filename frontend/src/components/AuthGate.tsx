"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { signOut, useSession } from "@/lib/session";

const LOGIN_PATH = "/";

/** Shows its children only to a signed-in user; everyone else goes to the login screen. */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session === null) router.replace(LOGIN_PATH);
  }, [session, router]);

  if (!session) return null;

  return (
    <>
      <div className="bg-brand-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-3 px-4 py-1.5 text-xs sm:px-6">
          <span className="truncate opacity-80">Signed in as {session.email}</span>
          <button type="button" onClick={signOut} className="font-medium text-brand-yellow hover:underline">
            Sign out
          </button>
        </div>
      </div>
      {children}
    </>
  );
}

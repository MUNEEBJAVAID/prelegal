import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { DraftingWorkspace } from "@/components/DraftingWorkspace";
import { loadCatalog } from "@/lib/catalog.server";

export const metadata: Metadata = {
  title: "Draft a document · Prelegal",
  description: "Draft Common Paper legal agreements with an AI assistant.",
};

export default async function DraftPage() {
  const catalog = await loadCatalog();
  return (
    <AuthGate>
      {/* The document id comes from the query string, which is only known in the browser. */}
      <Suspense>
        <DraftingWorkspace catalog={catalog} />
      </Suspense>
    </AuthGate>
  );
}

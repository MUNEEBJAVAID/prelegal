import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";
import { DraftingWorkspace } from "@/components/DraftingWorkspace";
import { loadCatalog } from "@/lib/catalog.server";

export const metadata: Metadata = {
  title: "Draft a document · Prelegal",
  description: "Draft Common Paper legal agreements with an AI assistant.",
};

export default async function DraftPage() {
  return (
    <AuthGate>
      <DraftingWorkspace catalog={await loadCatalog()} />
    </AuthGate>
  );
}

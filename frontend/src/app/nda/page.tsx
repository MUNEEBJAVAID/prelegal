import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";
import { NdaCreator } from "@/components/NdaCreator";
import { loadStandardTerms } from "@/lib/standardTerms";

export const metadata: Metadata = {
  title: "Mutual NDA Creator · Prelegal",
  description: "Draft a Common Paper Mutual Non-Disclosure Agreement in minutes.",
};

export default async function NdaPage() {
  return (
    <AuthGate>
      <NdaCreator terms={await loadStandardTerms()} />
    </AuthGate>
  );
}

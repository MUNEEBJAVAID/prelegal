import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";
import { DocumentsDashboard } from "@/components/DocumentsDashboard";

export const metadata: Metadata = { title: "My documents · Prelegal" };

export default function DocumentsPage() {
  return (
    <AuthGate>
      <DocumentsDashboard />
    </AuthGate>
  );
}

import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Create your account · Prelegal" };

export default function SignUpPage() {
  return <AuthForm mode="signup" />;
}

import type { Metadata } from "next";
import { ResetForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 14 }}>Esqueci a senha</h1>
      <ResetForm />
    </>
  );
}

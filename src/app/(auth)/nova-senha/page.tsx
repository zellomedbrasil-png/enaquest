import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Nova senha" };

export default function NewPasswordPage() {
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 14 }}>Crie uma nova senha</h1>
      <NewPasswordForm />
    </>
  );
}

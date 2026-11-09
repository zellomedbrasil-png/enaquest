import type { Metadata } from "next";
import { SignUpForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Comece grátis</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        Sem cartão. O Plantão do Dia já está esperando você.
      </p>
      <SignUpForm />
    </>
  );
}

import type { Metadata } from "next";
import { SignInForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 14 }}>Bom plantão</h1>
      {erro === "link" && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          Esse link não funcionou: ele expira em 1 hora e só vale uma vez. Entre com seu e-mail e senha; se a conta ainda não estiver confirmada, você poderá pedir um novo link.
        </div>
      )}
      <SignInForm next={next} />
    </>
  );
}

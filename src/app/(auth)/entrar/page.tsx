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
          Esse link expirou. Peça um novo.
        </div>
      )}
      <SignInForm next={next} />
    </>
  );
}

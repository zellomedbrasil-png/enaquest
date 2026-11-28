import type { Metadata } from "next";
import { GoogleButton } from "@/components/GoogleButton";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 14 }}>Bom plantão</h1>
      {erro === "google" && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 12 }}>
          Não foi possível entrar com o Google. Tente de novo.
        </div>
      )}
      <GoogleButton next={next} />
    </>
  );
}

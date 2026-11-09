import { SiteHeader } from "@/components/SiteHeader";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main style={{ maxWidth: 420, margin: "24px auto", padding: "0 16px" }}>
        <div className="card">{children}</div>
      </main>
    </>
  );
}

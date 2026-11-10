import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Script from "next/script";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { READING_SCRIPT } from "@/lib/ui/reading";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700", "800"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: "EnaQuest: questões para o ENAMED e o ENARE", template: "%s · EnaQuest" },
  description:
    "Banco de questões no formato do ENAMED, com comentários em camadas, revisão espaçada, simulados e ligas entre faculdades.",
  applicationName: "EnaQuest",
  appleWebApp: { capable: true, title: "EnaQuest", statusBarStyle: "black-translucent" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: "#0d0f1c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body>
        <Script id="leitura" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: READING_SCRIPT }} />
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}

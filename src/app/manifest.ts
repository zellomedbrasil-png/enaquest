import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EnaQuest",
    short_name: "EnaQuest",
    description: "Questões, simulados e ligas para a preparação para o ENAMED e o ENARE.",
    lang: "pt-BR",
    start_url: "/app",
    display: "standalone",
    background_color: "#0d0f1c",
    theme_color: "#0d0f1c",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CarsDuel",
    short_name: "CarsDuel",
    description: "Jeu de cartes automobile : deck-building, duels fantômes, marketplace.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0c10",
    theme_color: "#0a0c10",
    lang: "fr",
    categories: ["games"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

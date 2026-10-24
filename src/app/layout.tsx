import type { Metadata, Viewport } from "next";
import { Rajdhani } from "next/font/google";
import "./globals.css";

const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-rajdhani" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0c10",
};

export const metadata: Metadata = {
  applicationName: "CarsDuel",
  title: "CarsDuel",
  description: "Jeu de cartes automobile asynchrone : deck-building, duels fantômes, marketplace.",
  appleWebApp: {
    capable: true,
    title: "CarsDuel",
    statusBarStyle: "black-translucent",
  },
  // iOS avant Safari 17.4 ne lit que la balise préfixée. Next n'émet que la balise standard.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={rajdhani.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

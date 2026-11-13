import type { Metadata, Viewport } from "next";
import { Rajdhani } from "next/font/google";
import { LaunchGate } from "@/components/LaunchGate";
import { PwaManager } from "@/components/PwaManager";
import { ToastProvider } from "@/components/ui/Toast";
import { pwaIcon } from "@/lib/pwa-icons";
import "./globals.css";

const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-rajdhani" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  // L'interface est sombre uniquement : les deux préférences gardent la même
  // teinte de barre système, sans flash clair au lancement.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a0c10" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c10" },
  ],
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
      { url: pwaIcon("favicon-32.png"), sizes: "32x32", type: "image/png" },
      { url: pwaIcon("icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: pwaIcon("icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: pwaIcon("apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={rajdhani.variable} data-scroll-behavior="smooth">
      <body className="min-h-screen antialiased">
        <a
          href="#contenu"
          className="sr-only z-[150] rounded-lg border border-accent/60 bg-panel px-4 py-3 font-display text-base font-bold uppercase text-accent focus:not-sr-only focus:fixed focus:left-3 focus:top-[max(0.75rem,env(safe-area-inset-top))]"
        >
          Aller au contenu
        </a>
        <ToastProvider>
          <PwaManager />
          <LaunchGate />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}

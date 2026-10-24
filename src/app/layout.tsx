import type { Metadata } from "next";
import { Rajdhani } from "next/font/google";
import "./globals.css";

const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-rajdhani" });

export const metadata: Metadata = {
  title: "CarsDuel",
  description: "Jeu de cartes automobile asynchrone : deck-building, duels fantômes, marketplace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={rajdhani.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { Home, RefreshCw, TriangleAlert } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenu" tabIndex={-1} className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-4 text-center outline-none">
      <span className="grid size-14 place-items-center rounded-2xl border border-red-500/40 bg-red-500/10 text-red-300">
        <TriangleAlert size={28} strokeWidth={1.8} aria-hidden />
      </span>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Incident</p>
      <h1 className="font-display text-3xl font-bold uppercase leading-none">Une erreur est survenue</h1>
      <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
        Le garage a calé. Réessayez dans un instant ; vos données restent en sécurité.
      </p>
      {error.digest && <p className="text-xs text-zinc-600">Réf. {error.digest}</p>}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button size="md" onClick={reset} className="gap-2">
          <RefreshCw size={16} strokeWidth={2.2} aria-hidden />
          Réessayer
        </Button>
        <Link href="/" className={buttonClass({ variant: "ghost", size: "md" })}>
          <Home size={16} strokeWidth={2.1} aria-hidden />
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}

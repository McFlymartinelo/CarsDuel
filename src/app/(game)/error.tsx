"use client";

import Link from "next/link";
import { Home, RefreshCw, TriangleAlert } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";

/** Erreur de rendu d'un écran de jeu : message utile, référence et reprise sans perdre la session. */
export default function GameError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-line bg-panel px-5 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl border border-red-500/40 bg-red-500/10 text-red-300">
        <TriangleAlert size={28} strokeWidth={1.8} aria-hidden />
      </span>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Incident de course</p>
      <h1 className="font-display text-3xl font-bold uppercase leading-none">Le garage a calé</h1>
      <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
        Cet écran n’a pas pu s’afficher. Vos données sont intactes : réessayez ou revenez au garage.
      </p>
      {error.digest && <p className="text-xs text-zinc-600">Réf. {error.digest}</p>}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button size="md" onClick={reset} className="gap-2">
          <RefreshCw size={16} strokeWidth={2.2} aria-hidden />
          Réessayer
        </Button>
        <Link href="/garage" className={buttonClass({ variant: "ghost", size: "md" })}>
          <Home size={16} strokeWidth={2.1} aria-hidden />
          Retour au garage
        </Link>
      </div>
    </section>
  );
}

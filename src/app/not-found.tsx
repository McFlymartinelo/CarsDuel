import Link from "next/link";
import { Compass, House, Swords } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="grid size-16 place-items-center rounded-2xl border border-amber-500/35 bg-amber-500/10 text-amber-300">
        <Compass size={32} strokeWidth={1.6} aria-hidden />
      </span>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">Erreur 404</p>
      <h1 className="font-display text-3xl font-bold uppercase leading-none">Page introuvable</h1>
      <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
        Ce circuit n’existe pas ou n’est plus disponible. Revenez au garage ou lancez directement un duel.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Link href="/garage" className={buttonClass({ size: "md" })}>
          <House size={16} strokeWidth={2.1} aria-hidden />
          Retour au garage
        </Link>
        <Link href="/duel" className={buttonClass({ variant: "ghost", size: "md" })}>
          <Swords size={16} strokeWidth={2.1} aria-hidden />
          Page Jouer
        </Link>
      </div>
    </main>
  );
}

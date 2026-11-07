import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Lien de retour vers le garage, en tête des pages filles. `overlay` pour un fond photo. */
export function BackToGarage({ overlay = false }: { overlay?: boolean }) {
  return (
    <Link
      href="/garage"
      className={
        overlay
          ? "inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300 hover:text-white"
          : "inline-flex w-fit items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:border-amber-500/40 hover:text-amber-300"
      }
    >
      <ArrowLeft size={14} aria-hidden />
      Retour au garage
    </Link>
  );
}

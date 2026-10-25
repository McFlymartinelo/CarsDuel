import type { LucideIcon } from "lucide-react";

/** Carte d'action de la page Jouer, double cadre comme les cartes du jeu. `primary` : liseré orange ; sinon gris. */
export const tileClass = (primary = false) =>
  `group block w-full rounded-2xl border-2 p-1 text-left transition-colors disabled:opacity-50 ${
    primary
      ? "border-amber-500 shadow-[0_0_18px_rgba(245,158,11,0.2)] hover:border-amber-400"
      : "border-zinc-600 hover:border-amber-500/70"
  }`;

export function TileBody({ icon: Icon, title, text, primary = false }: { icon: LucideIcon; title: string; text?: string; primary?: boolean }) {
  return (
    <span
      className={`block min-h-24 rounded-xl border bg-gradient-to-b from-[#12151c] to-[#0a0c10] p-4 ${
        primary ? "border-amber-500/30" : "border-zinc-500/30 group-hover:border-amber-500/30"
      }`}
    >
      <Icon size={24} strokeWidth={1.75} className={primary ? "text-amber-400" : "text-zinc-300 group-hover:text-amber-400"} />
      <span className="mt-2 block font-display text-lg font-bold uppercase leading-tight tracking-wide text-white">{title}</span>
      {text && <span className="block text-sm text-zinc-400">{text}</span>}
    </span>
  );
}

import Image from "next/image";
import { Trophy, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Bouton-carte (garage, page Jouer) : cadre orange lumineux, texte à gauche, visuel en fond à droite. Styles : `.garage-tile*`. */
export const tileClass = () => "garage-tile group w-full text-left disabled:cursor-not-allowed disabled:opacity-50";

export function TileBody({
  title,
  text,
  image,
  badge,
  icon: Icon,
  imageFit = "cover",
}: {
  title: string;
  text?: string;
  image?: string;
  badge?: ReactNode;
  icon?: LucideIcon;
  imageFit?: "cover" | "contain";
}) {
  return (
    <>
      <span aria-hidden className={`garage-tile-art ${imageFit === "contain" ? "garage-tile-art-contained" : ""}`}>
        {image ? (
          <Image src={image} alt="" fill sizes="(min-width: 640px) 30vw, 70vw" className="object-cover object-right" />
        ) : (
          <span className="flex h-full items-center justify-center">
            <Trophy size={96} strokeWidth={1.1} className="text-amber-500/20" />
          </span>
        )}
      </span>
      <span aria-hidden className="garage-tile-frame" />
      <span aria-hidden className="garage-tile-corner garage-tile-corner-tl" />
      <span aria-hidden className="garage-tile-corner garage-tile-corner-tr" />
      <span aria-hidden className="garage-tile-corner garage-tile-corner-bl" />
      <span aria-hidden className="garage-tile-corner garage-tile-corner-br" />
      <span className="relative z-10 flex min-w-0 max-w-[62%] flex-col items-start gap-1 px-7 py-6 sm:px-8">
        {Icon && (
          <span className="mb-2 grid h-9 w-9 place-items-center rounded-lg border border-amber-400/35 bg-black/45 text-amber-300 shadow-[0_0_14px_-4px_rgba(245,158,11,0.7)]">
            <Icon size={18} strokeWidth={1.8} aria-hidden />
          </span>
        )}
        <span className="garage-tile-title font-display text-xl font-bold uppercase leading-tight tracking-wide sm:text-2xl">{title}</span>
        {text && <span className="text-sm text-zinc-300">{text}</span>}
        {badge}
      </span>
    </>
  );
}

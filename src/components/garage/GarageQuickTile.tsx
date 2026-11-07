import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Tuile compacte du garage détaillé : visuel en fond, titre et pastille. */
export function GarageQuickTile({
  href,
  title,
  text,
  image,
  imageFit = "cover",
  icon: Icon,
  badge,
}: {
  href: string;
  title: string;
  text: string;
  image?: string;
  imageFit?: "cover" | "contain";
  icon?: LucideIcon;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-24 flex-col justify-end overflow-hidden rounded-xl border border-amber-500/25 bg-panel-deep p-3 transition hover:border-amber-400/60"
    >
      {image && (
        <Image
          src={image}
          alt=""
          fill
          sizes="(min-width: 640px) 25vw, 50vw"
          className={`opacity-50 transition group-hover:opacity-70 ${
            imageFit === "contain" ? "object-contain p-2" : "object-cover object-right"
          } [mask-image:linear-gradient(to_left,#000_20%,transparent_90%)]`}
        />
      )}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-panel-deep via-panel-deep/60 to-transparent" />
      <span className="relative z-10 flex min-w-0 flex-col gap-0.5">
        {badge && <span className="mb-0.5 flex">{badge}</span>}
        <span className="flex min-w-0 items-center gap-1.5">
          {Icon && <Icon size={14} strokeWidth={1.9} className="shrink-0 text-amber-300" aria-hidden />}
          <span className="truncate font-display text-sm font-bold uppercase leading-tight text-white">{title}</span>
        </span>
        <span className="truncate text-[10px] text-zinc-400">{text}</span>
      </span>
    </Link>
  );
}

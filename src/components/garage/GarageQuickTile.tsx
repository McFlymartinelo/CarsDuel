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
  icon: Icon,
  badge,
}: {
  href: string;
  title: string;
  text: string;
  image?: string;
  icon?: LucideIcon;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-28 flex-col justify-end overflow-hidden rounded-xl border border-amber-500/25 bg-panel-deep p-3 transition hover:border-amber-400/60 sm:min-h-32"
    >
      {image && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_28%)] sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[44%] sm:min-w-[220px] sm:max-w-[340px]"
        >
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 640px) 340px, 50vw"
            className="object-cover object-center opacity-60 transition duration-300 group-hover:scale-[1.04] group-hover:opacity-85"
          />
        </span>
      )}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-panel-deep via-panel-deep/55 to-transparent" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-panel-deep via-panel-deep/80 to-panel-deep/10 sm:via-panel-deep/65 sm:to-transparent" />
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

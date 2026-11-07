import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Titre de section homogène : icône optionnelle, sous-titre et action à droite. */
export function SectionTitle({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-2", className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase">
          {Icon && <Icon size={18} className="text-accent" aria-hidden />}
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

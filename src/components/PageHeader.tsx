import type { ReactNode } from "react";
import { BackToGarage } from "@/components/garage/BackToGarage";

/**
 * En-tête de page homogène : même taille de titre, même espacement et même
 * emplacement pour le lien de retour et les actions, sur tous les écrans.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  back = false,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  /** Affiche le lien « Retour au garage » au-dessus du titre. */
  back?: boolean;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={className ? `space-y-2 ${className}` : "space-y-2"}>
      {back && <BackToGarage />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-400/90">{eyebrow}</p>
          )}
          <h1 className="font-display text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-400">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

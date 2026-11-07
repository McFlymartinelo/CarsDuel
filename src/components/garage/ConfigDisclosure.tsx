"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Panneau repliable « Ma config ».
 *
 * Le résumé reste visible, l'éditeur complet n'est monté qu'à l'ouverture.
 * `defaultOpen` permet au garage d'arriver directement sur l'éditeur.
 */
export function ConfigDisclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id="config" className="scroll-mt-24 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-400/90">Ma config</p>
          <div className="mt-2">{summary}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-0.5 shrink-0"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Fermer" : "Modifier"}
          <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        </Button>
      </div>
      {open && <div>{children}</div>}
    </section>
  );
}

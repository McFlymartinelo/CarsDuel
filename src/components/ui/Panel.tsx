import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type PanelTone = "default" | "deep" | "mid" | "accent" | "flat";

const TONES: Record<PanelTone, string> = {
  default: "border-line bg-panel",
  deep: "border-line bg-panel-deep",
  mid: "border-line bg-panel-mid",
  accent: "border-accent/30 bg-panel",
  flat: "border-white/[0.08] bg-transparent",
};

/** Classe de panneau réutilisable (div, li, article, section…). */
export function panelClass({ tone = "default", className }: { tone?: PanelTone; className?: string } = {}) {
  return cn("rounded-xl border", TONES[tone], className);
}

export function Panel({ tone, className, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: PanelTone }) {
  return <div className={panelClass({ tone, className })} {...props} />;
}

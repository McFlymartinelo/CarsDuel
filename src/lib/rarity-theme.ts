import type { Rarity } from "@/lib/types";

/**
 * Palette unique des raretés.
 *
 * Elle regroupe les trois usages historiques : carte détaillée (frame/inner/
 * accent/glow), carte de slot ou d'échange (slotFrame/slotGlow/badge/label) et
 * filtres mobiles (dot/chip). Un seul endroit à modifier pour changer le code
 * couleur du jeu.
 */
export interface RarityPalette {
  /** Cadre + lueur de la carte détaillée. */
  frame: string;
  inner: string;
  accent: string;
  glow: string;
  /** Cadre et lueur des cartes compactes (slot, échange, marketplace). */
  slotFrame: string;
  slotGlow: string;
  badge: string;
  label: string;
  /** Classe combinée « bordure + texte » pour les libellés simples. */
  plain: string;
  /** Pastille et puce de filtre. */
  dot: string;
  chip: string;
}

export const RARITY_PALETTE: Record<Rarity | "neutre", RarityPalette> = {
  commune: {
    frame: "border-zinc-300/70 shadow-[0_0_22px_rgba(212,212,216,0.18)]",
    inner: "border-zinc-300/30",
    accent: "text-zinc-200",
    glow: "from-zinc-300/10",
    slotFrame: "border-zinc-500",
    slotGlow: "from-zinc-500/15",
    badge: "bg-zinc-600 text-white",
    label: "text-zinc-300",
    plain: "border-zinc-500 text-zinc-300",
    dot: "bg-zinc-400",
    chip: "border-zinc-400/60 bg-zinc-400/10 text-zinc-100",
  },
  rare: {
    frame: "border-blue-400/80 shadow-[0_0_22px_rgba(96,165,250,0.30)]",
    inner: "border-blue-400/30",
    accent: "text-blue-300",
    glow: "from-blue-400/15",
    slotFrame: "border-blue-500",
    slotGlow: "from-blue-500/20",
    badge: "bg-blue-500 text-white",
    label: "text-blue-400",
    plain: "border-blue-500 text-blue-300",
    dot: "bg-blue-400",
    chip: "border-blue-400/60 bg-blue-400/10 text-blue-100",
  },
  tres_rare: {
    frame: "border-cyan-400/80 shadow-[0_0_22px_rgba(34,211,238,0.30)]",
    inner: "border-cyan-400/30",
    accent: "text-cyan-300",
    glow: "from-cyan-400/15",
    slotFrame: "border-cyan-500",
    slotGlow: "from-cyan-500/20",
    badge: "bg-cyan-600 text-white",
    label: "text-cyan-400",
    plain: "border-cyan-500 text-cyan-300",
    dot: "bg-cyan-400",
    chip: "border-cyan-400/60 bg-cyan-400/10 text-cyan-100",
  },
  epique: {
    frame: "border-purple-400/80 shadow-[0_0_22px_rgba(192,132,252,0.35)]",
    inner: "border-purple-400/30",
    accent: "text-purple-300",
    glow: "from-purple-400/15",
    slotFrame: "border-purple-500",
    slotGlow: "from-purple-500/25",
    badge: "bg-purple-500 text-white",
    label: "text-purple-400",
    plain: "border-purple-500 text-purple-300",
    dot: "bg-purple-400",
    chip: "border-purple-400/60 bg-purple-400/10 text-purple-100",
  },
  legendaire: {
    frame: "border-orange-400/90 shadow-[0_0_26px_rgba(251,146,60,0.45)]",
    inner: "border-orange-400/35",
    accent: "text-orange-300",
    glow: "from-orange-400/20",
    slotFrame: "border-amber-400",
    slotGlow: "from-amber-400/25",
    badge: "bg-amber-500 text-black",
    label: "text-amber-400",
    plain: "border-amber-400 text-amber-300",
    dot: "bg-amber-400",
    chip: "border-amber-400/60 bg-amber-400/10 text-amber-100",
  },
  neutre: {
    frame: "border-zinc-500/70",
    inner: "border-zinc-500/30",
    accent: "text-zinc-300",
    glow: "from-zinc-400/10",
    slotFrame: "border-zinc-500",
    slotGlow: "from-zinc-500/15",
    badge: "bg-zinc-600 text-white",
    label: "text-zinc-300",
    plain: "border-zinc-500 text-zinc-300",
    dot: "bg-zinc-400",
    chip: "border-zinc-400/60 bg-zinc-400/10 text-zinc-100",
  },
};

export const RARITY_KEYS = ["commune", "rare", "tres_rare", "epique", "legendaire"] as const;

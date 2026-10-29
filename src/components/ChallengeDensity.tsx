"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LayoutList, Rows3 } from "lucide-react";

type Density = { compact: boolean; setCompact: (value: boolean) => void };

const DensityContext = createContext<Density>({ compact: false, setCompact: () => {} });
const STORAGE_KEY = "carsduel:defis-density";

/** Mémorise la densité d'affichage des défis (confort / compact) sur le téléphone. */
export function ChallengeDensityProvider({ children }: { children: ReactNode }) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    setCompact(window.localStorage.getItem(STORAGE_KEY) === "compact");
  }, []);

  const update = (value: boolean) => {
    setCompact(value);
    window.localStorage.setItem(STORAGE_KEY, value ? "compact" : "comfort");
  };

  return <DensityContext.Provider value={{ compact, setCompact: update }}>{children}</DensityContext.Provider>;
}

export const useChallengeDensity = () => useContext(DensityContext);

/** Bascule confort / compact, visible uniquement sur téléphone. */
export function ChallengeDensityToggle() {
  const { compact, setCompact } = useChallengeDensity();
  const base = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-[0.1em] transition-colors";
  return <div className="flex items-center justify-between gap-3 sm:hidden">
    <span className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Affichage</span>
    <div className="inline-flex rounded-lg border border-zinc-800 bg-[#10131a] p-0.5" role="group" aria-label="Densité des défis">
      <button type="button" aria-pressed={!compact} onClick={() => setCompact(false)} className={`${base} ${compact ? "text-zinc-400 hover:text-white" : "bg-zinc-700/70 text-white"}`}>
        <Rows3 size={13} strokeWidth={2} aria-hidden="true" />Confort
      </button>
      <button type="button" aria-pressed={compact} onClick={() => setCompact(true)} className={`${base} ${compact ? "bg-amber-500 text-black" : "text-zinc-400 hover:text-white"}`}>
        <LayoutList size={13} strokeWidth={2} aria-hidden="true" />Compact
      </button>
    </div>
  </div>;
}

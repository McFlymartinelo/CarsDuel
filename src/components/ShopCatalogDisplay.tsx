"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LayoutGrid, List } from "lucide-react";
import type { CardViewMode } from "@/components/ViewToggle";

const ShopViewContext = createContext<{ view: CardViewMode; setView: (view: CardViewMode) => void } | null>(null);

/** Conserve le catalogue monté pendant le changement de présentation. */
export function ShopViewProvider({ initialView, children }: { initialView: CardViewMode; children: ReactNode }) {
  const [view, setView] = useState(initialView);

  useEffect(() => {
    const syncFromUrl = () => {
      setView(new URLSearchParams(window.location.search).get("vue") === "liste" ? "liste" : "cartes");
    };
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  function changeView(next: CardViewMode) {
    if (next === view) return;
    const url = new URL(window.location.href);
    if (next === "liste") url.searchParams.set("vue", "liste");
    else url.searchParams.delete("vue");
    window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    setView(next);
  }

  return (
    <ShopViewContext.Provider value={{ view, setView: changeView }}>
      {children}
    </ShopViewContext.Provider>
  );
}

export function useShopView() {
  const value = useContext(ShopViewContext);
  if (!value) throw new Error("Shop view components must be inside ShopViewProvider");
  return value;
}

export function useShopViewIfAvailable() {
  return useContext(ShopViewContext)?.view ?? null;
}

export function ShopViewToggle() {
  const { view, setView } = useShopView();
  return (
      <nav className="inline-flex gap-1 rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Affichage">
        <button
          type="button"
          onClick={() => setView("cartes")}
          aria-pressed={view === "cartes"}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "cartes" ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
        >
          <LayoutGrid size={15} strokeWidth={2} />
          Cartes
        </button>
        <button
          type="button"
          onClick={() => setView("liste")}
          aria-pressed={view === "liste"}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "liste" ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
        >
          <List size={15} strokeWidth={2} />
          Liste
        </button>
      </nav>
  );
}

export function ShopViewPanels({ cards, list }: { cards: ReactNode; list: ReactNode }) {
  const { view } = useShopView();
  return (
    <>
      <div hidden={view !== "cartes"}>{cards}</div>
      <div hidden={view !== "liste"}>{list}</div>
    </>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Rows3 } from "lucide-react";
import { GARAGE_VIEW_COOKIE, type GarageView } from "@/lib/garage-view";

/** Bascule entre le garage simple (6 grandes tuiles) et le tableau de bord détaillé. */
export function GarageViewToggle({ view }: { view: GarageView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function select(next: GarageView) {
    if (next === view) return;
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${GARAGE_VIEW_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax${secure}`;
    startTransition(() => router.refresh());
  }

  const option = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
      active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-panel-raised hover:text-white"
    }`;

  return (
    <nav
      className={`inline-flex gap-1 rounded-xl border border-line bg-panel p-1 ${pending ? "opacity-70" : ""}`}
      aria-label="Affichage du garage"
    >
      <button type="button" onClick={() => select("simple")} aria-pressed={view === "simple"} className={option(view === "simple")}>
        <Rows3 size={14} strokeWidth={2} />
        Simple
      </button>
      <button type="button" onClick={() => select("detail")} aria-pressed={view === "detail"} className={option(view === "detail")}>
        <LayoutDashboard size={14} strokeWidth={2} />
        Détaillé
      </button>
    </nav>
  );
}

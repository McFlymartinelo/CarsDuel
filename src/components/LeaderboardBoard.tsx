"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BarChart3, Sparkles } from "lucide-react";
import type { LeaderboardRow } from "@/lib/queries";

export interface PeriodBoard {
  rows: LeaderboardRow[];
  from: string | null;
  to: string | null;
  players: number;
}

type Key = "weekly" | "monthly";

const CONFIG = {
  weekly: {
    label: "Classement hebdomadaire",
    range: "Du lundi au dimanche",
    short: "Primes de la semaine",
    image: "/classement/hebdomadaire.webp",
    closing: "lundi 00:00",
    prizes: [
      ["1er", "50 pièces"],
      ["2e", "40 pièces"],
      ["3e", "30 pièces"],
      ["Top 5 % hors podium", "10 pièces"],
    ],
  },
  monthly: {
    label: "Classement mensuel",
    range: "Du 1er au dernier jour du mois",
    short: "Primes du mois",
    image: "/classement/mensuel.webp",
    closing: "le 1er à 00:00",
    prizes: [
      ["1er", "250 pièces"],
      ["2e", "200 pièces"],
      ["3e", "150 pièces"],
      ["Top 5 % hors podium", "50 pièces"],
    ],
  },
} as const;

// Libellés ancrés sur le centre de chaque marche du visuel recadré (1536×826), ordre visuel 2 – 1 – 3.
// Le délai d'apparition échelonné (or en dernier) passe par la variable CSS --podium-delay.
// Ordre d'apparition : 3e, puis 2e, puis 1er en « wow » (ms = délai du compteur d'XP)
const PODIUM = [
  { rank: 2, ms: 700, delay: "[--podium-delay:0.7s]", fx: "", position: "left-[17.2%] bottom-[65.8%]", name: "text-zinc-100", line: "to-zinc-300/60" },
  {
    rank: 1,
    ms: 1400,
    delay: "[--podium-delay:1.4s]",
    fx: "podium-wow",
    position: "left-1/2 bottom-[78.9%]",
    name: "text-amber-300 podium-gold-glow",
    line: "to-amber-400/60",
  },
  { rank: 3, ms: 150, delay: "[--podium-delay:0.15s]", fx: "", position: "left-[82.4%] bottom-[61.9%]", name: "text-orange-300", line: "to-orange-400/60" },
];

// Étincelles autour de la marche 1, qui éclatent après son arrivée (décoratives)
const SPARKLES = [
  "left-[31%] bottom-[86%] [--podium-delay:2.1s]",
  "left-[69%] bottom-[90%] [--podium-delay:2.4s]",
  "left-[74%] bottom-[72%] [--podium-delay:2.7s]",
];

const fmt = (n: number) => n.toLocaleString("fr-FR");

// Compte les XP de 0 à la valeur finale, après un délai (ms) qui suit l'apparition de la marche
function CountUp({ value, delay }: { value: number; delay: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / 1100, 0), 1);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, delay]);

  return <>{fmt(shown)}</>;
}

export function LeaderboardBoard({ userId, weekly, monthly }: { userId: string; weekly: PeriodBoard; monthly: PeriodBoard }) {
  const [period, setPeriod] = useState<Key>("weekly");
  const board = period === "weekly" ? weekly : monthly;
  const config = CONFIG[period];

  return (
    <>
      <div role="group" aria-label="Période du classement" className="grid gap-3 sm:grid-cols-2">
        {(["weekly", "monthly"] as const).map((key) => {
          const option = CONFIG[key];
          const active = key === period;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setPeriod(key)}
              className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition ${
                active
                  ? "border-amber-400/60 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_8px_24px_-12px_rgba(245,158,11,0.55)]"
                  : "border-zinc-800 bg-[#0e1117] hover:border-zinc-700 hover:bg-zinc-900/60"
              }`}
            >
              <Image
                src={option.image}
                alt=""
                width={320}
                height={213}
                sizes="96px"
                className={`h-14 w-auto shrink-0 object-contain transition ${active ? "" : "opacity-60 saturate-50 group-hover:opacity-100 group-hover:saturate-100"}`}
              />
              <span className="min-w-0">
                <span className={`block font-display text-sm font-bold uppercase leading-tight ${active ? "text-amber-300" : "text-zinc-300"}`}>
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500">{option.range}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0e1117] p-5 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_0%_0%,rgba(245,158,11,0.14),transparent_60%)]" />
        <div className="relative flex items-center gap-5">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-400/90">{config.label}</p>
            <p className="font-display text-3xl font-bold uppercase leading-none sm:text-4xl">
              {period === "weekly" ? "Semaine en cours" : "Mois en cours"}
            </p>
            {board.from && board.to && (
              <p className="text-sm text-zinc-400">
                Du {board.from} au {board.to} <span className="text-zinc-600">(heure de Paris)</span>
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
              {board.players > 0 && (
                <span>
                  <span className="font-semibold text-zinc-200">{fmt(board.players)}</span> pilote{board.players > 1 ? "s" : ""}
                </span>
              )}
              <span>
                Clôture <span className="font-semibold text-zinc-200">{config.closing}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-[#0e1117] p-4 lg:col-span-2">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-zinc-300">Podium</p>
          {/* Visuel du podium en fond, libellés positionnés par-dessus au pourcentage du conteneur */}
          <div role="group" aria-label="Podium du classement" className="duel-rise relative mx-auto mt-4 aspect-[1536/826] w-full max-w-md @container">
            <div
              aria-hidden
              className="podium-halo pointer-events-none absolute left-1/2 top-[10%] h-[70%] w-[40%] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(245,158,11,0.16),transparent)]"
            />
            <Image
              src="/classement/podium.webp"
              alt=""
              aria-hidden
              fill
              sizes="(min-width: 1024px) 640px, 100vw"
              className="object-contain"
            />
            {/* Reflet qui balaie le podium : masqué par le visuel lui-même, il ne sort jamais des marches */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden [-webkit-mask-image:url(/classement/podium.webp)] [-webkit-mask-size:100%_100%] [mask-image:url(/classement/podium.webp)] [mask-size:100%_100%]"
            >
              <div className="podium-shine absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
            </div>
            {/* Flash doré puis onde sur le sommet de la marche 1, au moment où elle atterrit */}
            <div
              aria-hidden
              className="podium-flash pointer-events-none absolute left-1/2 bottom-[78.9%] aspect-[5/1] w-[44%] -translate-x-1/2 translate-y-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(254,240,138,0.9),transparent)] [--podium-delay:1.4s]"
            />
            <div
              aria-hidden
              className="podium-ripple pointer-events-none absolute left-1/2 bottom-[78.9%] aspect-[5/1] w-[36%] -translate-x-1/2 translate-y-1/2 rounded-[50%] border border-amber-300/70 [--podium-delay:1.6s]"
            />
            {PODIUM.map(({ rank, ms, delay, fx, position, name, line }) => {
              const row = board.rows.find((r) => r.rank === rank);
              const isMe = row?.user_id === userId;
              return (
                <div key={rank} className={`podium-label ${fx} absolute flex w-[30%] -translate-x-1/2 flex-col items-center text-center ${delay} ${position}`}>
                  {row ? (
                    <>
                      <p className="flex max-w-full items-center justify-center gap-1.5 font-display text-[clamp(0.7rem,2.9cqw,1.15rem)] font-bold uppercase leading-tight tracking-wide">
                        <span className="sr-only">Rang {rank} : </span>
                        <span title={row.username} className={`min-w-0 truncate ${isMe ? "text-amber-200" : name}`}>
                          {row.username}
                        </span>
                        {isMe && (
                          <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">Vous</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[clamp(0.6rem,1.9cqw,0.8rem)] tabular-nums text-zinc-400">
                        <CountUp value={row.xp} delay={ms} /> XP
                      </p>
                      {/* Trait qui rattache le libellé au haut de la marche */}
                      <span aria-hidden className={`podium-trait mt-1 h-3 w-px bg-gradient-to-b from-transparent ${line}`} />
                    </>
                  ) : (
                    <p className="text-[clamp(0.7rem,2.9cqw,1.15rem)] italic text-zinc-600">Place libre</p>
                  )}
                </div>
              );
            })}
            {SPARKLES.map((style) => (
              <Sparkles
                key={style}
                aria-hidden
                className={`podium-sparkle absolute size-[clamp(0.7rem,2.6cqw,1.1rem)] fill-amber-200/80 text-amber-200 ${style}`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-[#0e1117] p-4">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-zinc-300">{config.short}</p>
          <ul className="mt-2 divide-y divide-zinc-800">
            {config.prizes.map(([place, reward]) => (
              <li key={place} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="text-zinc-400">{place}</span>
                <span className="font-display font-semibold text-amber-400">{reward}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-snug text-zinc-500">
            Montants de base, multipliés par le coefficient de rang du pilote (×1 à ×3) selon son XP du mois.
            Le top 5 % compte le peloton classé, podium exclu.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#0e1117]">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <BarChart3 size={16} aria-hidden className="text-amber-400" />
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-zinc-300">Tableau complet</p>
        </div>
        {board.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">Pilote</th>
                  <th className="px-4 py-2 text-right font-medium">XP</th>
                  <th className="px-4 py-2 text-right font-medium">Prime</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map((r) => {
                  const isMe = r.user_id === userId;
                  return (
                    <tr key={r.user_id} className={`border-t border-zinc-800 ${isMe ? "bg-amber-500/10" : ""}`}>
                      <td className={`px-4 py-2 font-display font-semibold tabular-nums ${r.rank <= 3 ? "text-amber-300" : "text-zinc-500"}`}>{r.rank}</td>
                      <td className={`px-4 py-2 ${isMe ? "font-semibold text-amber-200" : "text-zinc-200"}`}>
                        {r.username}
                        {isMe && <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">Vous</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-300">{fmt(r.xp)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-amber-400">{r.prize > 0 ? fmt(r.prize) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-zinc-500">Aucun point d&apos;XP sur cette période.</p>
        )}
      </div>
    </>
  );
}

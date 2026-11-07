"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Gauge } from "lucide-react";
import { DYNO_MEDALS, dynoMedalModel } from "@/lib/dyno";
import { TIRE_LABEL, TIRE_THEME, WEATHER_LABEL } from "@/lib/format";
import type { DynoMedal, DynoReport } from "@/lib/types";

const n = (v: number, d = 1) => v.toLocaleString("fr-FR", { maximumFractionDigits: d });
const sp = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Compte-tours du banc : l'aiguille monte en régime puis se fige sur le SP final. */
function DynoGauge({ value, max }: { value: number; max: number }) {
  const [shown, setShown] = useState(0);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      setLocked(true);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 1750;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const rev = Math.sin(progress * Math.PI * 4) * (1 - progress) * 0.055;
      setShown(Math.max(0, Math.min(1.04, eased + rev)) * value);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setShown(value);
        setLocked(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const progress = Math.max(0, Math.min(1, shown / Math.max(1, max)));
  const angle = Math.PI - progress * Math.PI;
  const needleX = 100 + Math.cos(angle) * 66;
  const needleY = 100 - Math.sin(angle) * 66;
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = Math.PI - (i / 10) * Math.PI;
    return {
      x1: 100 + Math.cos(a) * 76,
      y1: 100 - Math.sin(a) * 76,
      x2: 100 + Math.cos(a) * 68,
      y2: 100 - Math.sin(a) * 68,
      major: i % 5 === 0,
    };
  });

  return (
    <div className="relative mx-auto w-full max-w-[22rem]">
      <svg viewBox="0 0 200 118" role="img" aria-label={`SP final ${sp(value)} sur un maximum de ${max}`} className="w-full">
        <path d="M 24 100 A 76 76 0 0 1 176 100" fill="none" stroke="#27272a" strokeWidth="11" strokeLinecap="round" />
        <path
          d="M 24 100 A 76 76 0 0 1 176 100"
          fill="none"
          stroke="url(#dyno-arc)"
          strokeWidth="7"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${progress} 1`}
        />
        <defs>
          <linearGradient id="dyno-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="55%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.major ? "#a1a1aa" : "#52525b"}
            strokeWidth={t.major ? 2.4 : 1.4}
            strokeLinecap="round"
          />
        ))}
        <line x1="100" y1="100" x2={needleX} y2={needleY} stroke="#f59e0b" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="100" cy="100" r="7" fill="#f59e0b" />
        <circle cx="100" cy="100" r="3" fill="#18181b" />
        <text x="26" y="116" fill="#71717a" fontSize="9" textAnchor="middle">0</text>
        <text x="174" y="116" fill="#71717a" fontSize="9" textAnchor="middle">{max}</text>
      </svg>
      <div className="-mt-2 text-center">
        <p className={`font-display text-5xl font-bold leading-none tabular-nums sm:text-6xl ${locked ? "clm-chrono-locked text-amber-300" : "text-amber-400/80"}`}>
          {sp(shown)}
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">SP final</p>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone = "text-zinc-100" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-black/25 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold leading-tight tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

export function DynoResult({
  r,
  thresholds,
  busy = false,
  onReplay,
  onClose,
}: {
  r: DynoReport;
  thresholds: Record<DynoMedal, number>;
  /** Nouveau passage en cours : on garde le résultat affiché et on désactive les relances. */
  busy?: boolean;
  onReplay?: () => void;
  onClose: () => void;
}) {
  const delta = r.previousBest != null ? r.spFinal - r.previousBest : null;
  const tie = delta != null && Math.abs(delta) < 0.005;
  const newMedalModels = DYNO_MEDALS.filter((m) => r.newMedals.includes(m.key));
  const achievedModel = r.medal ? dynoMedalModel(r.medal) : undefined;
  const tireTone = TIRE_THEME[r.tireType]?.text ?? "text-zinc-200";
  const gaugeMax = Math.max(100, Math.ceil(Math.max(thresholds.gold * 1.12, r.spFinal * 1.08) / 10) * 10);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line-strong bg-panel p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Banc d&apos;essai</p>
        <p className="mt-1 font-display text-xl font-bold uppercase">{r.configName}</p>
        <p className="text-sm text-zinc-400">{WEATHER_LABEL[r.weather]}</p>

        <div className="mt-4">
          <DynoGauge value={r.spFinal} max={gaugeMax} />
        </div>

        {delta != null && (
          <p className={`mt-3 text-sm font-semibold ${tie ? "text-amber-300" : delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {tie ? (
              "À égalité avec votre meilleur score du jour"
            ) : delta > 0 ? (
              <>Nouveau record personnel ! <span className="tabular-nums">+{sp(delta)} SP</span></>
            ) : (
              <><span className="tabular-nums">{sp(delta)} SP</span> vs votre meilleur score du jour</>
            )}
          </p>
        )}
        {delta == null && <p className="mt-3 text-sm text-zinc-400">Premier passage de référence sur ce banc aujourd&apos;hui.</p>}
        <p className="mt-1 text-xs text-zinc-500">
          Meilleur score du jour : <span className="tabular-nums text-zinc-300">{sp(r.personalBest)} SP</span>
        </p>
      </div>

      <div className="clm-medal-pop">
        {newMedalModels.length > 0 ? (
          <div className="rounded-2xl border border-amber-500/50 bg-amber-950/20 p-4">
            <p className="text-center font-display text-sm font-bold uppercase tracking-wide text-amber-300">
              {newMedalModels.length > 1 ? "Cascade de médailles débloquée !" : "Médaille débloquée !"}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
              {newMedalModels.map((m) => (
                <div key={m.key} className="flex items-center gap-2">
                  <Image src={m.image} alt="" width={44} height={44} className="h-11 w-11 object-contain drop-shadow-[0_0_12px_rgba(245,158,11,0.45)]" />
                  <div>
                    <p className={`font-display text-lg font-bold uppercase leading-none ${m.text}`}>{m.label}</p>
                    <p className="text-xs text-amber-200">+{m.coins} pièces</p>
                  </div>
                </div>
              ))}
            </div>
            {newMedalModels.length > 1 && (
              <p className="mt-3 text-center text-xs text-amber-200/80">
                Les paliers inférieurs non encore validés ont été versés automatiquement.
              </p>
            )}
          </div>
        ) : achievedModel ? (
          <p className="rounded-xl border border-line-strong bg-panel p-3 text-center text-sm text-zinc-300">
            Médaille <span className={`font-semibold ${achievedModel.text}`}>{achievedModel.label}</span> déjà validée aujourd&apos;hui.
            Améliorez encore votre SP pour viser plus haut !
          </p>
        ) : (
          <p className="rounded-xl border border-line-strong bg-panel p-3 text-center text-sm text-zinc-400">
            Pas de médaille cette fois. Peaufinez votre configuration et relancez le banc !
          </p>
        )}
      </div>

      <div className="rounded-xl border border-line-strong bg-panel p-3">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Objectifs des médailles</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {DYNO_MEDALS.map((m) => {
            const won = r.claimed.includes(m.key) || r.newMedals.includes(m.key);
            return (
              <div
                key={m.key}
                className={`rounded-lg border px-2 py-1.5 text-center ${
                  won ? "border-emerald-500/40 bg-emerald-500/5" : "border-line bg-black/20"
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Image src={m.image} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
                  <span className={`font-display text-xs font-bold uppercase ${m.text}`}>{m.label}</span>
                </div>
                <p className="mt-1 font-display text-sm font-bold tabular-nums">{n(thresholds[m.key], 0)} SP</p>
                <p className="text-[11px] font-semibold text-amber-300">+{m.coins} 🪙</p>
                <p className="text-[11px] font-semibold text-sky-300">+{m.coins} XP</p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[10px] text-zinc-500">Les médailles déjà validées aujourd&apos;hui sont surlignées en vert.</p>
      </div>

      <div className="rounded-xl border border-line-strong bg-panel p-4 text-center">
        <p className={`font-display text-2xl font-bold ${r.coins > 0 ? "text-amber-300" : "text-zinc-500"}`}>
          +{n(r.coins, 0)} pièces
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          {r.medalsCoins > 0 && <>Médailles : +{n(r.medalsCoins, 0)}</>}
          {r.medalsCoins > 0 && r.participationCoins > 0 && <span className="mx-1 text-zinc-600">·</span>}
          {r.participationCoins > 0 && <>Prime de participation : +{n(r.participationCoins, 0)}</>}
          {r.coins === 0 && "Aucune récompense supplémentaire aujourd'hui."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="SP final" value={sp(r.spFinal)} tone="text-amber-300" />
        <Stat label="Score méca." value={n(r.scoreMeca, 1)} />
        <Stat label="Gomme" value={`${n(r.tireGum, 1)} %`} hint="0 % d'usure au banc" tone="text-emerald-300" />
        <Stat label="Pneus" value={TIRE_LABEL[r.tireType] ?? r.tireType} hint={`× ${n(r.tireMod, 2)} météo`} tone={tireTone} />
      </div>

      <div className="rounded-xl border border-line bg-black/20 p-3 text-xs text-zinc-400">
        <p>
          Config : <span className="text-zinc-200">{r.engineName}</span>
          <span className="mx-1 text-zinc-600">·</span>
          <span className="text-zinc-200">{r.gearboxName}</span>
          <span className="mx-1 text-zinc-600">·</span>
          <span className={tireTone}>{r.tireName}</span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2">
          <Gauge size={14} aria-hidden />
          <span>{r.powerHp} ch</span>
          <span className="text-zinc-600">·</span>
          <span>{n(r.engineWeightKg + r.gearboxWeightKg, 0)} kg</span>
          <span className="text-zinc-600">·</span>
          <span>{r.shiftTimeMs} ms</span>
          <span className="text-zinc-600">·</span>
          <span className="text-emerald-400">0 % usure · 0 % casse</span>
        </p>
      </div>

      <p className="text-center font-display text-lg font-bold text-sky-300">Total XP récupérés : +{n(r.coins, 0)} XP</p>

      <div className={onReplay ? "grid grid-cols-2 gap-3" : ""}>
        {onReplay && (
          <button
            type="button"
            onClick={onReplay}
            disabled={busy}
            className="min-h-14 rounded-xl bg-amber-500 px-2 text-center font-display text-base font-bold uppercase leading-tight text-black hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60 sm:text-xl"
          >
            {busy ? "Passage en cours…" : "Rejouer le passage"}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="min-h-14 w-full rounded-xl border border-zinc-600 px-2 text-center font-display text-base font-bold uppercase leading-tight hover:bg-zinc-800 sm:text-xl"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

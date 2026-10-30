"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Wrench } from "lucide-react";
import { CLM_MEDALS, clmMedalModel, formatLapDelta, formatLapTime } from "@/lib/clm";
import { TIRE_LABEL, TIRE_THEME, WEATHER_LABEL } from "@/lib/format";
import type { ClmReport } from "@/lib/types";

const n = (v: number, d = 1) => v.toLocaleString("fr-FR", { maximumFractionDigits: d });

/** Chrono animé : les chiffres défilent puis se figent avec une pulsation. */
function Chrono({ seconds }: { seconds: number }) {
  const [value, setValue] = useState(0);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(seconds);
      setLocked(true);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 1150;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(seconds * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setValue(seconds);
        setLocked(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seconds]);

  return (
    <p
      className={`font-display text-5xl font-bold leading-none tabular-nums sm:text-6xl ${
        locked ? "clm-chrono-locked text-amber-300" : "text-amber-400/80"
      }`}
      aria-label={`Chrono ${formatLapTime(seconds)}`}
    >
      {formatLapTime(value)}
    </p>
  );
}

function Stat({ label, value, hint, tone = "text-zinc-100" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/25 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold leading-tight tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

export function ClmResult({
  r,
  onReplay,
  onReplaceBrokenPart,
  onClose,
}: {
  r: ClmReport;
  onReplay?: () => void;
  onReplaceBrokenPart?: () => void;
  onClose: () => void;
}) {
  const broken = r.brokenPart !== null;
  const brokenLabel = r.brokenPart === "moteur" ? "moteur" : r.brokenPart === "boite" ? "boîte" : "pièce";
  const replaceLabel = r.brokenPart === "moteur" ? "le moteur" : r.brokenPart === "boite" ? "la boîte" : "la pièce";
  const delta = r.lapSeconds != null && r.previousBest != null ? r.lapSeconds - r.previousBest : null;
  const tie = delta != null && Math.abs(delta) < 0.0005;
  const wear = Math.max(0, r.tireGumBefore - (r.tireGumAfter ?? r.tireGumBefore));
  const newMedalModels = CLM_MEDALS.filter((m) => r.newMedals.includes(m.key));
  const achievedModel = r.medal ? clmMedalModel(r.medal) : undefined;
  const tireTone = TIRE_THEME[r.tireType]?.text ?? "text-zinc-200";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-700 bg-[#10131a] p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Contre-la-montre solo</p>
        <p className="mt-1 font-display text-xl font-bold uppercase">{r.circuitName}</p>
        <p className="text-sm text-zinc-400">{WEATHER_LABEL[r.weather]}</p>

        {broken ? (
          <>
            <p className="mt-5 font-display text-4xl font-bold uppercase text-red-400">Casse {brokenLabel}</p>
            <p className="mt-2 text-sm text-red-200">Le tour n&apos;a pas été bouclé. Aucun chrono enregistré.</p>
          </>
        ) : (
          <>
            <div className="mt-4">
              <Chrono seconds={r.lapSeconds ?? 0} />
            </div>
            {delta != null && (
              <p className={`mt-3 text-sm font-semibold ${tie ? "text-amber-300" : delta < 0 ? "text-emerald-400" : "text-red-400"}`}>
                {tie ? (
                  "À égalité avec votre record"
                ) : delta < 0 ? (
                  <>Nouveau record ! <span className="tabular-nums">{formatLapDelta(delta)}</span></>
                ) : (
                  <><span className="tabular-nums">{formatLapDelta(delta)}</span> vs votre meilleur temps</>
                )}
              </p>
            )}
            {delta == null && <p className="mt-3 text-sm text-zinc-400">Premier chrono de référence sur ce circuit.</p>}
            {r.personalBest != null && (
              <p className="mt-1 text-xs text-zinc-500">
                Record personnel : <span className="tabular-nums text-zinc-300">{formatLapTime(r.personalBest)}</span>
              </p>
            )}
          </>
        )}
      </div>

      {!broken && (
        <div className="clm-medal-pop">
          {newMedalModels.length > 0 ? (
            <div className="rounded-2xl border border-amber-500/50 bg-amber-950/20 p-4">
              <p className="text-center font-display text-sm font-bold uppercase tracking-wide text-amber-300">
                {newMedalModels.length > 1 ? "Cascade de médailles décrochée !" : "Médaille décrochée !"}
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
                  Les paliers inférieurs ont été versés automatiquement.
                </p>
              )}
            </div>
          ) : achievedModel ? (
            <p className="rounded-xl border border-zinc-700 bg-[#10131a] p-3 text-center text-sm text-zinc-300">
              Médaille <span className={`font-semibold ${achievedModel.text}`}>{achievedModel.label}</span> déjà validée aujourd&apos;hui.
              Améliorez encore votre chrono !
            </p>
          ) : (
            <p className="rounded-xl border border-zinc-700 bg-[#10131a] p-3 text-center text-sm text-zinc-400">
              Pas de médaille cette fois. Continuez à peaufiner votre configuration !
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-zinc-700 bg-[#10131a] p-4 text-center">
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
        <Stat label="SP final" value={r.spFinal != null ? n(r.spFinal, 1) : "—"} tone="text-amber-300" />
        <Stat label="Score méca." value={n(r.scoreMeca, 1)} />
        <Stat label="Gomme restante" value={r.tireGumAfter != null ? `${n(r.tireGumAfter, 1)} %` : "—"} hint={`−${n(wear, 1)} pts ce tour`} tone={r.tireDestroyed ? "text-red-400" : "text-emerald-300"} />
        <Stat
          label="Pneus"
          value={TIRE_LABEL[r.tireType] ?? r.tireType}
          hint={`× ${n(r.tireMod, 2)}`}
          tone={tireTone}
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-400">
        <p>
          Config : <span className="text-zinc-200">{r.engineName}</span>
          <span className="mx-1 text-zinc-600">·</span>
          <span className="text-zinc-200">{r.gearboxName}</span>
          <span className="mx-1 text-zinc-600">·</span>
          <span className={tireTone}>{r.tireName}</span>
        </p>
        <p className="mt-1">
          Risque moteur : {r.engineBreakProb != null ? `${n(r.engineBreakProb)} %` : "—"}
          <span className="mx-1 text-zinc-600">·</span>
          Risque boîte : {r.gearboxBreakProb != null ? `${n(r.gearboxBreakProb)} %` : "non testée"}
        </p>
        {broken && (
          <p className="mt-2 flex items-center gap-1.5 text-red-300">
            <Wrench size={14} aria-hidden />
            La pièce cassée part au musée de la casse.
          </p>
        )}
        {r.tireDestroyed && <p className="mt-2 text-red-300">Vos pneus sont morts : changez-les avant de relancer.</p>}
      </div>

      <div className={onReplay || onReplaceBrokenPart ? "grid grid-cols-2 gap-3" : ""}>
        {onReplay && (
          <button
            type="button"
            onClick={onReplay}
            className="min-h-14 rounded-xl bg-amber-500 px-2 text-center font-display text-base font-bold uppercase leading-tight text-black hover:bg-amber-400 sm:text-xl"
          >
            Rejouer le tour
          </button>
        )}
        {onReplaceBrokenPart && (
          <button
            type="button"
            onClick={onReplaceBrokenPart}
            className="min-h-14 w-full rounded-xl bg-amber-500 px-2 text-center font-display text-base font-bold uppercase leading-tight text-black hover:bg-amber-400 sm:text-xl"
          >
            Remplacer {replaceLabel}
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

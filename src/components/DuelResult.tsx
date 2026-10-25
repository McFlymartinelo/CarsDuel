import { TrackCard } from "@/components/TrackCard";
import { BONUS_LABEL, TIRE_LABEL, TIRE_THEME } from "@/lib/format";
import type { DuelReport } from "@/lib/types";

const f = (n: number, d = 1) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-1.5 border-t border-zinc-800 py-1.5 text-[13px] leading-tight sm:text-sm">
      <span className="min-w-0 text-zinc-300">{label}</span>
      <span className="whitespace-nowrap font-semibold tabular-nums">{children}</span>
    </div>
  );
}

function Break({ broke }: { broke: boolean }) {
  return broke ? <span className="text-red-400">OUI</span> : <span className="text-emerald-400">NON</span>;
}

function TireRow({ type, bonusPct, malus, mod }: { type: string; bonusPct: number; malus: number; mod: number }) {
  const label = TIRE_LABEL[type] ?? type;
  return (
    <Row label={<>
      <span className={TIRE_THEME[type]?.text}>{label}</span>
      {` ${bonusPct >= 0 ? "+" : "−"}${Math.abs(bonusPct)} %${malus > 0 ? ` (usure −${malus})` : ""}`}
    </>}>
      <span className={mod < 1 ? "text-red-400" : mod > 1 ? "text-emerald-400" : ""}>× {f(mod, 2)}</span>
    </Row>
  );
}

/** Écran de résultat : piste, comparaison Vous / adversaire, verdict, actions. */
export function DuelResult({ r, onReplay, onClose }: { r: DuelReport; onReplay?: () => void; onClose: () => void }) {
  const engineBroke = r.brokenPart === "moteur";
  const gearboxBroke = r.brokenPart === "boite";

  return (
    <div className="space-y-3">
      <TrackCard weather={r.weather} lines={r.weatherLines} />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border-2 border-amber-500 bg-[#10131a] p-3">
          <p className="font-display text-sm font-bold uppercase text-amber-400">Vous</p>
          {r.attackerSp !== null ? (
            <p className="font-display text-4xl font-bold leading-tight text-amber-400 sm:text-5xl">{f(r.attackerSp)}</p>
          ) : (
            <p className="font-display text-4xl font-bold leading-tight text-red-400">CASSE</p>
          )}
          <Row label="Score mécanique">{f(r.scoreMeca)}</Row>
          <TireRow type={r.tireType} bonusPct={r.tireBonusPct} malus={r.tireMalus} mod={r.tireMod} />
          <Row label="Casse moteur"><Break broke={engineBroke} /></Row>
          <Row label="Casse boîte"><Break broke={gearboxBroke} /></Row>
          {r.bonus && <Row label="Bonus"><span className="text-amber-300">{BONUS_LABEL[r.bonus] ?? r.bonus}</span></Row>}
        </div>

        <div className="rounded-xl border border-zinc-700 bg-[#10131a] p-3">
          <p className="font-display text-sm font-bold uppercase text-zinc-400">Adversaire</p>
          <p className="truncate text-sm text-zinc-300">{r.defenderName}</p>
          {r.defenderSp !== null ? (
            <p className="font-display text-4xl font-bold leading-tight text-zinc-300 sm:text-5xl">{f(r.defenderSp)}</p>
          ) : (
            <p className="font-display text-4xl font-bold leading-tight text-red-400">CASSE</p>
          )}
          <Row label="Score mécanique">{f(r.ghostScoreMeca)}</Row>
          <TireRow type={r.ghostTireType} bonusPct={r.ghostTireBonusPct} malus={r.ghostTireMalus} mod={r.ghostTireMod} />
        </div>
      </div>

      <div className={`duel-verdict rounded-xl border-2 p-4 text-center ${r.win ? "border-emerald-500 bg-emerald-950/30" : "border-red-600 bg-red-950/30"}`}>
        <p className={`font-display text-5xl font-bold uppercase ${r.win ? "text-emerald-400" : "text-red-400"}`}>{r.win ? "Victoire" : "Défaite"}</p>
        <p className="mt-1 font-display text-lg font-semibold">
          <span className="text-amber-400">+{r.coins} pièces</span> · <span className="text-sky-400">+{r.xp} XP</span>
        </p>
      </div>

      <div className={onReplay ? "grid grid-cols-2 gap-3" : ""}>
        {onReplay && (
          <button
            type="button"
            onClick={onReplay}
            className="min-h-14 rounded-xl bg-amber-500 px-2 text-center font-display text-base font-bold uppercase leading-tight text-black hover:bg-amber-400 sm:text-xl"
          >
            Recommencer un duel
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

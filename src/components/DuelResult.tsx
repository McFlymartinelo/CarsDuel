import Link from "next/link";
import { BONUS_LABEL, CATEGORY_LABEL, TIRE_LABEL, TIRE_THEME, WEATHER_LABEL } from "@/lib/format";
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

const Ok = ({ prob }: { prob: number | null }) =>
  prob === null ? <span className="text-zinc-500">—</span> : <span className="text-emerald-400">{f(prob)} % OK</span>;

/** Écran de résultat : météo, comparaison VOUS / fantôme, verdict, actions. */
export function DuelResult({ r, onReplay, replaying }: { r: DuelReport; onReplay: () => void; replaying: boolean }) {
  const rain = r.weather === "rain_hot" || r.weather === "rain_cool";
  const engineBroke = r.brokenPart === "moteur";
  const gearboxBroke = r.brokenPart === "boite";
  const mechLine =
    r.brokenPart !== null
      ? `Casse ${CATEGORY_LABEL[r.brokenPart].toLowerCase()} — ${r.partSaved ? "pièce conservée (Assistance plateau)" : "pièce détruite. Recyclage possible pour 1 pièce."}`
      : r.gumAfter !== null
        ? `Gomme ${f(r.gumBefore, 0)} % → ${f(r.gumAfter, 0)} % · ${
            r.engineRun && r.gearboxRun ? "runs +1 sur moteur et boîte" : r.engineRun ? "runs +1 sur le moteur" : r.gearboxRun ? "runs +1 sur la boîte" : "aucune usure mécanique (bonus)"
          }${r.gumAfter === 0 ? " Pneu mort. Recyclage possible pour 1 pièce." : ""}`
        : "";

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border p-3 ${rain ? "border-cyan-500/60 bg-cyan-950/30" : "border-amber-500/60 bg-amber-950/20"}`}>
        <p className={`font-display text-xl font-bold ${rain ? "text-cyan-300" : "text-amber-300"}`}>{WEATHER_LABEL[r.weather]}</p>
        <p className="text-sm text-zinc-300">{r.weatherNote}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border-2 border-amber-500 bg-[#10131a] p-3">
          <p className="font-display text-sm font-bold uppercase text-amber-400">Vous</p>
          {r.attackerSp !== null ? (
            <p className="font-display text-4xl font-bold leading-tight text-amber-400 sm:text-5xl">{f(r.attackerSp)}</p>
          ) : (
            <p className="font-display text-4xl font-bold leading-tight text-red-400">CASSE</p>
          )}
          <p className="mb-1 text-sm text-zinc-300">SP final</p>
          <Row label="Score méca">{f(r.scoreMeca)}</Row>
          <Row label={<><span className={TIRE_THEME[r.tireType]?.text}>{TIRE_LABEL[r.tireType] ?? r.tireType}</span>{` ${r.tireBonusPct >= 0 ? "+" : "−"}${Math.abs(r.tireBonusPct)} %${r.tireMalus > 0 ? ` (usure −${r.tireMalus})` : ""}`}</>}>
            <span className={r.tireMod < 1 ? "text-red-400" : r.tireMod > 1 ? "text-emerald-400" : ""}>× {f(r.tireMod, 2)}</span>
          </Row>
          <Row label="Casse moteur">
            {engineBroke ? <span className="text-red-400">{f(r.engineProb ?? 0)} % CASSE</span> : <Ok prob={r.engineProb} />}
          </Row>
          <Row label="Casse boîte">
            {gearboxBroke ? <span className="text-red-400">{f(r.gearboxProb ?? 0)} % CASSE</span> : <Ok prob={r.gearboxProb} />}
          </Row>
          {r.bonus && <Row label="Bonus"><span className="text-amber-300">{BONUS_LABEL[r.bonus] ?? r.bonus}</span></Row>}
        </div>

        <div className="rounded-xl border border-zinc-700 bg-[#10131a] p-3">
          <p className="truncate font-display text-sm font-bold uppercase text-zinc-400">Fantôme · {r.defenderName}</p>
          <p className="font-display text-4xl font-bold leading-tight text-zinc-300 sm:text-5xl">{f(r.defenderSp)}</p>
          <p className="mb-1 text-sm text-zinc-300">SP final</p>
          <Row label="Zéro usure"><span className="text-zinc-500">—</span></Row>
          <Row label="Zéro casse"><span className="text-zinc-500">—</span></Row>
        </div>
      </div>

      <div className={`duel-verdict rounded-xl border-2 p-4 text-center ${r.win ? "border-emerald-500 bg-emerald-950/30" : "border-red-600 bg-red-950/30"}`}>
        <p className={`font-display text-5xl font-bold uppercase ${r.win ? "text-emerald-400" : "text-red-400"}`}>{r.win ? "Victoire" : "Défaite"}</p>
        <p className="mt-1 font-display text-lg font-semibold">
          <span className="text-amber-400">+{r.coins} pièces</span> · <span className="text-sky-400">+{r.xp} XP</span>
        </p>
        {mechLine && <p className="mt-1 text-sm text-zinc-300">{mechLine}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onReplay}
          disabled={replaying}
          className="min-h-14 rounded-xl bg-amber-500 font-display text-xl font-bold uppercase text-black hover:bg-amber-400 disabled:opacity-50"
        >
          {replaying ? "…" : "Rejouer"}
        </button>
        <Link href="/garage" className="flex min-h-14 items-center justify-center rounded-xl border border-zinc-600 font-display text-xl font-bold uppercase hover:bg-zinc-800">
          Garage
        </Link>
      </div>
    </div>
  );
}

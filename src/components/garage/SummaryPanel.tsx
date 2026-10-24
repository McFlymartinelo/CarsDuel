import { WEATHER_SHORT } from "@/lib/format";
import { scoreMeca, tireMalus, tireModifier, totalWeight } from "@/lib/game";
import type { TireModifier } from "@/lib/queries";
import type { UserCard, Weather } from "@/lib/types";

const WEATHERS: Weather[] = ["sunny_hot", "sunny_cool", "rain_hot", "rain_cool"];
const fmt = (n: number, d = 1) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Score mécanique, poids et SP estimé par météo (affichage ; le duel est calculé côté base). */
export function SummaryPanel({
  engine,
  gearbox,
  tire,
  modifiers,
}: {
  engine?: UserCard;
  gearbox?: UserCard;
  tire?: UserCard;
  modifiers: TireModifier[];
}) {
  if (!engine || !gearbox) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-[#0e1117] p-4 text-sm text-zinc-500">
        Équipez un moteur et une boîte pour voir l&apos;estimation de performance.
      </div>
    );
  }
  const meca = scoreMeca(engine.card_templates, gearbox.card_templates);
  const weight = totalWeight(engine.card_templates, gearbox.card_templates);
  const gum = tire?.tire_wear ?? 0;
  const tireType = tire?.card_templates.tire_type;

  const tireName = tire?.card_templates.name.replace(/^Pneu /, "").toLowerCase();
  const MOBILE_LABEL: Record<Weather, string> = { sunny_hot: "Chaud", sunny_cool: "Frais", rain_hot: "Pluie chaude", rain_cool: "Pluie fraîche" };

  return (
    <>
    {/* Mobile : tuiles */}
    <div className="space-y-3 md:hidden">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-[#10131a] p-3">
          <p className="font-display text-xs uppercase text-zinc-300">Score méca estimé</p>
          <p className="font-display text-3xl font-bold text-amber-400">{fmt(meca)} <span className="text-base">PTS</span></p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-[#10131a] p-3">
          <p className="font-display text-xs uppercase text-zinc-300">Poids cumulé</p>
          <p className="font-display text-3xl font-bold text-amber-400">{fmt(weight, 0)} <span className="text-base">KG</span></p>
        </div>
      </div>
      {tire && tireType && (
        <>
          <p className="text-sm text-zinc-300">
            SP estimé selon la météo ({tireName})
            {tireMalus(gum) > 0 && <span className="text-amber-400"> · malus −{tireMalus(gum)} %</span>}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {WEATHERS.map((w) => {
              const m = modifiers.find((x) => x.tire_type === tireType && x.weather === w);
              if (!m) return null;
              const sp = meca * tireModifier(m.perf_bonus_pct, gum);
              return (
                <div key={w} className="rounded-xl border border-zinc-800 bg-[#10131a] px-2 py-2">
                  <p className="text-xs leading-tight text-zinc-300">{MOBILE_LABEL[w]}</p>
                  <p className={`font-display text-sm font-bold leading-tight ${sp >= meca ? "text-emerald-400" : "text-red-400"}`}>
                    SP {fmt(sp)}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>

    {/* PC : panneau */}
    <div className="hidden space-y-3 rounded-xl border border-zinc-800 bg-[#0e1117] p-3 md:block [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:16px_16px]">
      <div className="rounded-lg border border-zinc-800 bg-[#0b0e13] p-3">
        <p className="font-display text-sm uppercase text-zinc-300">Score mécanique estimé</p>
        <p className="font-display text-4xl font-bold text-amber-400">
          {fmt(meca)} <span className="text-xl">PTS</span>
        </p>
        <hr className="my-2 border-zinc-800" />
        <p className="font-display text-sm uppercase text-zinc-300">Poids cumulé</p>
        <p className="font-display text-3xl font-bold text-amber-400">
          {fmt(weight, 0)} <span className="text-lg">KG</span>
        </p>
      </div>

      {tire && tireType && (
        <div className="rounded-lg border border-zinc-800 bg-[#0b0e13] p-3 text-sm">
          <p className="mb-2 text-xs text-zinc-400">
            SP estimé selon la météo ({tire.card_templates.name.replace(/^Pneu /, "").toLowerCase()})
            {tireMalus(gum) > 0 && <span className="text-amber-400"> · malus usure −{tireMalus(gum)} %</span>}
          </p>
          <div className="space-y-1">
            {WEATHERS.map((w) => {
              const m = modifiers.find((x) => x.tire_type === tireType && x.weather === w);
              if (!m) return null;
              const sp = meca * tireModifier(m.perf_bonus_pct, gum);
              const bonus = m.perf_bonus_pct;
              return (
                <div key={w} className="flex justify-between gap-2">
                  <span className="text-zinc-300">
                    {WEATHER_SHORT[w]} · {bonus > 0 ? "+" : bonus < 0 ? "−" : ""}
                    {Math.abs(bonus)} %
                  </span>
                  <span className={`font-semibold tabular-nums ${sp >= meca ? "text-emerald-400" : "text-red-400"}`}>{fmt(sp)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
    </>
  );
}

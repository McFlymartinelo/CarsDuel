import { CloudDrizzle, CloudRain, CloudSun, Sun, type LucideIcon } from "lucide-react";
import { WEATHER_LABEL } from "@/lib/format";
import { scoreMeca, tireMalus, tireModifier, totalWeight } from "@/lib/game";
import type { TireModifier } from "@/lib/queries";
import type { UserCard, Weather } from "@/lib/types";

const WEATHERS: { id: Weather; icon: LucideIcon }[] = [
  { id: "sunny_hot", icon: Sun },
  { id: "sunny_cool", icon: CloudSun },
  { id: "rain_hot", icon: CloudRain },
  { id: "rain_cool", icon: CloudDrizzle },
];
const fmt = (n: number, d = 1) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Résumé de la config : score mécanique et score final par condition de piste. */
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
        Équipez un moteur et une boîte pour voir le résumé de votre config.
      </div>
    );
  }
  const meca = scoreMeca(engine.card_templates, gearbox.card_templates);
  const weight = totalWeight(engine.card_templates, gearbox.card_templates);
  const gum = tire?.tire_wear ?? 0;
  const tireType = tire?.card_templates.tire_type;
  const malus = tire ? tireMalus(gum) : 0;

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-[#0e1117] p-4">
      <h2 className="font-display text-lg font-bold uppercase">Résumé de votre config</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-display text-xs uppercase text-zinc-400">Score mécanique estimé</p>
          <p className="font-display text-3xl font-bold text-amber-400">{fmt(meca)} <span className="text-base">PTS</span></p>
        </div>
        <div>
          <p className="font-display text-xs uppercase text-zinc-400">Poids cumulé</p>
          <p className="font-display text-3xl font-bold text-amber-400">{fmt(weight, 0)} <span className="text-base">KG</span></p>
        </div>
      </div>
      {tire && tireType ? (
        <div>
          <p className="mb-2 text-sm text-zinc-300">
            Score final selon les conditions de piste
            {malus > 0 && <span className="text-amber-400"> · malus usure −{malus} %</span>}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {WEATHERS.map(({ id, icon: Icon }) => {
              const mod = modifiers.find((x) => x.tire_type === tireType && x.weather === id);
              if (!mod) return null;
              const sp = meca * tireModifier(mod.perf_bonus_pct, gum);
              const bonus = Number(mod.perf_bonus_pct);
              return (
                <div key={id} className="rounded-xl border border-zinc-800 bg-[#10131a] p-2.5">
                  <p className="flex items-center gap-1.5 text-xs text-zinc-300">
                    <Icon size={14} className="shrink-0 text-amber-300" />
                    <span className="leading-tight">{WEATHER_LABEL[id]}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{bonus > 0 ? "+" : bonus < 0 ? "−" : ""}{Math.abs(bonus)} %</p>
                  <p className={`font-display text-xl font-bold tabular-nums ${sp >= meca ? "text-emerald-400" : "text-red-400"}`}>{fmt(sp)}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Équipez des pneus pour le score final selon les conditions de piste.</p>
      )}
    </div>
  );
}

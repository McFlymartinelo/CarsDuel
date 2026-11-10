import Link from "next/link";
import { Flag, Gauge, Lightbulb, TriangleAlert, Wrench } from "lucide-react";
import { diagnoseDuel } from "@/lib/duel-diagnosis";
import type { DuelReport } from "@/lib/types";

const ICONS = { wrench: Wrench, gauge: Gauge, tire: Lightbulb, alert: TriangleAlert, flag: Flag };

const BOX: Record<"bad" | "good" | "warn", string> = {
  bad: "border-red-400/40 bg-gradient-to-br from-red-500/10 to-transparent",
  good: "border-emerald-400/35 bg-gradient-to-br from-emerald-500/10 to-transparent",
  warn: "border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-transparent",
};

const ICON_BOX: Record<"bad" | "good" | "warn", string> = {
  bad: "border-red-400/40 bg-red-500/10 text-red-300",
  good: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-400/40 bg-amber-500/10 text-amber-300",
};

const EYEBROW: Record<"bad" | "good" | "warn", string> = {
  bad: "text-red-300",
  good: "text-emerald-300",
  warn: "text-amber-300",
};

const CHIP: Record<"bad" | "good" | "warn", string> = {
  bad: "border-red-400/35 bg-red-500/10 text-red-300",
  good: "border-emerald-400/35 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-400/35 bg-amber-500/10 text-amber-300",
};

/** Met en avant les valeurs chiffrées (et le qualificatif de la maquette) dans la phrase. */
function Reason({ text }: { text: string }) {
  const parts = text.split(/(légèrement devant|[+−]?\d[\d\u00a0\u202f ]*(?:,\d+)? ?(?:ch|kg|ms|pts?|%)|×\d+,\d+)/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <b key={i} className="font-semibold text-zinc-100">{part}</b>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Bloc « diagnostic » affiché sous le verdict : facteur dominant et piste concrète. */
export function DuelDiagnosis({ r }: { r: DuelReport }) {
  const d = diagnoseDuel(r);
  const Icon = ICONS[d.icon];
  const HintIcon = d.hint ? ICONS[d.hint.icon] : null;

  return (
    <section aria-label="Analyse de la course" className={`duel-rise rounded-xl border p-3 ${BOX[d.tone]}`}>
      <div className="flex items-start gap-2.5">
        <span className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border ${ICON_BOX[d.tone]}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <p className={`font-display text-[8.5px] font-bold uppercase tracking-[0.16em] ${EYEBROW[d.tone]}`}>{d.eyebrow}</p>
          <h3 className="mt-0.5 font-display text-lg font-bold uppercase leading-tight text-white">{d.title}</h3>
        </div>
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
        <Reason text={d.reason} />
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {d.deltas.map((delta) => (
          <span
            key={delta.label}
            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${CHIP[delta.tone]}`}
          >
            {delta.label}
          </span>
        ))}
      </div>

      {d.hint && (
        <Link
          href={d.hint.href}
          className="mt-2.5 inline-flex items-center gap-1 font-display text-[10.5px] font-bold uppercase tracking-wide text-amber-300 hover:text-amber-200"
        >
          {HintIcon && <HintIcon size={13} />}
          {d.hint.label}
        </Link>
      )}
    </section>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TrophyArt } from "@/components/garage/TrophyArt";
import { requireUser } from "@/lib/auth";
import { loadTrophyStats } from "@/lib/queries";

export const metadata = { title: "Ma vitrine de trophées — CarsDuel" };

const fmt = (n: number) => n.toLocaleString("fr-FR");

export default async function TrophiesPage() {
  const { user } = await requireUser();
  const stats = await loadTrophyStats(user.id);

  const trophies = [
    {
      value: stats.attack_wins,
      label: "Victoires en attaque",
      detail: "Duels gagnés en attaquant",
      image: "/trophees/medaille_de_course.png",
      kind: "medal" as const,
      accent: "border-amber-500/25",
      text: "text-amber-300",
      glow: "bg-amber-500/10",
    },
    {
      value: stats.monthly_firsts,
      label: "Meilleur pilote du mois",
      detail: "1re place au classement XP mensuel",
      image: "/trophees/trophee_grandiose.png",
      kind: "trophy" as const,
      accent: "border-yellow-400/30",
      text: "text-yellow-300",
      glow: "bg-yellow-400/10",
    },
    {
      value: stats.weekly_firsts,
      label: "Meilleur pilote de la semaine",
      detail: "1re place au classement XP hebdomadaire",
      image: "/trophees/trophee_moyen.png",
      kind: "trophy" as const,
      accent: "border-sky-400/25",
      text: "text-sky-300",
      glow: "bg-sky-400/10",
    },
    {
      value: stats.chrono_gold,
      label: "Médailles d'or",
      detail: "Contre-la-montre",
      image: "/trophees/medaille_chrono_or.png",
      kind: "medal" as const,
      accent: "border-yellow-400/35",
      text: "text-yellow-300",
      glow: "bg-yellow-400/10",
    },
    {
      value: stats.chrono_silver,
      label: "Médailles d'argent",
      detail: "Contre-la-montre",
      image: "/trophees/medaille_chrono_argent.png",
      kind: "medal" as const,
      accent: "border-zinc-300/30",
      text: "text-zinc-200",
      glow: "bg-zinc-300/10",
    },
    {
      value: stats.chrono_bronze,
      label: "Médailles de bronze",
      detail: "Contre-la-montre",
      image: "/trophees/medaille_chrono_bronze.png",
      kind: "medal" as const,
      accent: "border-orange-600/35",
      text: "text-orange-300",
      glow: "bg-orange-600/10",
    },
  ];

  const totalWins = stats.attack_wins + stats.defense_wins;

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <Link href="/garage" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-amber-300">
          <ArrowLeft size={16} aria-hidden />
          Retour au garage
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase sm:text-4xl">Ma vitrine de trophées</h1>
        <p className="text-sm text-zinc-400">
          Vos victoires, vos titres de meilleur pilote et vos médailles de contre-la-montre, réunis au même endroit.
        </p>
      </header>

      <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0e1117] p-5 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_0%_0%,rgba(245,158,11,0.14),transparent_60%)]" />
        <div className="relative flex flex-wrap items-end gap-x-10 gap-y-3">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-400/90">Palmarès de {user.username}</p>
            <p className="mt-1 font-display text-5xl font-bold leading-none tabular-nums text-amber-300">{fmt(totalWins)}</p>
            <p className="mt-1 text-sm text-zinc-400">duels gagnés au total</p>
          </div>
          <p className="pb-1 text-sm text-zinc-400">
            <span className="font-semibold text-zinc-200">{fmt(stats.attack_wins)}</span> en attaque
            <span className="mx-2 text-zinc-600">·</span>
            <span className="font-semibold text-zinc-200">{fmt(stats.defense_wins)}</span> en défense
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trophies.map(({ value, label, detail, image, kind, accent, text, glow }) => (
          <article key={label} className={`relative overflow-hidden rounded-xl border ${accent} bg-[#0e1117] p-4`}>
            <div aria-hidden className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${glow}`} />
            <div className="relative flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0">
                <TrophyArt src={image} alt="" kind={kind} />
              </div>
              <div className="min-w-0">
                <p className={`font-display text-4xl font-bold leading-none tabular-nums ${text}`}>{fmt(value)}</p>
                <p className="mt-2 font-display text-sm font-semibold uppercase leading-tight tracking-wide text-zinc-200">{label}</p>
                <p className="mt-0.5 text-xs leading-snug text-zinc-500">{detail}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-zinc-500">
        Les titres de meilleur pilote sont comptés à la clôture de chaque semaine et de chaque mois (heure de Paris).
        Les médailles de contre-la-montre sont ajoutées dès qu&apos;une course chronométrée est terminée.
      </p>
    </section>
  );
}

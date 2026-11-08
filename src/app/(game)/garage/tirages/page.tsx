import Link from "next/link";
import { CalendarDays, CalendarRange, History, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { DailyPull } from "@/components/DailyPull";
import { PageHeader } from "@/components/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime, nextParisMidnight, nextParisMonday, parisToday, parisWeekStart } from "@/lib/format";
import { loadPullHistory, type PullRow } from "@/lib/queries";
import { claimDailyPull, claimWeeklyPull } from "../actions";

export const metadata = { title: "Tirages gratuits — CarsDuel" };

function group(rows: PullRow[]) {
  const groups = new Map<string, { key: string; at: string; source: string; labels: string[] }>();
  for (const row of rows) {
    const key = `${row.source}|${row.acquired_at}`;
    const found = groups.get(key);
    if (found) found.labels.push(row.label);
    else groups.set(key, { key, at: row.acquired_at, source: row.source, labels: [row.label] });
  }
  return [...groups.values()];
}

export default async function PullsPage() {
  const { user } = await requireUser();
  const history = group(await loadPullHistory(user.id));

  return (
    <>
      <PageHeader
        back
        title="Mes tirages gratuits"
        description="Un tirage quotidien et un tirage hebdomadaire pour agrandir votre collection."
      />
      <DailyPull
        dailyClaimed={user.last_daily_pull === parisToday()}
        weeklyClaimed={user.last_weekly_pull === parisWeekStart()}
        dailyAction={claimDailyPull}
        weeklyAction={claimWeeklyPull}
        nextDaily={nextParisMidnight()}
        nextWeekly={nextParisMonday()}
      />
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold uppercase">
              <History size={18} className="text-amber-400" aria-hidden />
              Historique des tirages
            </h2>
            <p className="mt-1 text-sm text-zinc-400">Les cartes obtenues aux tirages quotidiens et hebdomadaires.</p>
          </div>
          {history.length > 0 && (
            <span className="rounded-full border border-line-strong bg-panel px-3 py-1 text-xs font-semibold text-zinc-300">
              {history.length} tirage{history.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {history.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Aucun tirage pour le moment"
            description="Lancez un tirage quotidien ou hebdomadaire pour remplir votre historique."
            action={
              <Link href="#tirage" className={buttonClass({ variant: "ghost", size: "sm" })}>
                Lancer un tirage
              </Link>
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-panel-mid">
            {history.map((h) => {
              const weekly = h.source === "weekly_pull";
              const Icon = weekly ? CalendarRange : CalendarDays;
              return (
                <li
                  key={h.key}
                  className={`flex items-start gap-3 border-b border-line/80 px-4 py-3 last:border-0 ${weekly ? "bg-amber-500/[0.04]" : ""}`}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
                      weekly ? "border-amber-400/40 bg-amber-500/10 text-amber-300" : "border-line-strong bg-zinc-800/50 text-zinc-300"
                    }`}
                  >
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className={`font-display text-sm font-bold uppercase tracking-wide ${weekly ? "text-amber-300" : "text-zinc-200"}`}>
                        {weekly ? "Tirage hebdomadaire" : "Tirage quotidien"}
                      </p>
                      <time className="text-xs text-zinc-500">{formatDateTime(h.at)}</time>
                    </div>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {h.labels.map((label, i) => (
                        <li key={i} className="rounded-md border border-line-strong/70 bg-black/30 px-2 py-0.5 text-xs text-zinc-300">
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

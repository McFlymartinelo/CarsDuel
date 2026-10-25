import { requireUser } from "@/lib/auth";
import { DailyPull } from "@/components/DailyPull";
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
      <DailyPull
        dailyClaimed={user.last_daily_pull === parisToday()}
        weeklyClaimed={user.last_weekly_pull === parisWeekStart()}
        dailyAction={claimDailyPull}
        weeklyAction={claimWeeklyPull}
        nextDaily={nextParisMidnight()}
        nextWeekly={nextParisMonday()}
      />
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold uppercase">Historique des tirages</h2>
        {history.length === 0 && <p className="text-sm text-zinc-500">Aucun tirage pour le moment.</p>}
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-[#0e1117] px-4">
          {history.map((h) => (
            <li key={h.key} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
              <span>
                <span className="font-medium">{h.source === "weekly_pull" ? "Hebdomadaire" : "Quotidien"}</span>
                <span className="mt-0.5 block text-zinc-300">{h.labels.join(" · ")}</span>
              </span>
              <span className="text-xs text-zinc-500">{formatDateTime(h.at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

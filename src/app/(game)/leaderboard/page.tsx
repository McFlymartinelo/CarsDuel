import { requireUser } from "@/lib/auth";
import { QuestPing } from "@/components/QuestPing";
import { LeaderboardBoard, type PeriodBoard } from "@/components/LeaderboardBoard";
import { getLeaderboard, type LeaderboardRow } from "@/lib/queries";

export const metadata = { title: "Classement — CarsDuel" };

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long" }).format(new Date(iso));

// period_end est exclusif (00:00 du jour suivant) : on affiche la veille comme dernier jour.
function toBoard(rows: LeaderboardRow[]): PeriodBoard {
  const first = rows[0];
  return {
    rows,
    from: first ? fmt(first.period_start) : null,
    to: first ? fmt(new Date(new Date(first.period_end).getTime() - 1).toISOString()) : null,
    players: first?.player_count ?? 0,
  };
}

export default async function LeaderboardPage() {
  const { user } = await requireUser();
  const [weekly, monthly] = await Promise.all([getLeaderboard(user.id, "weekly"), getLeaderboard(user.id, "monthly")]);

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <QuestPing quest="leaderboard" />
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold uppercase sm:text-4xl">Classement XP</h1>
      </header>
      <LeaderboardBoard userId={user.id} weekly={toBoard(weekly)} monthly={toBoard(monthly)} />
    </section>
  );
}

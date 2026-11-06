import { requireUser } from "@/lib/auth";
import { QuestPing } from "@/components/QuestPing";
import { PageHeader } from "@/components/PageHeader";
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
    <section className="space-y-6">
      <QuestPing quest="leaderboard" />
      <PageHeader title="Classement XP" description="Les classements hebdomadaire et mensuel des pilotes, au même endroit." />
      <LeaderboardBoard userId={user.id} weekly={toBoard(weekly)} monthly={toBoard(monthly)} />
    </section>
  );
}

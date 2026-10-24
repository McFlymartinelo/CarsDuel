import { requireUser } from "@/lib/auth";
import { DailyPull } from "@/components/DailyPull";
import { WelcomeDraw } from "@/components/WelcomeDraw";
import { Inventory } from "@/components/garage/Inventory";
import { parisToday, parisWeekStart } from "@/lib/format";
import { toDrawn } from "@/lib/reveal";
import { loadGaragePage } from "@/lib/queries";
import type { UserCard } from "@/lib/types";
import { claimDailyPull, claimWeeklyPull } from "./actions";

export const metadata = { title: "Garage — CarsDuel" };

const ORDER = { moteur: 0, boite: 1, bonus: 2, pneus: 3 } as const;

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; bienvenue?: string }>;
}) {
  const { tab = "moteurs", bienvenue } = await searchParams;
  const { user } = await requireUser();
  const { cards, modifiers } = await loadGaragePage(user.id);
  const dailyClaimed = user.last_daily_pull === parisToday();
  const weeklyClaimed = user.last_weekly_pull === parisWeekStart();
  const owned = cards.filter((c) => !c.is_destroyed);

  const welcome =
    bienvenue === "1"
      ? (cards as (UserCard & { source?: string })[])
          .filter((c) => c.source === "starter" && !c.is_destroyed)
          .sort((a, b) => ORDER[a.card_templates.category] - ORDER[b.card_templates.category])
          .map((c) => toDrawn(c.id, c.card_templates))
      : [];

  const href = (over: Record<string, string>) => `/garage?${new URLSearchParams({ tab, ...over }).toString()}`;

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold uppercase">Garage</h1>
        <p className="text-zinc-400">Votre inventaire. La configuration de course se règle dans Duel.</p>
      </div>

      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Inventory cards={owned} tab={tab} hrefForTab={(t) => href({ tab: t })} tirePerfs={modifiers} />
        <DailyPull dailyClaimed={dailyClaimed} weeklyClaimed={weeklyClaimed} dailyAction={claimDailyPull} weeklyAction={claimWeeklyPull} />
      </div>

      {welcome.length > 0 && <WelcomeDraw cards={welcome} />}
    </>
  );
}

import { requireUser } from "@/lib/auth";
import { parisToday, parisWeekStart } from "@/lib/format";
import { getNotifications, touchQuest } from "@/lib/queries";
import { settleLeaderboardRewards } from "@/lib/rewards";
import { Nav } from "@/components/Nav";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  await settleLeaderboardRewards();
  // Les notifications ne doivent jamais empêcher d'afficher une page (ex. migration pas encore appliquée).
  await touchQuest(user.id, "connect").catch((e) => console.error("quêtes indisponibles :", e));
  const notifications = await getNotifications(user.id).catch((e) => {
    console.error("notifications indisponibles :", e);
    return { unread: 0, items: [] };
  });

  return (
    <>
      <Nav
        username={user.username}
        coins={user.coins}
        xpWeek={Number(user.xp_week)}
        xpMonth={Number(user.xp_month)}
        pullsAvailable={user.last_daily_pull !== parisToday() || user.last_weekly_pull !== parisWeekStart()}
        notifications={notifications}
        signOut={signOut}
      />
      <main className="mx-auto max-w-[1800px] space-y-6 px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 md:space-y-8 md:px-6 md:pb-8 md:pt-6 2xl:px-10">{children}</main>
    </>
  );
}

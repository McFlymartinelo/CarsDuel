import { requireUser } from "@/lib/auth";
import { parisToday, parisWeekStart } from "@/lib/format";
import { getNotifications, touchQuest } from "@/lib/queries";
import { settleLeaderboardRewards } from "@/lib/rewards";
import { startPushWorker } from "@/lib/push-worker";
import { APP_WIDTH } from "@/lib/layout";
import { Nav } from "@/components/Nav";
import { PushSync } from "@/components/PushSync";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  // Démarre le drain de l'outbox push au premier rendu authentifié (une seule
  // fois par processus). Sans clés VAPID ou avec PUSH_WORKER=0 : no-op.
  startPushWorker();

  const { user } = await requireUser();
  // Ces deux opérations ne dépendent pas l'une de l'autre : on les lance ensemble.
  // La lecture des notifications reste après le règlement des récompenses pour inclure les primes versées.
  await Promise.all([
    settleLeaderboardRewards(),
    // Les notifications ne doivent jamais empêcher d'afficher une page (ex. migration pas encore appliquée).
    touchQuest(user.id, "connect").catch((e) => console.error("quêtes indisponibles :", e)),
  ]);
  const notifications = await getNotifications(user.id).catch((e) => {
    console.error("notifications indisponibles :", e);
    return { unread: 0, items: [] };
  });

  return (
    <>
      <PushSync />
      <Nav
        username={user.username}
        coins={user.coins}
        scrapCubes={user.scrap_cubes}
        xpWeek={Number(user.xp_week)}
        xpMonth={Number(user.xp_month)}
        pullsAvailable={user.last_daily_pull !== parisToday() || user.last_weekly_pull !== parisWeekStart()}
        notifications={notifications}
        signOut={signOut}
      />
      <main
        id="contenu"
        tabIndex={-1}
        className={`${APP_WIDTH} space-y-6 px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 outline-none sm:px-4 md:space-y-8 md:px-6 md:pb-8 md:pt-6 2xl:px-10`}
      >
        {children}
      </main>
    </>
  );
}

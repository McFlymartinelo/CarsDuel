import { requireUser } from "@/lib/auth";
import { levelInfo } from "@/lib/game";
import { parisToday } from "@/lib/format";
import { Nav } from "@/components/Nav";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  const lvl = levelInfo(user.xp_total);

  return (
    <>
      <Nav
        username={user.username}
        coins={user.coins}
        level={lvl.level}
        xpCurrent={lvl.current}
        xpNext={lvl.next}
        dailyAvailable={user.last_daily_pull !== parisToday()}
        signOut={signOut}
      />
      <main className="mx-auto max-w-[1800px] space-y-6 px-3 pb-24 pt-4 sm:px-4 md:space-y-8 md:px-6 md:pb-8 md:pt-6 2xl:px-10">{children}</main>
    </>
  );
}

import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/queries";
import { levelInfo } from "@/lib/game";
import { parisToday } from "@/lib/format";
import { Nav } from "@/components/Nav";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  const profile = await getProfile(user.id);
  const lvl = levelInfo(profile?.xp_total ?? 0);

  return (
    <>
      <Nav
        username={profile?.username ?? "?"}
        coins={profile?.coins ?? 0}
        level={lvl.level}
        xpCurrent={lvl.current}
        xpNext={lvl.next}
        dailyAvailable={profile?.last_daily_pull !== parisToday()}
        signOut={signOut}
      />
      <main className="mx-auto max-w-[1800px] space-y-6 px-3 pb-24 pt-4 sm:px-4 md:space-y-8 md:px-6 md:pb-8 md:pt-6 2xl:px-10">{children}</main>
    </>
  );
}

import "server-only";
import { withAdmin } from "@/lib/db";

// Une clôture de classement n'a pas besoin d'être tentée à chaque navigation.
let settledUntil = 0;

/** Verse les primes des semaines et mois déjà clos. Idempotent, rapide si rien n'est dû. */
export async function settleLeaderboardRewards() {
  if (Date.now() < settledUntil) return;
  await withAdmin((c) => c.query("select public.settle_leaderboard_rewards()"));
  settledUntil = Date.now() + 30_000;
}

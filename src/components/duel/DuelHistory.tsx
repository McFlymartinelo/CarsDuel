import Link from "next/link";
import { Coins, Swords } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Skeleton } from "@/components/ui/Skeleton";
import { DUEL_PAGE_SIZE, loadDuelHistory } from "@/lib/queries";
import { WEATHER_LABEL, formatDateTime } from "@/lib/format";

/**
 * Historique des duels de la page Jouer.
 *
 * Chargé dans son propre Suspense : la config et les modes de jeu s'affichent
 * sans attendre la requête d'historique.
 */
export async function DuelHistory({ userId, page, slot }: { userId: string; page: number; slot: string }) {
  const { history, names } = await loadDuelHistory(userId, page);
  const nextPage = page + 1;
  const pageHref = (n: number) => {
    const q = new URLSearchParams({ slot });
    if (n > 1) q.set("page", String(n));
    return `/duel?${q.toString()}`;
  };

  return (
    <section className="space-y-3">
      <SectionTitle
        icon={Swords}
        title="Historique des duels"
        description="Vos dernières courses, en attaque comme en défense."
        action={
          history.length > 0 ? (
            <span className="rounded-full border border-line-strong bg-panel px-3 py-1 text-xs font-semibold text-zinc-300">
              {history.length} duel{history.length > 1 ? "s" : ""}
            </span>
          ) : undefined
        }
      />

      {history.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="Aucun duel pour l'instant."
          description="Lancez votre première course depuis Ma config."
        />
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {history.map((x) => {
              const attacker = x.attacker_id === userId;
              const won = attacker ? x.result === "attacker_win" : x.result === "defender_win";
              const coins = attacker ? x.attacker_coins : x.defender_coins;
              const xp = attacker ? x.attacker_xp : x.defender_xp;
              return (
                <div
                  key={x.id}
                  className={`rounded-xl border border-line border-l-2 bg-panel p-3 ${won ? "border-l-emerald-400" : "border-l-red-500"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wide ${
                        won ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
                      }`}
                    >
                      {won ? "Victoire" : "Défaite"}
                    </span>
                    <span className="text-[11px] text-zinc-500">{formatDateTime(x.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-200">
                    <span className="text-zinc-500">{attacker ? "Attaque vs" : "Défense vs"}</span>{" "}
                    <span className="font-semibold">{names.get(attacker ? x.defender_id : x.attacker_id) ?? "?"}</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded border border-line-strong/70 px-1.5 py-0.5 text-zinc-400">{WEATHER_LABEL[x.weather]}</span>
                    {attacker || x.defender_rewarded ? (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Coins size={12} aria-hidden />
                        {coins} pièces · {xp} XP
                      </span>
                    ) : (
                      <span className="text-zinc-500">Plafond de défenses atteint</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900/70 font-display text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Rôle</th>
                  <th className="px-3 py-2 font-semibold">Adversaire</th>
                  <th className="px-3 py-2 font-semibold">Météo</th>
                  <th className="px-3 py-2 font-semibold">Résultat</th>
                  <th className="px-3 py-2 font-semibold">Gains</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((x) => {
                  const attacker = x.attacker_id === userId;
                  const won = attacker ? x.result === "attacker_win" : x.result === "defender_win";
                  const coins = attacker ? x.attacker_coins : x.defender_coins;
                  const xp = attacker ? x.attacker_xp : x.defender_xp;
                  return (
                    <tr key={x.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-3 py-2 text-zinc-400">{formatDateTime(x.created_at)}</td>
                      <td className="px-3 py-2 text-zinc-300">{attacker ? "Attaque" : "Défense"}</td>
                      <td className="px-3 py-2 font-medium text-zinc-200">{names.get(attacker ? x.defender_id : x.attacker_id) ?? "?"}</td>
                      <td className="px-3 py-2 text-zinc-400">{WEATHER_LABEL[x.weather]}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                            won ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
                          }`}
                        >
                          {won ? "Victoire" : "Défaite"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {attacker || x.defender_rewarded ? (
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <Coins size={13} aria-hidden />
                            {coins} · {xp} XP
                          </span>
                        ) : (
                          <span className="text-zinc-500">— plafond atteint</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        {page > 1 && (
          <Link href={pageHref(page - 1)} className="rounded-lg border border-line-strong px-3 py-1.5 text-zinc-300 transition-colors hover:border-amber-400/50 hover:text-amber-300">
            ← Page précédente
          </Link>
        )}
        {history.length === DUEL_PAGE_SIZE && nextPage > page && (
          <Link href={pageHref(nextPage)} className="rounded-lg border border-line-strong px-3 py-1.5 text-zinc-300 transition-colors hover:border-amber-400/50 hover:text-amber-300">
            Voir plus →
          </Link>
        )}
      </div>
    </section>
  );
}

export function DuelHistorySkeleton() {
  return (
    <section className="space-y-3" aria-busy="true">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2 md:hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="hidden h-72 rounded-xl md:block" />
    </section>
  );
}

import { Skeleton } from "@/components/ui/Skeleton";

/** Squelette du classement, partagé par `loading.tsx` et le Suspense de la page. */
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <div className="rounded-xl border border-line">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line px-3 py-3 last:border-b-0">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/Skeleton";
import { DuelHistorySkeleton } from "@/components/duel/DuelHistory";

export default function DuelLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-[1fr_1fr_1fr_1.1fr]">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
      <DuelHistorySkeleton />
    </div>
  );
}

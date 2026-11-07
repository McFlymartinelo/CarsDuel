import { Skeleton } from "@/components/ui/Skeleton";

export default function GameLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-56 max-w-full" />
      <Skeleton className="h-36 rounded-xl" />
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <p className="text-sm text-zinc-500">Chargement…</p>
    </div>
  );
}

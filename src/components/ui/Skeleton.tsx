import { cn } from "@/lib/cn";

/** Bloc de chargement neutre, à composer dans les `loading.tsx` et les Suspense. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-lg bg-white/[0.06] motion-reduce:animate-none", className)}
    />
  );
}

/** Quelques lignes de texte factices. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? "h-3 w-2/3" : "h-3 w-full"} />
      ))}
    </div>
  );
}

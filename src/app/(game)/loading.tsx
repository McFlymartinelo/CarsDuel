export default function GameLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded bg-zinc-800" />
      <div className="h-36 animate-pulse rounded-xl border border-zinc-800 bg-[#10131a]" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-[#10131a]" />
        <div className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-[#10131a]" />
        <div className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-[#10131a]" />
      </div>
      <p className="text-sm text-zinc-500">Chargement…</p>
    </div>
  );
}

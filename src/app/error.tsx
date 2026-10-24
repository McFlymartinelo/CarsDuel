"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-sm uppercase tracking-widest text-amber-400">Incident</p>
      <h1 className="font-display text-3xl font-bold uppercase">Une erreur est survenue</h1>
      <p className="text-sm text-zinc-400">Le garage a calé. Réessayez dans un instant.</p>
      {error.digest && <p className="text-xs text-zinc-600">Réf. {error.digest}</p>}
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-amber-500 px-4 py-2 font-display font-bold uppercase text-black hover:bg-amber-400"
      >
        Réessayer
      </button>
    </main>
  );
}

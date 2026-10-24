import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-sm uppercase tracking-widest text-amber-400">404</p>
      <h1 className="font-display text-3xl font-bold uppercase">Page introuvable</h1>
      <p className="text-sm text-zinc-400">Ce circuit n&apos;existe pas.</p>
      <Link href="/garage" className="rounded-lg bg-amber-500 px-4 py-2 font-display font-bold uppercase text-black hover:bg-amber-400">
        Retour au garage
      </Link>
    </main>
  );
}

import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { getCurrentUser } from "@/lib/session";
import { signIn, signUp } from "../actions";

export const metadata = { title: "Connexion — CarsDuel" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/garage");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <h1 className="text-center text-3xl font-bold text-amber-400">CarsDuel</h1>
      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-lg border border-zinc-800 p-5">
          <h2 className="mb-3 font-semibold">Connexion</h2>
          <ActionForm action={signIn} submitLabel="Se connecter" className="flex flex-col gap-3">
            <input name="email" type="email" placeholder="Email" required autoComplete="email" />
            <input name="password" type="password" placeholder="Mot de passe" required autoComplete="current-password" />
          </ActionForm>
        </section>
        <section className="rounded-lg border border-zinc-800 p-5">
          <h2 className="mb-1 font-semibold">Créer un compte</h2>
          <p className="mb-3 text-sm text-zinc-400">
            Le garage démarre vide. Vous tirez ensuite un moteur commun, une boîte commune, 5 cartes bonus, et vous recevez un jeu de chaque pneu.
          </p>
          <ActionForm action={signUp} submitLabel="S'inscrire" variant="ghost" className="flex flex-col gap-3">
            <input name="username" type="text" placeholder="Pseudo" required minLength={3} maxLength={24} />
            <input name="email" type="email" placeholder="Email" required autoComplete="email" />
            <input name="password" type="password" placeholder="Mot de passe (8+)" required minLength={8} autoComplete="new-password" />
          </ActionForm>
        </section>
      </div>
    </main>
  );
}

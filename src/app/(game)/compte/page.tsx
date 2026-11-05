import { requireUser } from "@/lib/auth";
import { AccountForms } from "@/components/AccountForms";
import { PushSettings } from "@/components/PushSettings";
import { deleteAccount, updateEmail, updatePassword, updateUsername } from "./actions";

export const metadata = { title: "Profil — CarsDuel" };

export default async function AccountPage() {
  const { user } = await requireUser();

  return (
    <section className="space-y-4">
      <h1 className="font-display text-3xl font-bold uppercase">Profil</h1>
      <p className="text-sm text-zinc-400">Modifiez le pseudo, l&apos;e-mail et le mot de passe.</p>
      <AccountForms
        username={user.username}
        email={user.email}
        updateUsername={updateUsername}
        updateEmail={updateEmail}
        updatePassword={updatePassword}
        deleteAccount={deleteAccount}
      />
      <h2 className="pt-2 font-display text-3xl font-bold uppercase">Notifications</h2>
      <p className="text-sm text-zinc-400">
        Recevez les alertes du jeu sur l&apos;écran verrouillé, même application fermée.
      </p>
      <PushSettings />
    </section>
  );
}

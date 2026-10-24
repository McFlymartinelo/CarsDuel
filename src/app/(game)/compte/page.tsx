import { requireUser } from "@/lib/auth";
import { AccountForms } from "@/components/AccountForms";
import { updateEmail, updatePassword, updateUsername } from "./actions";

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
      />
    </section>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/lib/types";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

function Status({ state }: { state: ActionState }) {
  if (!state?.message) return null;
  return <p className={`text-sm ${state.ok ? "text-emerald-400" : "text-red-400"}`}>{state.message}</p>;
}

const field = "flex flex-col gap-1 text-sm";
const label = "text-zinc-400";
const save = "min-h-11 rounded-lg bg-amber-500 px-4 font-display text-lg font-bold uppercase text-black hover:bg-amber-400 disabled:opacity-50";

export function AccountForms({
  username,
  email,
  updateUsername,
  updateEmail,
  updatePassword,
}: {
  username: string;
  email: string;
  updateUsername: Action;
  updateEmail: Action;
  updatePassword: Action;
}) {
  const [nameState, nameAction, namePending] = useActionState(updateUsername, null);
  const [mailState, mailAction, mailPending] = useActionState(updateEmail, null);
  const [pwState, pwAction, pwPending] = useActionState(updatePassword, null);
  const [name, setName] = useState(username);
  const [mail, setMail] = useState(email);
  const [currentMailPw, setCurrentMailPw] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [againPw, setAgainPw] = useState("");

  useEffect(() => setName(username), [username]);
  useEffect(() => setMail(email), [email]);
  useEffect(() => {
    if (mailState?.ok) setCurrentMailPw("");
  }, [mailState]);
  useEffect(() => {
    if (pwState?.ok) {
      setCurrentPw("");
      setNextPw("");
      setAgainPw("");
    }
  }, [pwState]);

  return (
    <div className="grid max-w-xl gap-4">
      <form action={nameAction} className="space-y-3 rounded-xl border border-zinc-800 bg-[#10131a] p-4">
        <h2 className="font-display text-xl font-bold uppercase">Pseudo</h2>
        <label className={field}>
          <span className={label}>Pseudo</span>
          <input name="username" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={24} autoComplete="username" />
        </label>
        <button disabled={namePending} className={save}>{namePending ? "…" : "Enregistrer"}</button>
        <Status state={nameState} />
      </form>

      <form action={mailAction} className="space-y-3 rounded-xl border border-zinc-800 bg-[#10131a] p-4">
        <h2 className="font-display text-xl font-bold uppercase">E-mail</h2>
        <label className={field}>
          <span className={label}>E-mail</span>
          <input name="email" type="email" value={mail} onChange={(e) => setMail(e.target.value)} required autoComplete="email" />
        </label>
        <label className={field}>
          <span className={label}>Mot de passe actuel</span>
          <input name="current_password" type="password" value={currentMailPw} onChange={(e) => setCurrentMailPw(e.target.value)} required autoComplete="current-password" />
        </label>
        <button disabled={mailPending} className={save}>{mailPending ? "…" : "Enregistrer"}</button>
        <Status state={mailState} />
      </form>

      <form action={pwAction} className="space-y-3 rounded-xl border border-zinc-800 bg-[#10131a] p-4">
        <h2 className="font-display text-xl font-bold uppercase">Mot de passe</h2>
        <label className={field}>
          <span className={label}>Mot de passe actuel</span>
          <input name="current_password" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required autoComplete="current-password" />
        </label>
        <label className={field}>
          <span className={label}>Nouveau mot de passe</span>
          <input name="password" type="password" value={nextPw} onChange={(e) => setNextPw(e.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        <label className={field}>
          <span className={label}>Confirmer le nouveau mot de passe</span>
          <input name="password_confirm" type="password" value={againPw} onChange={(e) => setAgainPw(e.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        <button disabled={pwPending} className={save}>{pwPending ? "…" : "Enregistrer"}</button>
        <Status state={pwState} />
      </form>
    </div>
  );
}

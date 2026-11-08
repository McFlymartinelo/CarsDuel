"use client";

import { useActionState, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { ActionState } from "@/lib/types";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Les erreurs de saisie restent près du champ ; seuls les succès passent en toast. */
function Status({ state }: { state: ActionState }) {
  if (!state?.message || state.ok) return null;
  return (
    <p role="alert" className="text-sm text-red-400">
      {state.message}
    </p>
  );
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
  deleteAccount,
}: {
  username: string;
  email: string;
  updateUsername: Action;
  updateEmail: Action;
  updatePassword: Action;
  deleteAccount: Action;
}) {
  const [nameState, nameAction, namePending] = useActionState(updateUsername, null);
  const [mailState, mailAction, mailPending] = useActionState(updateEmail, null);
  const [pwState, pwAction, pwPending] = useActionState(updatePassword, null);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteAccount, null);
  const [name, setName] = useState(username);
  const [mail, setMail] = useState(email);
  const [currentMailPw, setCurrentMailPw] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [againPw, setAgainPw] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (nameState?.ok) toast({ tone: "success", title: nameState.message ?? "Pseudo mis à jour.", key: "profile-username" });
  }, [nameState, toast]);
  useEffect(() => {
    if (mailState?.ok) toast({ tone: "success", title: mailState.message ?? "E-mail mis à jour.", key: "profile-email" });
  }, [mailState, toast]);
  useEffect(() => {
    if (pwState?.ok) toast({ tone: "success", title: pwState.message ?? "Mot de passe mis à jour.", key: "profile-password" });
  }, [pwState, toast]);

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
    <>
    <div className="grid max-w-xl gap-4">
      <form action={nameAction} className="space-y-3 rounded-xl border border-line bg-panel p-4">
        <h2 className="font-display text-xl font-bold uppercase">Pseudo</h2>
        <label className={field}>
          <span className={label}>Pseudo</span>
          <input name="username" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={24} autoComplete="username" />
        </label>
        <button disabled={namePending} className={save}>{namePending ? "…" : "Enregistrer"}</button>
        <Status state={nameState} />
      </form>

      <form action={mailAction} className="space-y-3 rounded-xl border border-line bg-panel p-4">
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

      <form action={pwAction} className="space-y-3 rounded-xl border border-line bg-panel p-4">
        <h2 className="font-display text-xl font-bold uppercase">Mot de passe</h2>
        <label className={field}>
          <span className={label}>Mot de passe actuel</span>
          <input name="current_password" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required autoComplete="current-password" />
        </label>
        <label className={field}>
          <span className={label}>Nouveau mot de passe</span>
          <input name="password" type="password" value={nextPw} onChange={(e) => setNextPw(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" />
        </label>
        <label className={field}>
          <span className={label}>Confirmer le nouveau mot de passe</span>
          <input name="password_confirm" type="password" value={againPw} onChange={(e) => setAgainPw(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" />
        </label>
        <button disabled={pwPending} className={save}>{pwPending ? "…" : "Enregistrer"}</button>
        <Status state={pwState} />
      </form>

      <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-950/10 p-4">
        <h2 className="font-display text-xl font-bold uppercase text-red-300">Zone de danger</h2>
        <p className="text-sm text-zinc-400">
          La suppression du compte est définitive : toutes vos cartes, pièces, historiques, annonces et trophées seront
          supprimés.
        </p>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="min-h-11 rounded-lg border border-red-500/50 bg-red-500/10 px-4 font-display text-lg font-bold uppercase text-red-300 transition hover:bg-red-500/20"
        >
          Supprimer mon compte
        </button>
      </div>
    </div>
    {deleteOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#030507]/85 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal
        aria-labelledby="delete-title"
      >
        <form action={deleteAction} className="my-auto w-full max-w-md space-y-4 rounded-2xl border border-red-500/40 bg-panel p-5 shadow-[0_24px_100px_rgba(0,0,0,0.8)] sm:p-6">
          <div className="space-y-1">
            <h3 id="delete-title" className="font-display text-2xl font-bold uppercase text-red-300">Supprimer le compte</h3>
            <p className="text-sm text-zinc-400">
              Cette action est irréversible. Toutes vos cartes, pièces, historiques, annonces et trophées seront
              définitivement supprimés.
            </p>
          </div>
          <label className={field}>
            <span className={label}>Mot de passe actuel</span>
            <input
              name="current_password"
              type="password"
              value={deletePw}
              onChange={(e) => setDeletePw(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <label className={field}>
            <span className={label}>Tapez SUPPRIMER pour confirmer</span>
            <input
              name="confirmation"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              required
              autoComplete="off"
              placeholder="SUPPRIMER"
            />
          </label>
          <Status state={deleteState} />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(false);
                setDeletePw("");
                setDeleteConfirm("");
              }}
              className="min-h-11 rounded-lg border border-zinc-600 font-display font-bold uppercase text-zinc-200 transition hover:bg-zinc-800"
            >
              Annuler
            </button>
            <button
              disabled={deletePending}
              className="min-h-11 rounded-lg bg-red-500 px-4 font-display font-bold uppercase text-white transition hover:bg-red-400 disabled:opacity-50"
            >
              {deletePending ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </form>
      </div>
    )}
    </>
  );
}

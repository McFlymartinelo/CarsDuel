"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { Modal } from "@/components/Modal";
import type { ActionState } from "@/lib/types";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const VARIANTS = {
  none: "",
  primary: "bg-amber-500 text-black hover:bg-amber-400",
  danger: "bg-red-600 text-white hover:bg-red-500",
  ghost: "border border-zinc-600 text-zinc-200 hover:bg-zinc-800",
  outline: "border border-amber-500 text-amber-400 hover:bg-amber-500/10",
  outlineDanger: "border border-red-500/70 text-red-400 hover:bg-red-500/10",
  slotPurple: "border border-purple-500 text-purple-300 hover:bg-purple-500/10 w-full",
} as const;

/** Formulaire générique branché sur une Server Action, avec état d'attente et message de retour. */
export function ActionForm({
  action,
  submitLabel,
  children,
  className = "flex flex-wrap items-end gap-2",
  variant = "primary",
  confirmText,
  onSuccess,
  submitClassName,
}: {
  action: Action;
  submitLabel: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  variant?: keyof typeof VARIANTS;
  /** Classes du bouton de soumission ; remplacent le style par défaut. */
  submitClassName?: string;
  /** Texte de confirmation ; `{champ}` est remplacé par la valeur saisie (une fonction ne peut pas venir d'un Server Component). */
  confirmText?: string;
  onSuccess?: () => void;
}) {
  // Fermeture pilotée depuis la promesse de l'action, pas depuis l'état : après un
  // rafraîchissement RSC, ce formulaire peut être démonté (la carte équipée sort de la
  // liste des alternatives) avant que l'effet sur `state` n'ait pu appeler `onSuccess`.
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.ok) onSuccess?.();
    return result;
  }, null);
  const formRef = useRef<HTMLFormElement>(null);
  const skipConfirm = useRef(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  function accept() {
    skipConfirm.current = true;
    setOpen(false);
    formRef.current?.requestSubmit();
    // requestSubmit() est synchrone : si la validation native échoue, aucun submit
    // n'est déclenché et le flag doit être remis à zéro pour redemander la confirmation.
    skipConfirm.current = false;
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onInvalid={() => {
        skipConfirm.current = false;
      }}
      onSubmit={(e) => {
        if (!confirmText) return;
        if (skipConfirm.current) {
          skipConfirm.current = false;
          return;
        }
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setText(confirmText.replace(/\{(\w+)\}/g, (_, name: string) => String(data.get(name) ?? "")));
        setOpen(true);
      }}
    >
      {children}
      <button
        type="submit"
        disabled={pending}
        className={`${submitClassName ?? "rounded px-3 py-1.5 text-sm font-medium"} disabled:opacity-50 ${VARIANTS[variant]}`}
      >
        {pending ? "…" : submitLabel}
      </button>
      {state?.message && (
        <p className={`w-full text-sm ${state.ok ? "text-emerald-400" : "text-red-400"}`}>{state.message}</p>
      )}
      {open && (
        <Modal labelledBy="confirm-title" onClose={() => setOpen(false)}>
          <h3 id="confirm-title" className="font-display text-2xl font-bold uppercase">Confirmer</h3>
          <p className="mt-3 text-zinc-200">{text}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-lg border border-zinc-600 px-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800">
              Annuler
            </button>
            <button type="button" onClick={accept} className="min-h-12 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-black hover:bg-amber-400">
              Confirmer
            </button>
          </div>
        </Modal>
      )}
    </form>
  );
}

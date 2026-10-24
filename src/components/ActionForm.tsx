"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import type { ActionState } from "@/lib/types";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const VARIANTS = {
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
}: {
  action: Action;
  submitLabel: string;
  children?: React.ReactNode;
  className?: string;
  variant?: keyof typeof VARIANTS;
  confirmText?: string | ((form: HTMLFormElement) => string);
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const skipConfirm = useRef(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  function accept() {
    skipConfirm.current = true;
    setOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (!confirmText) return;
        if (skipConfirm.current) {
          skipConfirm.current = false;
          return;
        }
        e.preventDefault();
        setText(typeof confirmText === "function" ? confirmText(e.currentTarget) : confirmText);
        setOpen(true);
      }}
    >
      {children}
      <button
        type="submit"
        disabled={pending}
        className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${VARIANTS[variant]}`}
      >
        {pending ? "…" : submitLabel}
      </button>
      {state?.message && (
        <p className={`w-full text-sm ${state.ok ? "text-emerald-400" : "text-red-400"}`}>{state.message}</p>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal aria-labelledby="confirm-title">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-[#12151c] p-5 shadow-2xl">
            <h3 id="confirm-title" className="font-display text-2xl font-bold uppercase">Confirmer</h3>
            <p className="mt-3 text-zinc-200">{text}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg border border-zinc-600 px-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800">
                Annuler
              </button>
              <button type="button" onClick={accept} className="min-h-11 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-black hover:bg-amber-400">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

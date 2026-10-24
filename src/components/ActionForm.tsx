"use client";

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
  confirmText?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
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
    </form>
  );
}

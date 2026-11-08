"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Message principal, en une ligne. */
  title: string;
  /** Précision optionnelle sous le titre. */
  message?: string;
  tone?: ToastTone;
  /** Action proposée dans le toast (bouton focusable). */
  action?: ToastAction;
  /** Durée en millisecondes. `0` garde le toast jusqu'à fermeture manuelle. */
  duration?: number;
  /** Identifie l'action : un nouveau toast remplace l'ancien au lieu de s'empiler. */
  key?: string;
}

interface ToastItem extends ToastOptions {
  id: number;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 4500,
  info: 5000,
  warning: 6500,
  error: 8000,
};

const TONE_STYLE: Record<ToastTone, { icon: typeof CheckCircle2; iconClass: string; border: string }> = {
  success: { icon: CheckCircle2, iconClass: "text-emerald-300", border: "border-emerald-500/40" },
  error: { icon: XCircle, iconClass: "text-red-300", border: "border-red-500/45" },
  warning: { icon: AlertTriangle, iconClass: "text-amber-300", border: "border-amber-500/45" },
  info: { icon: Info, iconClass: "text-sky-300", border: "border-sky-500/40" },
};

const MAX_TOASTS = 3;

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration ?? DEFAULT_DURATION[item.tone]);
  const startedAt = useRef(0);
  const { icon: Icon, iconClass, border } = TONE_STYLE[item.tone];
  const alert = item.tone === "error";

  useEffect(() => {
    if (paused || remaining.current <= 0) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, item.id, onDismiss]);

  return (
    <div
      role={alert ? "alert" : "status"}
      aria-live={alert ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={cn(
        "toast-in pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-panel-raised/95 p-3 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9)] backdrop-blur",
        border,
      )}
    >
      <Icon size={19} strokeWidth={2} className={cn("mt-0.5 shrink-0", iconClass)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-zinc-100">{item.title}</p>
        {item.message && <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{item.message}</p>}
        {item.action && (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              onDismiss(item.id);
            }}
            className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-accent/40 bg-accent/10 px-3 text-xs font-semibold text-amber-200 transition hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Fermer la notification"
        className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <X size={16} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}

/** Pile de notifications : au-dessus de la barre mobile, coin bas droit sur ordinateur. */
export function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-[95] flex flex-col gap-2 sm:inset-x-auto sm:bottom-[calc(6rem+env(safe-area-inset-bottom))] sm:right-4 sm:w-[22rem] md:bottom-6 md:right-6"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/**
 * Fournit le système de toasts à toute l'application (y compris les écrans
 * d'authentification). Le viewport ne recouvre jamais le bouton central
 * « Jouer » de la barre mobile.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const item: ToastItem = {
      ...options,
      id: nextId.current++,
      tone: options.tone ?? "success",
    };
    setItems((current) => {
      const withoutSameAction = options.key ? current.filter((existing) => existing.key !== options.key) : current;
      return [...withoutSameAction, item].slice(-MAX_TOASTS);
    });
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast doit être utilisé dans un ToastProvider.");
  return context;
}

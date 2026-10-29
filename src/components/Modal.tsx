"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])';

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getAttribute("aria-hidden") !== "true" && el.getClientRects().length > 0,
  );
}

/** Popup au-dessus de la barre d'onglets mobile. Portail sur body : un ancêtre en overflow ne la coupe plus. */
export function Modal({
  labelledBy,
  children,
  wide = false,
  size,
  onClose,
}: {
  labelledBy: string;
  children: React.ReactNode;
  wide?: boolean;
  size?: "md" | "lg" | "xl";
  /** Fermeture au clavier (Échap). Omis quand la fermeture doit être bloquée (action en cours). */
  onClose?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    previousFocus.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      previousFocus.current?.focus?.();
    };
  }, []);

  // Focus initial : champ marqué autoFocus s'il existe, sinon premier élément focusable.
  useEffect(() => {
    if (!mounted) return;
    const panel = panelRef.current;
    if (!panel) return;
    const target = panel.querySelector<HTMLElement>("[autofocus]") ?? focusableElements(panel)[0] ?? panel;
    target.focus();
  }, [mounted]);

  useEffect(() => {
    if (!onClose) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function trapTab(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;

    const items = focusableElements(panel);
    if (items.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === first || !panel.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !panel.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal
      aria-labelledby={labelledBy}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={`max-h-[min(88dvh,52rem)] w-full overflow-y-auto overscroll-contain rounded-2xl border border-zinc-700 bg-[#12151c] p-5 shadow-2xl ${size === "xl" ? "max-w-6xl" : size === "lg" || wide ? "max-w-3xl" : "max-w-md"}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

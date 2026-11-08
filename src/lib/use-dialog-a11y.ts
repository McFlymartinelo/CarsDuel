"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])';

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.getAttribute("aria-hidden") !== "true" && element.getClientRects().length > 0,
  );
}

/**
 * Comportement commun aux popups maison : focus initial, piège de tabulation,
 * fermeture avec Échap, focus rendu au déclencheur et verrouillage du scroll.
 * `Modal` applique déjà ces règles ; ce hook sert aux surcouches spécifiques
 * (tirage de cartes, feuilles de filtres, dialogues de confirmation).
 */
export function useDialogA11y<T extends HTMLElement>({
  open,
  onClose,
  lockScroll = true,
  restoreFocus = true,
}: {
  open: boolean;
  onClose?: () => void;
  lockScroll?: boolean;
  restoreFocus?: boolean;
}) {
  const panelRef = useRef<T>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  // Ref-callback plutôt que l'objet ref : le composant ne lit jamais `.current` au rendu.
  const setPanel = useCallback((node: T | null) => {
    panelRef.current = node;
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLElement>("[autofocus]") ?? (panel ? focusableElements(panel)[0] : null) ?? panel;
    target?.focus();

    return () => {
      if (lockScroll) document.body.style.overflow = previousOverflow;
      if (restoreFocus) previousFocus.current?.focus?.();
    };
  }, [open, lockScroll, restoreFocus]);

  useEffect(() => {
    if (!open || !onClose) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const onKeyDown = useCallback((event: KeyboardEvent<T>) => {
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
  }, []);

  return { setPanel, onKeyDown };
}

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** Nombre de défis visibles avant défilement (grand écran). */
const VISIBLE_CHALLENGES = 3;

/**
 * Fenêtre de défilement verrouillée sur 3 défis : la hauteur est mesurée sur les
 * cartes réelles pour afficher exactement trois défis entiers, sans couper le
 * quatrième. Sur téléphone, la liste garde sa hauteur naturelle.
 */
export function ChallengeScrollList({ open, children }: { open: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>();

  const measure = useCallback(() => {
    const list = ref.current;
    if (!list || !window.matchMedia("(min-width: 640px)").matches || list.getClientRects().length === 0) {
      setMaxHeight(undefined);
      return;
    }
    const items = Array.from(list.children) as HTMLElement[];
    const next = items[VISIBLE_CHALLENGES];
    if (!next) {
      setMaxHeight(undefined);
      return;
    }
    const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
    const span = next.offsetTop - items[0].offsetTop - gap;
    setMaxHeight(span > 0 ? span : undefined);
  }, []);

  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    Array.from(list.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [measure]);

  return <div
    ref={ref}
    style={{ maxHeight }}
    className={`collector-scroll mt-4 flex-col gap-2 sm:grid sm:overflow-y-auto sm:overscroll-contain sm:pr-1 ${open ? "flex" : "hidden"}`}
  >{children}</div>;
}

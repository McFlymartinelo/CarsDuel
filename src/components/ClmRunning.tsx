"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatLapTime } from "@/lib/clm";

/** Durée minimale de la course à l'écran avant de passer aux résultats. */
export const CLM_RACE_MIN_MS = 2800;
/** Accéléré du chrono pendant la course (le temps affiché avance plus vite que le temps réel). */
const RACE_RATE = 24;
/** Le chrono se cale sur le temps réel du tour en douceur, sans saut. */
const FINISH_MS = 900;
/** Petit temps d'arrêt sur le chrono figé avant de passer aux résultats. */
const HOLD_MS = 550;
/** Course à l'écran : la voiture boucle son unique tour pile quand le chrono se fige. */
const LAP_MS = CLM_RACE_MIN_MS + FINISH_MS;

/**
 * Tracé du circuit (ovale, départ sur la ligne basse, sens horaire).
 * Le point de départ est posé sur la ligne de départ/arrivée.
 */
const TRACK = "M 158 108 H 200 A 33 33 0 0 0 200 42 H 120 A 33 33 0 0 0 120 108 H 158 Z";

/** Place la voiture sur le circuit, orientée dans le sens de la course. */
function placeCar(path: SVGPathElement, car: SVGGElement, progress: number) {
  const total = path.getTotalLength();
  const at = Math.min(total, Math.max(0, progress * total));
  const point = path.getPointAtLength(at);
  const ahead = path.getPointAtLength(Math.min(total, at + 0.6));
  const behind = path.getPointAtLength(Math.max(0, at - 0.6));
  const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
  car.setAttribute("transform", `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${angle.toFixed(2)})`);
}

/**
 * Course en cours : le circuit s'anime, la voiture fait un seul tour et le chrono
 * défile en accéléré. Dès que `targetSeconds` est connu (réponse du serveur), le
 * chrono termine sa course sur le temps réel, se fige, puis `onFinish` est appelé.
 */
export function ClmRunning({
  circuitName,
  targetSeconds = null,
  onFinish,
}: {
  circuitName?: string;
  /** Chrono réel du tour, null tant que le serveur n'a pas répondu. */
  targetSeconds?: number | null;
  onFinish?: () => void;
}) {
  const [locked, setLocked] = useState(false);
  const [reduced, setReduced] = useState(false);
  const chronoRef = useRef<HTMLParagraphElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const carRef = useRef<SVGGElement>(null);
  const valueRef = useRef(0);
  const startedRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  const finishCb = useRef(onFinish);
  finishCb.current = onFinish;

  // Le chrono est repeint directement dans le DOM : pas de rendu React à 60 fps.
  const paint = useCallback((next: number) => {
    valueRef.current = next;
    if (chronoRef.current) chronoRef.current.textContent = formatLapTime(next);
  }, []);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Voiture : un seul tour, qui s'achève au moment où le chrono se fige.
  useEffect(() => {
    const path = pathRef.current;
    const car = carRef.current;
    if (!path || !car) return;
    if (reduced) {
      placeCar(path, car, 0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - t0) / LAP_MS);
      placeCar(path, car, progress);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // Chrono : accéléré tant que le temps réel du tour n'est pas connu.
  useEffect(() => {
    if (startedRef.current == null) startedRef.current = performance.now();
    if (targetSeconds != null) return;
    const startedAt = startedRef.current;
    const rate = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : RACE_RATE;
    let raf = 0;
    const tick = (now: number) => {
      paint(((now - startedAt) / 1000) * rate);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetSeconds, paint]);

  // Arrivée : calage sur le temps réel, verrouillage du chrono, puis résultats.
  useEffect(() => {
    if (targetSeconds == null || settledRef.current) return;
    let raf = 0;
    let hold: number | undefined;

    const settle = () => {
      if (settledRef.current) return;
      settledRef.current = true;
      paint(targetSeconds);
      setLocked(true);
      hold = window.setTimeout(() => finishCb.current?.(), HOLD_MS);
    };

    if (reduced) {
      settle();
      return () => {
        window.clearTimeout(hold);
      };
    }

    const from = valueRef.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - t0) / FINISH_MS);
      const eased = 1 - (1 - progress) ** 3;
      paint(from + (targetSeconds - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
      else settle();
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hold);
    };
  }, [targetSeconds, reduced, paint]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/10 to-transparent px-4 py-3.5 text-center">
        <p className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-400">
          <span aria-hidden className="clm-live-dot inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
          En direct
        </p>
        <p
          ref={chronoRef}
          role="timer"
          className={`mt-1.5 font-display text-5xl font-bold leading-none tabular-nums sm:text-6xl ${
            locked ? "clm-chrono-locked text-amber-300" : "text-amber-400/90"
          }`}
        >
          {formatLapTime(0)}
        </p>
      </div>

      <svg viewBox="68 24 184 103" className="mx-auto block h-auto w-full max-w-sm" aria-hidden>
        <defs>
          <linearGradient id="clm-trail" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fbbf24" stopOpacity="0" />
            <stop offset="1" stopColor="#fbbf24" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Vibreurs des deux virages */}
        <g fill="none" strokeWidth="4">
          <path d="M 200 31 A 44 44 0 0 1 200 119" stroke="#e4e4e7" />
          <path d="M 120 119 A 44 44 0 0 1 120 31" stroke="#e4e4e7" />
          <path d="M 200 31 A 44 44 0 0 1 200 119" stroke="#dc2626" strokeDasharray="5 5" />
          <path d="M 120 119 A 44 44 0 0 1 120 31" stroke="#dc2626" strokeDasharray="5 5" />
        </g>

        {/* Asphalte */}
        <path d={TRACK} fill="none" stroke="#3f3f46" strokeWidth="23" strokeLinejoin="round" />
        <path ref={pathRef} d={TRACK} fill="none" stroke="#16181d" strokeWidth="21" strokeLinejoin="round" />

        {/* Ligne de départ / arrivée en damier */}
        {Array.from({ length: 4 }).map((_, row) =>
          [0, 1].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={155 + col * 4.5}
              y={99 + row * 4.5}
              width={4.5}
              height={4.5}
              fill={(row + col) % 2 === 0 ? "#fafafa" : "#0b0b0b"}
            />
          )),
        )}

        {/* Voiture */}
        <g ref={carRef}>
          <ellipse cx="0" cy="4.6" rx="10" ry="2.6" fill="#000" opacity="0.4" />
          <rect x="-25" y="-1.6" width="16" height="3.2" rx="1.6" fill="url(#clm-trail)" />
          <rect x="-10" y="-4.6" width="20" height="9.2" rx="4" fill="#fcd34d" stroke="#a16207" strokeWidth="0.6" />
          <rect x="-4.6" y="-3.4" width="9.6" height="6.8" rx="2.2" fill="#1c1917" opacity="0.9" />
          <rect x="3.4" y="-3.2" width="1.7" height="6.4" rx="0.8" fill="#38bdf8" opacity="0.45" />
          <rect x="-8.4" y="-3.2" width="1.4" height="6.4" rx="0.7" fill="#38bdf8" opacity="0.3" />
          <rect x="4.8" y="-5.4" width="3.6" height="1.8" rx="0.7" fill="#0c0a09" />
          <rect x="4.8" y="3.6" width="3.6" height="1.8" rx="0.7" fill="#0c0a09" />
          <rect x="-7.6" y="-5.2" width="3.6" height="1.8" rx="0.7" fill="#0c0a09" />
          <rect x="-7.6" y="3.4" width="3.6" height="1.8" rx="0.7" fill="#0c0a09" />
          <rect x="9" y="-3.5" width="1.3" height="2.2" rx="0.6" fill="#fffbeb" />
          <rect x="9" y="1.3" width="1.3" height="2.2" rx="0.6" fill="#fffbeb" />
          <rect x="-10.5" y="-3.5" width="1.1" height="2.2" rx="0.5" fill="#ef4444" />
          <rect x="-10.5" y="1.3" width="1.1" height="2.2" rx="0.5" fill="#ef4444" />
        </g>
      </svg>

      <p className="text-center text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        {circuitName ? `Circuit · ${circuitName}` : "Circuit du jour"}
      </p>
    </div>
  );
}

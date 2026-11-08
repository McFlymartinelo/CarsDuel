"use client";

/**
 * Briques communes aux mini-jeux de l'atelier : cadre, plateau, boutons,
 * hooks de cycle de vie (victoire unique, horloge, animation) et contrôles
 * partagés (rotation, sonde). Aucun jeu n'est défini ici.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export type Tone = "idle" | "ok" | "bad";

export type GameProps = {
  name: string;
  onWin: () => void;
  onMiss: () => void;
};

export const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
export const norm360 = (angle: number) => ((angle % 360) + 360) % 360;
export const angleDelta = (a: number, b: number) => {
  let delta = a - b;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
};

/** Empêche un mini-jeu de valider deux fois l'étape (interval + event). */
export function useWinOnce(onWin: () => void) {
  const done = useRef(false);
  return useCallback(() => {
    if (done.current) return;
    done.current = true;
    onWin();
  }, [onWin]);
}

/** Compteur incrémenté à intervalle régulier, nettoyé au démontage ou à la désactivation. */
export function useClock(intervalMs: number, active = true) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, active]);
  return tick;
}

/** Temps écoulé (ms) mis à jour à chaque image, nettoyé au démontage ou à la désactivation. */
export function useAnimationTime(active = true) {
  const [time, setTime] = useState(0);
  const elapsed = useRef(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now() - elapsed.current;
    let frame = 0;
    const tick = (now: number) => {
      elapsed.current = now - start;
      setTime(elapsed.current);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active]);
  return time;
}

/** setTimeout dont tous les minuteurs en attente sont annulés au démontage. */
export function useTimeouts() {
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);
  return useCallback((callback: () => void, delay: number) => {
    timers.current.push(window.setTimeout(callback, delay));
  }, []);
}

export function GameFrame({
  name,
  badge,
  message,
  tone = "idle",
  footer,
  children,
}: {
  name: string;
  badge?: ReactNode;
  message: ReactNode;
  tone?: Tone;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const toneClass = tone === "ok" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-amber-200";
  return (
    <div className="mt-5 rounded-xl border border-line bg-black/25 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        <span>Atelier · {name}</span>
        {badge != null && (
          <span className="rounded-full border border-line bg-black/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-300">
            {badge}
          </span>
        )}
      </div>
      {children}
      <div aria-live="polite" className={`mt-3 min-h-5 text-center text-sm ${toneClass}`}>
        {message}
      </div>
      {footer}
    </div>
  );
}

export function GameBoard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative mx-auto w-full max-w-md overflow-hidden rounded-xl border border-zinc-700 bg-gradient-to-br from-zinc-800 to-zinc-950 ${className}`}
    >
      {children}
    </div>
  );
}

/** Illustration de pièce réutilisée depuis les cartes du jeu, fondue dans le plateau. */
export function PartArt({
  src,
  opacity = 0.22,
  className = "object-contain",
}: {
  src: string;
  opacity?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- visuel décoratif déjà optimisé en WebP
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={`pointer-events-none absolute inset-0 z-0 h-full w-full mix-blend-screen ${className}`}
      style={{ opacity }}
    />
  );
}

export function ActionButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`mx-auto mt-4 flex min-h-14 w-full max-w-sm touch-none select-none items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 font-display text-lg font-bold uppercase tracking-wider text-amber-200 transition hover:bg-amber-500/20 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function SmallButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-11 rounded-lg border border-line bg-black/30 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/** Chemin SVG d'un pignon centré sur l'origine. */
export function gearPath(teeth: number, outer: number, inner: number) {
  const step = (Math.PI * 2) / teeth;
  const point = (radius: number, angle: number) =>
    `${(Math.cos(angle) * radius).toFixed(2)} ${(Math.sin(angle) * radius).toFixed(2)}`;
  const parts: string[] = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    parts.push(
      `${i === 0 ? "M" : "L"}${point(inner, a)}`,
      `L${point(outer, a + step * 0.15)}`,
      `L${point(outer, a + step * 0.45)}`,
      `L${point(inner, a + step * 0.6)}`,
    );
  }
  return `${parts.join(" ")} Z`;
}

export function GearSvg({
  cx,
  cy,
  teeth,
  outer,
  rotate = 0,
  fill = "#0e1015",
  stroke = "#fbbf24",
  mark,
}: {
  cx: number;
  cy: number;
  teeth: number;
  outer: number;
  rotate?: number;
  fill?: string;
  stroke?: string;
  mark?: string;
}) {
  const inner = outer * 0.82;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotate})`}>
      <path d={gearPath(teeth, outer, inner)} fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      <circle r={inner * 0.45} fill="#1f2127" stroke={stroke} strokeWidth="1.4" />
      <circle r={inner * 0.12} fill="#0a0b0f" />
      {mark && <path d={`M0 ${-inner * 0.5} L0 ${-inner * 0.92}`} stroke={mark} strokeWidth="3" strokeLinecap="round" />}
    </g>
  );
}

/**
 * Commande rotative : glisser autour du centre, ou flèches du clavier lorsqu'elle a le focus.
 * `onChange` reçoit le nouvel angle en degrés (non normalisé).
 */
export function Rotary({
  angle,
  onChange,
  label,
  step = 10,
  disabled = false,
  className = "",
  children,
}: {
  angle: number;
  onChange: (angle: number) => void;
  label: string;
  step?: number;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const drag = useRef<{ pointer: number; base: number } | null>(null);
  const pointerAngle = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return (
      (Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180) /
      Math.PI
    );
  };
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: pointerAngle(event), base: angle };
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    onChange(start.base + angleDelta(pointerAngle(event), start.pointer));
  };
  const stop = () => {
    drag.current = null;
  };
  const key = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const amount = event.shiftKey ? step * 3 : step;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") onChange(angle - amount);
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") onChange(angle + amount);
    else return;
    event.preventDefault();
  };
  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={Math.round(norm360(angle))}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={key}
      className={`touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        disabled ? "opacity-60" : "cursor-grab"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export type Point = { x: number; y: number };

/**
 * Plateau à sonde : toucher ou glisser déplace la sonde, flèches du clavier (Maj = grand pas),
 * Entrée ou Espace déclenchent `onAct`. Les coordonnées sont des pourcentages du plateau.
 */
export function ProbeBoard({
  pos,
  onMove,
  onAct,
  label,
  step = 2.5,
  className = "",
  children,
}: {
  pos: Point;
  onMove: (pos: Point) => void;
  onAct?: (pos: Point) => void;
  label: string;
  step?: number;
  className?: string;
  children: ReactNode;
}) {
  const dragging = useRef(false);
  const point = (event: ReactPointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100),
    };
  };
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    onMove(point(event));
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current) onMove(point(event));
  };
  const stop = () => {
    dragging.current = false;
  };
  const key = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const amount = event.shiftKey ? step * 3 : step;
    if (event.key === "ArrowLeft") onMove({ ...pos, x: clamp(pos.x - amount) });
    else if (event.key === "ArrowRight") onMove({ ...pos, x: clamp(pos.x + amount) });
    else if (event.key === "ArrowUp") onMove({ ...pos, y: clamp(pos.y - amount) });
    else if (event.key === "ArrowDown") onMove({ ...pos, y: clamp(pos.y + amount) });
    else if ((event.key === "Enter" || event.key === " ") && onAct) onAct(pos);
    else return;
    event.preventDefault();
  };
  return (
    <div
      role="application"
      tabIndex={0}
      aria-label={label}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={key}
      className={`relative touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${className}`}
    >
      {children}
    </div>
  );
}

/** Rotation circulaire d'une liste (ordre varié sans Math.random pendant le rendu). */
export function rotateList<T>(list: T[], offset: number) {
  const shift = ((offset % list.length) + list.length) % list.length;
  return [...list.slice(shift), ...list.slice(0, shift)];
}

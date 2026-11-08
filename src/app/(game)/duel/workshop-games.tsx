"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import { RotateCcw, RotateCw, X } from "lucide-react";
import {
  ActionButton,
  GameBoard,
  GameFrame,
  PartArt,
  SmallButton,
  angleDelta,
  clamp,
  gearPath,
  norm360,
  useWinOnce,
  type GameProps,
  type Tone,
} from "./workshop-kit";
import { TireFace, TirePhoto } from "./workshop-tire-art";
import { ENGINE_GAMES } from "./workshop-engine-games";
import { GEARBOX_GAMES } from "./workshop-gearbox-games";
import { TIRE_GAMES } from "./workshop-tire-games";

export type WorkshopKind = "moteur" | "boite" | "pneus";
const shuffle = <T,>(values: T[]) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};


/* ------------------------------------------------------------------ */
/* 1 · Moteur — Bain de dégraissage (frotter)                          */
/* ------------------------------------------------------------------ */

type Spot = { x: number; y: number; r: number };

const ENGINE_SPOTS: Spot[] = [
  { x: 33, y: 43, r: 4.5 },
  { x: 45, y: 58, r: 5 },
  { x: 62, y: 40, r: 4.5 },
  { x: 57, y: 67, r: 4 },
  { x: 41, y: 70, r: 4.5 },
];

const TIRE_SPOTS: Spot[] = [
  { x: 60.1, y: 12.3, r: 4.2 },
  { x: 83.8, y: 30.5, r: 4.2 },
  { x: 87.7, y: 60.1, r: 4.2 },
  { x: 69.5, y: 83.8, r: 4.2 },
  { x: 39.9, y: 87.7, r: 4.2 },
  { x: 16.2, y: 69.5, r: 4.2 },
  { x: 12.3, y: 39.9, r: 4.2 },
  { x: 30.5, y: 16.2, r: 4.2 },
];

function ScrubGame({
  name,
  image,
  art,
  square = false,
  spots,
  unit,
  onWin,
}: GameProps & { image?: string; art?: ReactNode; square?: boolean; spots: Spot[]; unit: string }) {
  const [grime, setGrime] = useState<number[]>(() => spots.map(() => 100));
  const [message, setMessage] = useState("Glissez le doigt sur chaque tache pour nettoyer la pièce.");
  const [tone, setTone] = useState<Tone>("idle");
  const pressed = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const grimeRef = useRef(grime);
  const win = useWinOnce(onWin);

  useEffect(() => {
    grimeRef.current = grime;
  }, [grime]);

  useEffect(() => {
    if (grime.every((value) => value <= 0)) win();
  }, [grime, win]);

  const point = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };

  const reduce = (x: number, y: number, amount: number) => {
    setGrime((previous) => {
      let touched = false;
      const next = previous.map((value, i) => {
        if (value <= 0) return value;
        const spot = spots[i];
        if (Math.hypot(x - spot.x, y - spot.y) > spot.r) return value;
        touched = true;
        return Math.max(0, value - amount);
      });
      return touched ? next : previous;
    });
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    pressed.current = true;
    last.current = point(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    reduce(last.current.x, last.current.y, 14);
    setTone("idle");
    setMessage("Continuez à frotter, la crasse s'en va.");
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pressed.current) return;
    const next = point(event);
    if (last.current) {
      const distance = Math.hypot(next.x - last.current.x, next.y - last.current.y);
      if (distance > 0.4) reduce(next.x, next.y, Math.min(26, 7 + distance * 2.5));
    }
    last.current = next;
  };

  const stop = () => {
    pressed.current = false;
    last.current = null;
  };

  const scrubNext = () => {
    const index = grimeRef.current.findIndex((value) => value > 0);
    if (index < 0) return;
    const spot = spots[index];
    reduce(spot.x, spot.y, 60);
  };

  const remaining = grime.filter((value) => value > 0).length;
  const clean = Math.round(100 - grime.reduce((total, value) => total + value, 0) / spots.length);

  return (
    <GameFrame
      name={name}
      badge={`${spots.length - remaining} / ${spots.length}`}
      message={remaining === 0 ? "Pièce propre !" : message}
      tone={remaining === 0 ? "ok" : tone}
      footer={
        <button
          type="button"
          onClick={scrubNext}
          disabled={remaining === 0}
          className="mx-auto mt-3 block text-xs text-zinc-500 underline transition hover:text-zinc-300 disabled:opacity-40"
        >
          Frotter {unit === "tache" ? "la tache suivante" : "le résidu suivant"} (clavier)
        </button>
      }
    >
      <GameBoard>
        <div
          className={`relative mx-auto w-full touch-none select-none ${square ? "aspect-square max-w-[420px]" : "aspect-[3/2] max-w-[440px]"}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
          onPointerLeave={stop}
        >
          {art}
          {!image && !art && (
            <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="aspect-square h-[82%] rounded-full border-2 border-zinc-700/70 bg-[radial-gradient(circle_at_50%_45%,rgba(63,63,70,.35),rgba(9,9,11,.85))] shadow-[inset_0_0_40px_rgba(0,0,0,.85)]" />
            </div>
          )}
          {image && (
            <Image
              src={image}
              alt=""
              fill
              sizes="(min-width: 640px) 440px, 90vw"
              draggable={false}
              className="pointer-events-none object-contain"
            />
          )}
          {spots.map((spot, index) => {
            const value = grime[index];
            return (
              <span
                key={index}
                aria-hidden
                className={`absolute rounded-full border ${
                  value > 0 ? "border-amber-950/60" : "border-dashed border-emerald-400/50"
                }`}
                style={{
                  left: `${spot.x}%`,
                  top: `${spot.y}%`,
                  width: `${spot.r * 2}%`,
                  aspectRatio: "1 / 1",
                  transform: "translate(-50%, -50%)",
                  background:
                    value > 0
                      ? "radial-gradient(circle at 34% 30%, rgba(140,90,30,.95), transparent 45%), radial-gradient(circle at 60% 62%, #6b4a1e, #2a1c0b 72%)"
                      : "transparent",
                  opacity: value > 0 ? 0.95 : 0.5,
                  boxShadow:
                    value > 0 ? "0 0 0 3px rgba(61,43,18,.55), 0 0 14px rgba(180,120,40,.3)" : "none",
                }}
              />
            );
          })}
          <span className="absolute left-3 top-3 rounded-lg border border-amber-500/30 bg-black/70 px-2 py-1 font-display text-base font-bold text-amber-300">
            {clean}%
            <small className="ml-1 text-[9px] uppercase tracking-wide text-zinc-400">propreté</small>
          </span>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 2 · Moteur — Rodage des soupapes (chronométrer)                     */
/* ------------------------------------------------------------------ */

function TimingGame({
  name,
  target,
  onWin,
  onMiss,
}: GameProps & { target: number }) {
  const [targetZone] = useState<[number, number]>(() => {
    const start = 25 + Math.floor(Math.random() * 40);
    return [start, start + 15];
  });
  const [position, setPosition] = useState(8);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Tapotez quand l'aiguille est dans la zone verte.");
  const [tone, setTone] = useState<Tone>("idle");
  const positionRef = useRef(8);
  const direction = useRef(1);
  const win = useWinOnce(onWin);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(40, now - previous);
      previous = now;
      let next = positionRef.current + direction.current * delta * 0.06;
      if (next >= 100) {
        next = 100;
        direction.current = -1;
      }
      if (next <= 0) {
        next = 0;
        direction.current = 1;
      }
      positionRef.current = next;
      setPosition(next);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const tap = () => {
    const inside = positionRef.current >= targetZone[0] && positionRef.current <= targetZone[1];
    if (!inside) {
      setProgress(0);
      setTone("bad");
      setMessage("Raté : l'aiguille est sortie de la zone. Reprenez les 3 soupapes.");
      onMiss();
      return;
    }
    const next = progress + 1;
    setProgress(next);
    setTone("ok");
    if (next >= target) {
      setMessage("Rodage terminé : les soupapes ferment proprement.");
      win();
      return;
    }
    setMessage(`Bien ! Encore ${target - next} soupape${target - next > 1 ? "s" : ""}.`);
  };

  return (
    <GameFrame
      name={name}
      badge={`${progress} / ${target}`}
      message={message}
      tone={tone}
      footer={<ActionButton onClick={tap}>Tapoter au bon moment</ActionButton>}
    >
      <GameBoard className="px-4 pb-4 pt-3">
        <PartArt src="/cards/moteur/_4-cylindres.webp" opacity={0.24} />
        <p className="relative z-10 mt-4 text-center text-xs font-semibold text-emerald-200">Zone cible · {targetZone[0]}–{targetZone[1]} % <span className="font-normal text-amber-200">· aiguille jaune</span></p>
        <div className="relative z-10 mt-5 h-28 w-full overflow-hidden rounded-xl border border-line bg-zinc-900">
          <div className="absolute inset-x-4 top-1/2 h-2 -translate-y-1/2 rounded-full bg-zinc-700" />
          <div
            className="absolute inset-y-0 top-1/2 h-4 -translate-y-1/2 rounded bg-emerald-500/50 shadow-[0_0_18px_rgba(16,185,129,.55)]"
            style={{ left: `${targetZone[0]}%`, width: `${targetZone[1] - targetZone[0]}%` }}
          />
          <span
            className="absolute top-1/2 h-16 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_14px_#fbbf24]"
            style={{ left: `${position}%` }}
          />
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
            {Array.from({ length: target }, (_, index) => (
              <span
                key={index}
                className={`h-2 w-7 rounded-full ${
                  index < progress ? "bg-emerald-400" : "bg-zinc-700"
                }`}
              />
            ))}
          </div>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 3 · Moteur — Insertion des segments (glisser)                       */
/* ------------------------------------------------------------------ */

function RingGame({ name, onWin, onMiss }: GameProps) {
  const [placed, setPlaced] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 84 });
  const [message, setMessage] = useState("Glissez le segment du bas jusqu'à la gorge claire.");
  const [tone, setTone] = useState<Tone>("idle");
  const boardRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const win = useWinOnce(onWin);
  const grooves = [32, 48, 64];

  const point = (event: ReactPointerEvent<HTMLDivElement>) => {
    const board = boardRef.current;
    if (!board) return { x: 50, y: 84 };
    const rect = board.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    setDragging(true);
    setPosition(point(event));
    setTone("idle");
    setMessage("Déposez le segment sur la gorge claire.");
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setPosition(point(event));
  };

  const stop = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const groove = grooves[placed];
    const aligned = Math.abs(position.y - groove) <= 7 && position.x >= 28 && position.x <= 72;
    if (aligned) {
      const next = placed + 1;
      setPlaced(next);
      setTone("ok");
      setMessage(`Segment ${next} en place.`);
      if (next >= 3) {
        setMessage("Les trois segments sont insérés.");
        win();
      }
    } else {
      setTone("bad");
      setMessage("Le segment est retombé : visez la gorge claire.");
      onMiss();
    }
    setPosition({ x: 50, y: 84 });
  };

  const placeNext = () => {
    const next = placed + 1;
    setPlaced(next);
    setTone("ok");
    setMessage(`Segment ${next} en place.`);
    if (next >= 3) {
      setMessage("Les trois segments sont insérés.");
      win();
    }
  };

  return (
    <GameFrame
      name={name}
      badge={`${placed} / 3`}
      message={message}
      tone={tone}
      footer={
        <button
          type="button"
          onClick={placeNext}
          disabled={placed >= 3}
          className="mx-auto mt-3 block text-xs text-zinc-500 underline transition hover:text-zinc-300 disabled:opacity-40"
        >
          Placer le segment suivant (clavier)
        </button>
      }
    >
      <GameBoard className="h-72">
        <PartArt src="/cards/moteur/_4-cylindres.webp" opacity={0.2} />
        <div
          ref={boardRef}
          className="relative z-10 h-full w-full touch-none select-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
        >
          <svg viewBox="0 0 320 280" className="absolute inset-0 h-full w-full" aria-hidden>
            <rect x="105" y="42" width="110" height="196" rx="16" fill="#181a20" stroke="#52525b" strokeWidth="2" />
            <rect x="119" y="56" width="82" height="168" rx="10" fill="url(#pistonGrad)" stroke="#3f3f46" />
            <defs>
              <linearGradient id="pistonGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#27272a" />
                <stop offset="45%" stopColor="#71717a" />
                <stop offset="55%" stopColor="#3f3f46" />
                <stop offset="1" stopColor="#18181b" />
              </linearGradient>
            </defs>
            {grooves.map((groove, index) => (
              <g key={groove}>
                <rect
                  x="119"
                  y={(groove / 100) * 280 - 6}
                  width="82"
                  height="12"
                  rx="4"
                  fill={index < placed ? "#fbbf24" : "#0b0d12"}
                  stroke={index === placed ? "#fbbf24" : "#3f3f46"}
                  strokeWidth={index === placed ? 2 : 1}
                />
                {index === placed && (
                  <rect
                    x="113"
                    y={(groove / 100) * 280 - 12}
                    width="94"
                    height="24"
                    rx="8"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                )}
              </g>
            ))}
            <rect x="147" y="238" width="26" height="34" rx="5" fill="#3f3f46" stroke="#52525b" />
          </svg>

          {Array.from({ length: 3 - placed }, (_, index) => (
            <span
              key={index}
              className="absolute rounded-full border-[7px] border-amber-300 bg-transparent shadow-[0_0_14px_rgba(251,191,36,.55)]"
              style={{
                left: `${index === 0 ? position.x : 50}%`,
                top: `${index === 0 ? position.y : 80 + index * 7}%`,
                width: "20%",
                aspectRatio: "1 / 1",
                transform: "translate(-50%, -50%)",
                opacity: index === 0 ? 1 : 0.28,
                pointerEvents: "none",
              }}
            />
          ))}
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-line bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            {dragging ? "Déposez sur la gorge" : "Glissez le segment"}
          </span>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 4 · Moteur — Serrage de culasse (serrer)                            */
/* ------------------------------------------------------------------ */

const BOLTS = [
  { x: 98, y: 78 },
  { x: 222, y: 78 },
  { x: 160, y: 128 },
  { x: 98, y: 178 },
  { x: 222, y: 178 },
];
const BOLT_IDS = [0, 1, 2, 3, 4];

function TorqueGame({ name, onWin, onMiss }: GameProps) {
  const [boltOrder] = useState(() => shuffle(BOLT_IDS));
  const [target] = useState(() => 42 + Math.floor(Math.random() * 22));
  const lowTarget = target - 12;
  const highTarget = target + 12;
  const [step, setStep] = useState(0);
  const [torque, setTorque] = useState(0);
  const [holding, setHolding] = useState(false);
  const [flash, setFlash] = useState(false);
  const [message, setMessage] = useState(`Maintenez jusqu'à la zone verte ${lowTarget}–${highTarget} %, puis relâchez.`);
  const [tone, setTone] = useState<Tone>("idle");
  const torqueRef = useRef(0);
  const holdingRef = useRef(false);
  const busyRef = useRef(false);
  const clickTimer = useRef<number | null>(null);
  const win = useWinOnce(onWin);

  useEffect(() => {
    if (!holding) return;
    const timer = window.setInterval(() => {
      torqueRef.current = Math.min(100, torqueRef.current + 2.4);
      setTorque(torqueRef.current);
    }, 50);
    return () => window.clearInterval(timer);
  }, [holding]);

  useEffect(
    () => () => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
    },
    [],
  );

  const start = () => {
    if (holdingRef.current || busyRef.current || step >= boltOrder.length) return;
    holdingRef.current = true;
    setHolding(true);
    setTone("idle");
    setMessage("Continuez à serrer…");
  };

  const stop = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    const value = torqueRef.current;
    if (value >= lowTarget && value <= highTarget) {
      busyRef.current = true;
      setFlash(true);
      setTone("ok");
      setMessage("Clac ! Le couple est atteint.");
      clickTimer.current = window.setTimeout(() => {
        const next = step + 1;
        clickTimer.current = null;
        setFlash(false);
        busyRef.current = false;
        torqueRef.current = 0;
        setTorque(0);
        setStep(next);
        if (next >= boltOrder.length) {
          setMessage("Culasse serrée au couple.");
          win();
        } else {
          setMessage(`Boulon ${boltOrder[next] + 1} serré. Passez au suivant.`);
        }
      }, 320);
      return;
    }
    torqueRef.current = 0;
    setTorque(0);
    setTone("bad");
    setMessage(value < lowTarget ? "Trop tôt : le couple est insuffisant." : "Trop tard : le couple est dépassé.");
    onMiss();
  };

  const keyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) start();
  };

  const keyUp = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    stop();
  };

  const activeBolt = BOLTS[boltOrder[Math.min(step, boltOrder.length - 1)]];

  return (
    <GameFrame
      name={name}
      badge={`Boulon ${Math.min(step + 1, boltOrder.length)} / ${boltOrder.length}`}
      message={message}
      tone={tone}
      footer={
        <ActionButton
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            start();
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onKeyDown={keyDown}
          onKeyUp={keyUp}
          disabled={flash}
          className={holding ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200" : ""}
        >
          {flash ? "Couple atteint" : holding ? "Relâchez dans la zone verte" : "Maintenir le couple"}
        </ActionButton>
      }
    >
      <GameBoard className="p-3">
        <PartArt src="/cards/moteur/_v8.webp" opacity={0.22} />
        <p className="relative z-10 mb-2 text-center text-xs font-semibold text-emerald-200">Couple cible : {target} % · zone {lowTarget}–{highTarget} %</p>
        <div className="relative z-10 mx-auto max-w-[360px]">
          <svg viewBox="0 0 320 250" className="w-full" aria-hidden>
            <rect x="46" y="34" width="228" height="186" rx="22" fill="#181a20" stroke="#3f3f46" strokeWidth="2" />
            {BOLTS.map((bolt, index) => {
              const orderIndex = boltOrder.indexOf(index);
              const active = orderIndex === step;
              const done = orderIndex < step;
              return (
                <g key={index}>
                  <circle cx={bolt.x} cy={bolt.y} r="24" fill="none" stroke={done ? "#34d399" : "#27272a"} strokeWidth="7" />
                  <circle
                    cx={bolt.x}
                    cy={bolt.y}
                    r={active ? 22 : 18}
                    fill="#1f2127"
                    stroke={done ? "#34d399" : active ? "#fbbf24" : "#52525b"}
                    strokeWidth={active ? 3 : 2}
                    className={active ? "animate-pulse" : ""}
                  />
                  <text
                    x={bolt.x}
                    y={bolt.y + 5}
                    textAnchor="middle"
                    fontFamily="Rajdhani, sans-serif"
                    fontSize="14"
                    fontWeight="700"
                    fill={done ? "#34d399" : active ? "#fbbf24" : "#71717a"}
                  >
                    {orderIndex + 1}
                  </text>
                </g>
              );
            })}

            {/* Clé dynamométrique : elle ratatine sur le boulon actif pendant le serrage. */}
            <g
              transform={`translate(${activeBolt.x} ${activeBolt.y})`}
              style={{ filter: "drop-shadow(0 3px 5px rgba(0,0,0,.65))" }}
            >
              <g>
                {holding && (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="-11 0 0; 15 0 0; 6 0 0; -11 0 0"
                    keyTimes="0;0.35;0.65;1"
                    dur="0.75s"
                    repeatCount="indefinite"
                  />
                )}
                {flash && (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values="0 0 0; -20 0 0; 0 0 0"
                    dur="0.32s"
                    fill="freeze"
                  />
                )}
                <rect x="16" y="-8" width="62" height="16" rx="8" fill="#181a20" stroke="#71717a" strokeWidth="2" />
                <rect x="42" y="-6" width="34" height="12" rx="6" fill="#27272a" stroke="#3f3f46" />
                <circle cx="84" cy="0" r="8" fill="#0a0b0f" stroke="#fbbf24" strokeWidth="1.8" />
                <path d="M84 0 L84 -5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="0" cy="0" r="19" fill="none" stroke="#fbbf24" strokeWidth="4" />
                <circle cx="0" cy="0" r="12" fill="#0f1116" stroke="#71717a" strokeWidth="2" />
                <path d="M-7 -7 L7 -7 M-7 7 L7 7" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" />
              </g>
            </g>

            {flash && (
              <g>
                <circle cx={activeBolt.x} cy={activeBolt.y} r="24" fill="none" stroke="#34d399" strokeWidth="3">
                  <animate attributeName="r" from="20" to="40" dur="0.32s" fill="freeze" />
                  <animate attributeName="opacity" from="1" to="0" dur="0.32s" fill="freeze" />
                </circle>
                <text
                  x={activeBolt.x}
                  y={activeBolt.y - 30}
                  textAnchor="middle"
                  fill="#34d399"
                  fontFamily="Rajdhani, sans-serif"
                  fontSize="13"
                  fontWeight="700"
                >
                  CLAC
                </text>
              </g>
            )}
          </svg>

          <div className="mt-1 grid grid-cols-5 gap-1.5">
            {Array.from({ length: boltOrder.length }, (_, index) => (
              <span
                key={index}
                className={`grid h-7 place-items-center rounded-md border font-display text-xs font-bold ${
                  index < step
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : index === step
                      ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
                      : "border-line bg-black/20 text-zinc-600"
                }`}
              >
                {index + 1}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            <span>Couple</span>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <span className="absolute inset-y-0 bg-emerald-500/40" style={{ left: `${lowTarget}%`, width: `${highTarget - lowTarget}%` }} />
              <span className="absolute inset-y-0 left-0 bg-amber-400" style={{ width: `${torque}%` }} />
            </div>
            <span className="tabular-nums text-amber-300">{Math.round(torque)} N·m</span>
          </div>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

function RevGame({ name, onWin }: GameProps) {
  const [rpm, setRpm] = useState(0);
  const [hold, setHold] = useState(0);
  const [message, setMessage] = useState("Tapotez pour monter le régime dans la zone verte.");
  const [tone, setTone] = useState<Tone>("idle");
  const rpmRef = useRef(0);
  const holdRef = useRef(0);
  const win = useWinOnce(onWin);

  useEffect(() => {
    const timer = window.setInterval(() => {
      rpmRef.current = Math.max(0, rpmRef.current - 1.1);
      const inBand = rpmRef.current >= 55 && rpmRef.current <= 85;
      holdRef.current = inBand
        ? Math.min(3000, holdRef.current + 50)
        : Math.max(0, holdRef.current - 100);
      setRpm(rpmRef.current);
      setHold(holdRef.current);
      if (holdRef.current >= 3000) {
        setTone("ok");
        setMessage("Le moteur tourne !");
        win();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [win]);

  const rev = () => {
    rpmRef.current = Math.min(100, rpmRef.current + 10);
    setRpm(rpmRef.current);
    setTone("idle");
    setMessage(rpmRef.current < 55 ? "Encore un peu de régime…" : "Maintenez dans la zone verte !");
  };

  const inBand = rpm >= 55 && rpm <= 85;

  return (
    <GameFrame
      name={name}
      badge={`${(hold / 1000).toFixed(1)} s / 3 s`}
      message={message}
      tone={tone}
      footer={<ActionButton onClick={rev}>Tapoter l&apos;accélérateur</ActionButton>}
    >
      <GameBoard className="h-64">
        <Image
          src="/workshop/engine-workshop-v2.png"
          alt=""
          fill
          sizes="(min-width: 640px) 440px, 90vw"
          className="pointer-events-none object-contain opacity-20"
        />
        <div className="absolute inset-x-5 bottom-5">
          <div className="mb-2 flex items-end justify-between">
            <span className="font-display text-3xl font-bold italic tabular-nums text-zinc-100">
              {Math.round(rpm * 90)}
              <small className="ml-1 text-xs font-semibold not-italic text-zinc-500">tr/min</small>
            </span>
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${inBand ? "text-emerald-300" : "text-zinc-500"}`}>
              {inBand ? "Zone verte" : "Hors zone"}
            </span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-zinc-800">
            <span className="absolute inset-y-0 left-[55%] w-[30%] bg-emerald-500/40" />
            <span
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-600 to-amber-300"
              style={{ width: `${rpm}%` }}
            />
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <span className="block h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${(hold / 3000) * 100}%` }} />
          </div>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 6 · Boîte — Extraction des pignons usés (taper les rebuts)          */
/* ------------------------------------------------------------------ */

/** Pignon illustré : acier sain, ou acier usé avec dent manquante et fêlure. */
function DebrisGear({ broken, className = "" }: { broken: boolean; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `debris-${uid}-${name}`;
  const crack = "M33 16 L27 21 L29 25 L23 29 L25 35";
  const branch = "M29 25 L34 28";
  return (
    <svg viewBox="0 0 48 48" className={`h-full w-full ${className}`} aria-hidden>
      <defs>
        <radialGradient id={id("steel")} cx="34%" cy="28%" r="80%">
          {broken ? (
            <>
              <stop offset="0%" stopColor="#efd39a" />
              <stop offset="42%" stopColor="#a87c40" />
              <stop offset="100%" stopColor="#49351c" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#c6cbd3" />
              <stop offset="42%" stopColor="#858b95" />
              <stop offset="100%" stopColor="#34383f" />
            </>
          )}
        </radialGradient>
        <mask id={id("chip")}>
          <rect width="48" height="48" fill="#ffffff" />
          <path d="M29 0 L48 4 L46 11 L42 9 L43 16 L38 14 L39 20 L32 17 Z" fill="#000000" />
        </mask>
      </defs>
      <g mask={broken ? `url(#${id("chip")})` : undefined}>
        <g transform="translate(24 24)">
          <path d={gearPath(12, 21, 16)} fill={`url(#${id("steel")})`} stroke="#0e0f12" strokeWidth="1.1" strokeLinejoin="round" />
          <circle r="14.2" fill={broken ? "#2d2519" : "#24272c"} stroke="#0e0f12" strokeWidth=".9" />
          <circle r="12.1" fill="none" stroke={broken ? "#6b5430" : "#4a4f57"} strokeWidth=".7" opacity=".7" />
          {Array.from({ length: 5 }, (_, i) => {
            const a = ((i * 72 - 90) * Math.PI) / 180;
            return <circle key={i} cx={9.8 * Math.cos(a)} cy={9.8 * Math.sin(a)} r="2.3" fill="#0b0c0e" stroke={broken ? "#6b5430" : "#565b64"} strokeWidth=".45" />;
          })}
          <circle r="6.3" fill={`url(#${id("steel")})`} stroke="#0e0f12" strokeWidth=".9" />
          <circle r="2.5" fill="#0b0c0f" stroke={broken ? "#8a6a38" : "#737983"} strokeWidth=".55" />
          <path d="M-13 8 A15 15 0 0 1 -4 -14" fill="none" stroke="#ffffff" strokeWidth="1.1" strokeOpacity={broken ? ".2" : ".32"} strokeLinecap="round" />
        </g>
      </g>
      {broken && (
        <g style={{ filter: "drop-shadow(0 0 2px rgba(248,113,113,.55))" }}>
          <path d={crack} fill="none" stroke="#5c1212" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d={crack} fill="none" stroke="#f87171" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
          <path d={branch} fill="none" stroke="#5c1212" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={branch} fill="none" stroke="#fca5a5" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M33 16 L36 14 L39 15 L40 19" fill="none" stroke="#fde68a" strokeWidth="1" strokeLinecap="round" strokeOpacity=".8" />
        </g>
      )}
    </svg>
  );
}

const DEBRIS = [
  { broken: true },
  { broken: false },
  { broken: true },
  { broken: true },
  { broken: false },
  { broken: true },
  { broken: true },
  { broken: false },
  { broken: false },
  { broken: true },
];

function DebrisGame({ name, onWin, onMiss }: GameProps) {
  const [items] = useState(() => shuffle(DEBRIS));
  const [removed, setRemoved] = useState<boolean[]>(() => items.map(() => false));
  const [sealed, setSealed] = useState<boolean[]>(() => items.map(() => false));
  const [message, setMessage] = useState("Touchez uniquement les pignons fissurés (fêlure rouge) : les pignons sains doivent rester intacts.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);

  const tap = (index: number) => {
    if (removed[index] || sealed[index]) return;
    if (items[index].broken) {
      const next = [...removed];
      next[index] = true;
      setRemoved(next);
      const count = next.filter(Boolean).length;
      setTone("ok");
      if (count >= 6) {
        setMessage("Tous les rebuts sont extraits.");
        win();
      } else {
        setMessage(`Rebut retiré. Encore ${6 - count}.`);
      }
      return;
    }
    const next = [...sealed];
    next[index] = true;
    setSealed(next);
    setTone("bad");
    setMessage("Pignon sain : vous l'avez marqué. Il ne compte pas.");
    onMiss();
  };

  const count = removed.filter(Boolean).length;

  return (
    <GameFrame name={name} badge={`${count} / 6`} message={message} tone={tone}>
      <GameBoard className="p-4">
        <div className="relative z-10">
          <div className="grid grid-cols-5 gap-2">
          {items.map((item, index) => {
            const isRemoved = removed[index];
            const isSealed = sealed[index];
            return (
              <button
                key={index}
                type="button"
                onClick={() => tap(index)}
                aria-label={`Pignon ${index + 1}`}
                className={`relative grid aspect-square place-items-center rounded-xl border transition ${
                  isRemoved
                    ? "invisible"
                    : item.broken
                      ? "border-amber-500/40 bg-[radial-gradient(circle_at_50%_35%,rgba(251,191,36,.16),rgba(251,191,36,.03)_72%)] hover:border-amber-300/70 hover:bg-amber-500/15"
                      : isSealed
                        ? "border-line bg-black/20 opacity-40"
                        : "border-line bg-black/20 hover:border-zinc-500"
                }`}
              >
                <span className="grid h-[82%] w-[82%] place-items-center">
                  <DebrisGear broken={item.broken} />
                </span>
                {isSealed && <X size={16} className="absolute right-1 top-1 text-red-400" aria-hidden />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-300">
            <span className="h-4 w-4 shrink-0"><DebrisGear broken /></span>
            fissuré = à retirer
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-black/30 px-2 py-0.5">
            <span className="h-4 w-4 shrink-0"><DebrisGear broken={false} /></span>
            sain = à laisser
          </span>
        </div>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 7 · Boîte — Calage des pignons (tourner)                            */
/* ------------------------------------------------------------------ */

function GearMeshGame({ name, onWin, onMiss }: GameProps) {
  const [angle, setAngle] = useState(143);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("Faites tourner le pignon orange jusqu'au repère vert.");
  const [tone, setTone] = useState<Tone>("idle");
  const angleRef = useRef(143);
  const dragRef = useRef<{ pointer: number; base: number } | null>(null);
  const moved = useRef(false);
  const win = useWinOnce(onWin);

  const pointerAngle = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width * (216 / 320);
    const cy = rect.top + rect.height * (125 / 250);
    return (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI;
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width * (216 / 320);
    const cy = rect.top + rect.height * (125 / 250);
    const distance = Math.hypot(event.clientX - cx, event.clientY - cy);
    if (distance > Math.min(rect.width, rect.height) * 0.42) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointer: pointerAngle(event), base: angleRef.current };
    moved.current = false;
    setDragging(true);
    setTone("idle");
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) return;
    const delta = angleDelta(pointerAngle(event), start.pointer);
    if (Math.abs(delta) > 2) moved.current = true;
    const next = start.base + delta;
    angleRef.current = next;
    setAngle(next);
  };

  const check = () => {
    const remaining = Math.abs(angleDelta(angleRef.current, 0));
    if (remaining <= 5) {
      setTone("ok");
      setMessage("Les dents sont alignées.");
      win();
      return true;
    }
    return false;
  };

  const stop = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (check()) return;
    if (moved.current) {
      setTone("bad");
      setMessage("Toujours pas aligné : ajustez au degré près.");
      onMiss();
    }
  };

  const nudge = (delta: number) => {
    angleRef.current += delta;
    setAngle(angleRef.current);
    setTone("idle");
    if (check()) return;
    setMessage("Continuez à tourner.");
  };

  const remaining = Math.round(Math.abs(angleDelta(angle, 0)));

  return (
    <GameFrame
      name={name}
      badge={`${remaining}°`}
      message={message}
      tone={tone}
      footer={
        <div className="mt-4 flex items-center justify-center gap-3">
          <SmallButton onClick={() => nudge(-10)} aria-label="Tourner à gauche">
            <RotateCcw size={18} className="inline" />
          </SmallButton>
          <span className={`text-xs font-semibold ${dragging ? "text-amber-300" : "text-zinc-500"}`}>
            {dragging ? "Relâchez pour vérifier" : "Faites glisser le pignon"}
          </span>
          <SmallButton onClick={() => nudge(10)} aria-label="Tourner à droite">
            <RotateCw size={18} className="inline" />
          </SmallButton>
        </div>
      }
    >
      <GameBoard className="p-2">
        <div
          className="relative z-10 mx-auto aspect-[4/3] w-full touch-none select-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
        >
          <svg viewBox="0 0 320 250" className="absolute inset-0 h-full w-full" aria-hidden>
            <circle cx="112" cy="125" r="60" fill="none" stroke="#34363d" strokeWidth="17" strokeDasharray="12 9" />
            <circle cx="112" cy="125" r="46" fill="#0e1015" stroke="#52525b" strokeWidth="2" />
            <circle cx="112" cy="125" r="17" fill="#1f2127" stroke="#52525b" strokeWidth="2" />
            <circle cx="112" cy="125" r="5" fill="#0a0b0f" />

            <path d="M216 60 L216 44" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
            <circle cx="216" cy="40" r="4.5" fill="#34d399" />

            <g transform={`rotate(${angle} 216 125)`}>
              <circle cx="216" cy="125" r="45" fill="none" stroke="#f59e0b" strokeWidth="13" strokeDasharray="9 6" />
              <circle cx="216" cy="125" r="33" fill="#0e1015" stroke="#fbbf24" strokeWidth="2" />
              <circle cx="216" cy="125" r="13" fill="#1f2127" stroke="#fbbf24" strokeWidth="2" />
              <circle cx="216" cy="125" r="4.5" fill="#0a0b0f" />
              <path d="M216 80 L216 66" stroke="#fde68a" strokeWidth="3" strokeLinecap="round" />
            </g>

            <ellipse cx="164" cy="218" rx="118" ry="10" fill="rgba(0,0,0,.45)" />
          </svg>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 8 · Boîte — Précharge des roulements (régler)                       */
/* ------------------------------------------------------------------ */

function PreloadGame({ name, onWin, onMiss }: GameProps) {
  const [value, setValue] = useState(20);
  const [holding, setHolding] = useState(false);
  const [hold, setHold] = useState(0);
  const [message, setMessage] = useState("Amenez le curseur dans la zone verte, puis maintenez.");
  const [tone, setTone] = useState<Tone>("idle");
  const valueRef = useRef(20);
  const holdRef = useRef(0);
  const holdingRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const win = useWinOnce(onWin);

  useEffect(() => {
    if (!holding) return;
    const timer = window.setInterval(() => {
      valueRef.current = clamp(valueRef.current + 0.55);
      const inBand = valueRef.current >= 45 && valueRef.current <= 55;
      holdRef.current = inBand ? Math.min(2000, holdRef.current + 100) : Math.max(0, holdRef.current - 160);
      setValue(valueRef.current);
      setHold(holdRef.current);
      if (holdRef.current >= 2000) {
        setTone("ok");
        setMessage("Précharge stabilisée.");
        win();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [holding, win]);

  const valueFromX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return valueRef.current;
    return clamp(((clientX - rect.left) / rect.width) * 100);
  };

  const start = () => {
    holdingRef.current = true;
    setHolding(true);
    setTone("idle");
  };

  const stop = (fireMiss = true) => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    if (holdRef.current < 2000) {
      holdRef.current = 0;
      setHold(0);
      setTone(fireMiss ? "bad" : "idle");
      setMessage("Relâché trop tôt : maintenez jusqu'au bout.");
      if (fireMiss) onMiss();
    }
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = valueFromX(event.clientX);
    valueRef.current = next;
    setValue(next);
    start();
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!holdingRef.current) return;
    const next = valueFromX(event.clientX);
    valueRef.current = next;
    setValue(next);
  };

  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      valueRef.current = clamp(valueRef.current - 2);
      setValue(valueRef.current);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      valueRef.current = clamp(valueRef.current + 2);
      setValue(valueRef.current);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (!event.repeat) start();
    }
  };

  const keyUp = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      stop();
    }
  };

  const inBand = value >= 45 && value <= 55;

  return (
    <GameFrame
      name={name}
      badge={`${(hold / 1000).toFixed(1)} s / 2 s`}
      message={message}
      tone={tone}
    >
      <GameBoard className="p-4">
        <div className="relative z-10 rounded-xl border border-line bg-black/55 p-3">
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="Précharge des roulements"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(value)}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={() => stop()}
            onPointerCancel={() => stop()}
            onKeyDown={keyDown}
            onKeyUp={keyUp}
            className="relative mx-auto mt-4 h-28 w-full max-w-sm touch-none select-none outline-none"
          >
          <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-zinc-800">
            <span className="absolute inset-y-0 left-[45%] w-[10%] bg-emerald-500/40" />
            <span className="absolute inset-y-0 left-0 bg-amber-500/20" style={{ width: `${value}%` }} />
          </div>
          <span
            className={`absolute top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-zinc-900 shadow-lg ${
              inBand ? "border-emerald-300 shadow-emerald-500/30" : "border-amber-300 shadow-amber-500/20"
            }`}
            style={{ left: `${clamp(value, 4, 96)}%` }}
          />
          <div className="absolute inset-x-0 top-3 flex justify-between text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            <span>0</span>
            <span className={inBand ? "text-emerald-300" : "text-zinc-500"}>45 – 55</span>
            <span>100</span>
          </div>
          <div className="absolute inset-x-0 bottom-1 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Précharge</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${(hold / 2000) * 100}%` }} />
            </div>
            <span className="font-display text-sm font-bold tabular-nums text-amber-300">{Math.round(value)}%</span>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-zinc-500">
          Maintenez le curseur dans la zone verte : il dérive lentement vers la droite.
        </p>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 9 · Boîte — Remplissage d'huile (verser)                            */
/* ------------------------------------------------------------------ */

function OilFillGame({ name, onWin, onMiss }: GameProps) {
  const [level, setLevel] = useState(0);
  const [pouring, setPouring] = useState(false);
  const [settling, setSettling] = useState(false);
  const [message, setMessage] = useState("Maintenez pour verser, relâchez entre MIN et MAX.");
  const [tone, setTone] = useState<Tone>("idle");
  const levelRef = useRef(0);
  const pouringRef = useRef(false);
  const settleTimer = useRef<number | null>(null);
  const win = useWinOnce(onWin);

  useEffect(() => {
    if (!pouring) return;
    const timer = window.setInterval(() => {
      levelRef.current = clamp(levelRef.current + 1.1);
      setLevel(levelRef.current);
    }, 50);
    return () => window.clearInterval(timer);
  }, [pouring]);

  useEffect(
    () => () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    },
    [],
  );

  const start = () => {
    if (settling) return;
    if (settleTimer.current) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    pouringRef.current = true;
    setPouring(true);
    setTone("idle");
    setMessage("Versez…");
  };

  const stop = () => {
    if (!pouringRef.current) return;
    pouringRef.current = false;
    setPouring(false);
    setSettling(true);
    setMessage("L'huile finit de couler…");
    settleTimer.current = window.setTimeout(() => {
      levelRef.current = clamp(levelRef.current + 2.6);
      setLevel(levelRef.current);
      setSettling(false);
      const finalLevel = levelRef.current;
      if (finalLevel >= 45 && finalLevel <= 70) {
        setTone("ok");
        setMessage("Niveau parfait : le carter est rempli.");
        win();
      } else {
        setTone("bad");
        setMessage(finalLevel < 45 ? "Pas assez d'huile : recommencez le niveau." : "Trop d'huile : recommencez le niveau.");
        levelRef.current = 0;
        setLevel(0);
        onMiss();
      }
      settleTimer.current = null;
    }, 320);
  };

  const keyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) start();
  };

  const keyUp = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    stop();
  };

  return (
    <GameFrame
      name={name}
      badge={`${Math.round(level)}%`}
      message={message}
      tone={tone}
      footer={
        <ActionButton
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            start();
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onKeyDown={keyDown}
          onKeyUp={keyUp}
          disabled={settling}
        >
          {pouring ? "Relâchez au bon niveau" : "Maintenir pour verser"}
        </ActionButton>
      }
    >
      <GameBoard className="p-4">
        <div className="relative z-10 mx-auto h-60 w-44">
          <div className="absolute -top-2 left-1/2 h-8 w-20 -translate-x-1/2 rounded-t-xl border border-zinc-600 bg-zinc-800" />
          <div className="absolute inset-0 overflow-hidden rounded-2xl border-2 border-zinc-600 bg-zinc-950">
            <div
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-700 via-amber-500 to-amber-300 transition-[height] duration-100"
              style={{ height: `${level}%` }}
            />
            <div
              className="absolute inset-x-0 border-y border-dashed border-emerald-400/70 bg-emerald-500/10"
              style={{ bottom: "45%", height: "25%" }}
            />
            <span className="absolute right-1 text-[9px] font-bold uppercase tracking-widest text-emerald-300" style={{ bottom: "67%" }}>
              MAX
            </span>
            <span className="absolute right-1 text-[9px] font-bold uppercase tracking-widest text-emerald-300" style={{ bottom: "42%" }}>
              MIN
            </span>
          </div>
          <span className="absolute inset-x-0 bottom-2 text-center font-display text-2xl font-bold italic tabular-nums text-black/70">
            {Math.round(level)}%
          </span>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 10 · Pneus — Râpage de l'ancienne bande (frotter)                   */
/* ------------------------------------------------------------------ */

function TreadScrubGame({ name, onWin }: GameProps) {
  return (
    <ScrubGame
      name={name}
      square
      art={
        <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <radialGradient id="scrub-halo" cx="50%" cy="50%" r="50%">
              <stop offset="55%" stopColor="#fbbf24" stopOpacity="0" />
              <stop offset="86%" stopColor="#fbbf24" stopOpacity=".1" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="50" cy="96" rx="28" ry="3" fill="#000000" opacity=".5" />
          <circle cx="50" cy="50" r="49" fill="url(#scrub-halo)" />
          <TireFace cx={50} cy={50} size={44} variant="worn" />
        </svg>
      }
      spots={TIRE_SPOTS}
      unit="résidu"
      onWin={onWin}
      onMiss={() => undefined}
    />
  );
}

/* ------------------------------------------------------------------ */
/* 11 · Pneus — Encollage de la bande (suivre la courbe)               */
/* ------------------------------------------------------------------ */

function BandTraceGame({ name, onWin, onMiss }: GameProps) {
  const [progress, setProgress] = useState(0);
  const [tracing, setTracing] = useState(false);
  const [message, setMessage] = useState("Partez du repère vert, puis suivez le pneu dans le sens des aiguilles.");
  const [tone, setTone] = useState<Tone>("idle");
  const progressRef = useRef(0);
  const lastAngle = useRef<number | null>(null);
  const tracingRef = useRef(false);
  const win = useWinOnce(onWin);

  const polar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const radius = (Math.hypot(dx, dy) / Math.min(rect.width, rect.height)) * 100;
    const angle = norm360((Math.atan2(dy, dx) * 180) / Math.PI + 90);
    return { angle, radius };
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const { angle, radius } = polar(event);
    if (radius < 34 || radius > 54) {
      setTone("bad");
      setMessage("Posez le doigt sur la bande du pneu.");
      return;
    }
    if (progressRef.current === 0) {
      if (angle > 22 && angle < 338) {
        setTone("bad");
        setMessage("Partez du repère vert en haut du pneu.");
        onMiss();
        return;
      }
    } else if (Math.abs(angleDelta(angle, progressRef.current)) > 30) {
      setTone("bad");
      setMessage("Reprenez au bout de la bande déjà posée.");
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    tracingRef.current = true;
    setTracing(true);
    lastAngle.current = angle;
    setTone("idle");
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!tracingRef.current) return;
    const { angle, radius } = polar(event);
    if (radius < 32 || radius > 56) {
      setTone("bad");
      setMessage("Restez sur la bande du pneu.");
      return;
    }
    if (lastAngle.current == null) {
      lastAngle.current = angle;
      return;
    }
    const delta = angleDelta(angle, lastAngle.current);
    if (delta > 0 && delta < 90) {
      progressRef.current = clamp(progressRef.current + delta, 0, 360);
      setProgress(progressRef.current);
      setTone("ok");
      setMessage(`Bande posée : ${Math.round((progressRef.current / 360) * 100)} %.`);
      if (progressRef.current >= 355) {
        setMessage("La bande fait le tour du pneu.");
        win();
      }
    }
    lastAngle.current = angle;
  };

  const stop = () => {
    tracingRef.current = false;
    setTracing(false);
    lastAngle.current = null;
  };

  const placeNext = () => {
    progressRef.current = clamp(progressRef.current + 30, 0, 360);
    setProgress(progressRef.current);
    setTone("ok");
    setMessage(`Bande posée : ${Math.round((progressRef.current / 360) * 100)} %.`);
    if (progressRef.current >= 355) {
      setMessage("La bande fait le tour du pneu.");
      win();
    }
  };

  return (
    <GameFrame
      name={name}
      badge={`${Math.round((progress / 360) * 100)} %`}
      message={message}
      tone={tone}
      footer={
        <button
          type="button"
          onClick={placeNext}
          className="mx-auto mt-3 block text-xs text-zinc-500 underline transition hover:text-zinc-300"
        >
          Poser un tronçon (clavier)
        </button>
      }
    >
      <GameBoard className="p-2">
        <div
          className="relative mx-auto aspect-square w-full max-w-[420px] touch-none select-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
        >
          <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <radialGradient id="band-halo" cx="50%" cy="50%" r="50%">
                <stop offset="58%" stopColor="#34d399" stopOpacity="0" />
                <stop offset="88%" stopColor="#34d399" stopOpacity=".1" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="band-new" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6ee7b7" />
                <stop offset="55%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <ellipse cx="100" cy="190" rx="58" ry="7" fill="#000000" opacity=".55" />
            <circle cx="100" cy="100" r="99" fill="url(#band-halo)" />
            <TireFace size={94} variant="worn" />
            <circle cx="100" cy="100" r="91" fill="none" stroke="#0a0a0c" strokeWidth="13" strokeOpacity=".6" />
            <circle cx="100" cy="100" r="91" fill="none" stroke="#34d399" strokeOpacity=".25" strokeWidth="1.5" strokeDasharray="4 5" />
            <circle
              cx="100"
              cy="100"
              r="91"
              fill="none"
              stroke="url(#band-new)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${(progress / 360) * 572} 572`}
              transform="rotate(-90 100 100)"
              style={{ filter: "drop-shadow(0 0 6px rgba(52,211,153,.6))" }}
            />
            <circle cx="100" cy="9" r="4.5" fill="#34d399" style={{ filter: "drop-shadow(0 0 5px rgba(52,211,153,.9))" }} />
            {progress > 0 && (
              <circle
                cx={100 + 91 * Math.sin((progress * Math.PI) / 180)}
                cy={100 - 91 * Math.cos((progress * Math.PI) / 180)}
                r="5.5"
                fill="#d1fae5"
                stroke="#34d399"
                strokeWidth="1.5"
                style={{ filter: "drop-shadow(0 0 5px rgba(52,211,153,.8))" }}
              />
            )}
          </svg>
          {tracing && (
            <span className="absolute left-3 top-3 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
              suivez la bande
            </span>
          )}
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 12 · Pneus — Cuisson autoclave (thermostat)                         */
/* ------------------------------------------------------------------ */

function ThermostatGame({ name, onWin }: GameProps) {
  const [temp, setTemp] = useState(22);
  const [hold, setHold] = useState(0);
  const [message, setMessage] = useState("Maintenez la température entre 60 et 80 °C.");
  const [tone, setTone] = useState<Tone>("idle");
  const tempRef = useRef(22);
  const holdRef = useRef(0);
  const win = useWinOnce(onWin);

  useEffect(() => {
    const timer = window.setInterval(() => {
      tempRef.current = clamp(tempRef.current + (Math.random() - 0.42) * 1.6, 0, 120);
      const inBand = tempRef.current >= 60 && tempRef.current <= 80;
      holdRef.current = inBand ? Math.min(3000, holdRef.current + 100) : Math.max(0, holdRef.current - 150);
      setTemp(tempRef.current);
      setHold(holdRef.current);
      if (holdRef.current >= 3000) {
        setTone("ok");
        setMessage("Gomme vulcanisée : le pneu est prêt.");
        win();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [win]);

  const adjust = (delta: number) => {
    tempRef.current = clamp(tempRef.current + delta, 0, 120);
    setTemp(tempRef.current);
    setTone("idle");
  };

  const inBand = temp >= 60 && temp <= 80;

  return (
    <GameFrame
      name={name}
      badge={`${(hold / 1000).toFixed(1)} s / 3 s`}
      message={message}
      tone={tone}
      footer={
        <div className="mt-4 grid grid-cols-[1fr_1.4fr_1fr] gap-2">
          <SmallButton onClick={() => adjust(-5)} aria-label="Refroidir">
            −5 °C
          </SmallButton>
          <div className="flex min-h-11 items-center justify-center rounded-lg border border-line bg-black/30 font-display text-lg font-bold tabular-nums text-amber-200">
            {Math.round(temp)} °C
          </div>
          <SmallButton onClick={() => adjust(5)} aria-label="Chauffer">
            +5 °C
          </SmallButton>
        </div>
      }
    >
      <GameBoard className="p-4">
        <div className="relative mx-auto aspect-square w-full max-w-[380px]">
          <div aria-hidden className="absolute inset-0 rounded-[30px] border border-red-500/25 bg-[radial-gradient(circle_at_50%_58%,rgba(248,113,113,.16),rgba(9,9,11,.35)_62%)] shadow-[inset_0_0_60px_rgba(0,0,0,.92)]" />
          <span aria-hidden className="absolute left-3 top-3 h-2.5 w-2.5 rounded-full border border-zinc-500 bg-zinc-800 shadow-[inset_0_1px_1px_rgba(255,255,255,.2)]" />
          <span aria-hidden className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full border border-zinc-500 bg-zinc-800 shadow-[inset_0_1px_1px_rgba(255,255,255,.2)]" />
          <span aria-hidden className="absolute bottom-3 left-3 h-2.5 w-2.5 rounded-full border border-zinc-500 bg-zinc-800 shadow-[inset_0_1px_1px_rgba(255,255,255,.2)]" />
          <span aria-hidden className="absolute bottom-3 right-3 h-2.5 w-2.5 rounded-full border border-zinc-500 bg-zinc-800 shadow-[inset_0_1px_1px_rgba(255,255,255,.2)]" />
          <div className="absolute inset-[9%] overflow-hidden rounded-[22px] border border-white/5 bg-black/40">
            <TirePhoto glow="hot" size="90%" opacity={0.95} />
            <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_68%,rgba(248,113,113,.2),transparent_62%)]" />
            <span aria-hidden className="absolute left-1/2 top-[7%] h-16 w-24 -translate-x-1/2 rounded-full bg-white/10 blur-2xl" />
            <span aria-hidden className="absolute left-1/2 top-[13%] h-9 w-14 -translate-x-1/2 rounded-full bg-white/[.06] blur-xl" />
          </div>
          <span className={`absolute left-3 top-3 rounded-lg border px-2 py-1 font-display text-base font-bold tabular-nums ${inBand ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/35 bg-red-500/10 text-red-300"}`}>
            {Math.round(temp)} °C
          </span>
          <span className="absolute right-3 top-3 grid h-12 w-12 place-items-center">
            <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="20" cy="20" r="16" fill="rgba(9,9,11,.75)" stroke="#27272a" strokeWidth="3" />
              <circle cx="20" cy="20" r="16" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(hold / 3000) * 100.5} 100.5`} style={{ filter: "drop-shadow(0 0 3px rgba(52,211,153,.7))" }} />
            </svg>
            <b className="relative text-[11px] tabular-nums text-emerald-300">{(hold / 1000).toFixed(1)}</b>
          </span>
          <span className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[.18em] ${inBand ? "border-red-500/40 bg-red-500/15 text-red-200" : "border-line bg-black/50 text-zinc-500"}`}>
            {inBand ? "Gomme en cuisson" : "Chambre froide"}
          </span>
        </div>
        <div className="mt-4">
          <div className="relative h-3 overflow-hidden rounded-full bg-zinc-800">
            <span className="absolute inset-y-0 left-1/2 w-[16.7%] bg-emerald-500/40" />
            <span
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-600 to-amber-400"
              style={{ width: `${(temp / 120) * 100}%` }}
            />
            <span className="absolute inset-y-0 w-px bg-white/70 shadow-[0_0_4px_#fff]" style={{ left: `${(temp / 120) * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
            <span>0 °C</span>
            <span className={inBand ? "font-semibold text-emerald-300" : ""}>60 – 80 °C</span>
            <span>120 °C</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${(hold / 3000) * 100}%` }} />
          </div>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Routage des étapes                                                  */
/* ------------------------------------------------------------------ */

/** Les jeux d'origine (paramétrés) sont enveloppés pour exposer le même contrat que les nouveaux. */
const LEGACY_GAMES = {
  scrub: (props: GameProps) => (
    <ScrubGame {...props} image="/workshop/engine-workshop-v2.png" spots={ENGINE_SPOTS} unit="tache" />
  ),
  valveLap: (props: GameProps) => <TimingGame {...props} target={3} />,
  rings: RingGame,
  torque: TorqueGame,
  rev: RevGame,
  debris: DebrisGame,
  mesh: GearMeshGame,
  preload: PreloadGame,
  oil: OilFillGame,
  treadScrub: TreadScrubGame,
  band: BandTraceGame,
  thermo: ThermostatGame,
} satisfies Record<string, ComponentType<GameProps>>;

const STAGE_COMPONENTS = {
  ...LEGACY_GAMES,
  ...ENGINE_GAMES,
  ...GEARBOX_GAMES,
  ...TIRE_GAMES,
};

/** Identifiant d'étape : l'ordre des étapes de chaque parcours est défini dans ReconditioningWorkshop. */
export type StageId = keyof typeof STAGE_COMPONENTS;

export type WorkshopStageProps = GameProps & { stage: StageId };

export function WorkshopStage({ stage, ...props }: WorkshopStageProps) {
  const Game: ComponentType<GameProps> = STAGE_COMPONENTS[stage];
  return <Game {...props} />;
}

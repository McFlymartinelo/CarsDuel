"use client";

/** Mini-jeux boîte : fourchettes, synchronisation, diagnostic, train de pignons, tringlerie, étanchéité. */

import { useEffect, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Droplet } from "lucide-react";
import {
  ActionButton,
  GameBoard,
  GameFrame,
  GearSvg,
  SmallButton,
  clamp,
  useWinOnce,
  type GameProps,
  type Tone,
} from "./workshop-kit";

const Chips = ({ items, current }: { items: (string | number)[]; current: number }) => (
  <ol className="mb-3 flex flex-wrap items-center justify-center gap-1.5" aria-label="Séquence demandée">
    {items.map((item, i) => (
      <li
        key={`${item}-${i}`}
        aria-current={i === current ? "step" : undefined}
        className={`grid h-9 min-w-9 place-items-center rounded-lg border px-2 font-display text-base font-bold ${
          i < current
            ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
            : i === current
              ? "border-amber-300 bg-amber-500/15 text-amber-200"
              : "border-line bg-black/30 text-zinc-500"
        }`}
      >
        {item}
      </li>
    ))}
  </ol>
);

/* ------------------------------------------------------------------ */
/* Sélection des rapports (fourchettes coulissantes)                   */
/* ------------------------------------------------------------------ */

const FORK_TARGETS = [1, 2, 3, 4, 5];
const forkGear = (positions: number[]) => {
  const rod = positions.findIndex((value) => value !== 0);
  return rod < 0 ? 0 : rod * 2 + (positions[rod] < 0 ? 1 : 2);
};

function ForkSelectionGame({ name, onWin, onMiss }: GameProps) {
  const [positions, setPositions] = useState([0, 0, 0]);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Engagez les rapports dans l'ordre : une seule fourchette peut être sortie du point mort.");
  const [tone, setTone] = useState<Tone>("idle");
  const blocked = useRef(false);
  const win = useWinOnce(onWin);

  const move = (rod: number, direction: number) => {
    const target = clamp(positions[rod] + direction, -1, 1);
    if (target === positions[rod]) return;
    if (target !== 0 && positions.some((value, i) => i !== rod && value !== 0)) {
      if (!blocked.current) {
        blocked.current = true;
        setTone("bad");
        setMessage("Blocage ! Ramenez d'abord l'autre fourchette au point mort.");
        onMiss();
      }
      return;
    }
    blocked.current = false;
    const next = positions.map((value, i) => (i === rod ? target : value));
    setPositions(next);
    const gear = forkGear(next);
    if (gear !== 0 && gear === FORK_TARGETS[progress]) {
      const done = progress + 1;
      setProgress(done);
      setTone("ok");
      if (done >= FORK_TARGETS.length) {
        setMessage("Séquence réalisée sans blocage.");
        win();
        return;
      }
      setMessage(`Rapport ${gear} engagé. Prochain : ${FORK_TARGETS[done]}.`);
      return;
    }
    setTone("idle");
    setMessage(gear === 0 ? "Point mort. Choisissez la fourchette suivante." : `Rapport ${gear} engagé, ce n'est pas celui demandé.`);
  };

  const dragRod = (event: ReactPointerEvent<HTMLDivElement>, rod: number) => {
    if (event.buttons === 0 && event.type !== "pointerdown") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const desired = Math.round(((event.clientX - rect.left) / rect.width) * 2) - 1;
    const current = positions[rod];
    if (desired !== current) move(rod, Math.sign(desired - current));
  };

  const engaged = forkGear(positions);

  return (
    <GameFrame name={name} badge={`${progress} / ${FORK_TARGETS.length}`} message={message} tone={tone}>
      <GameBoard className="p-3">
        <div className="relative z-10">
          <Chips items={FORK_TARGETS} current={progress} />
          <div className="space-y-3">
            {[0, 1, 2].map((rod) => (
              <div key={rod} className="rounded-xl border border-line bg-black/30 p-2">
                <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  <span>
                    Fourchette {rod * 2 + 1}-{rod * 2 + 2}
                  </span>
                  <span className={positions[rod] === 0 ? "" : "text-amber-300"}>{positions[rod] === 0 ? "point mort" : `rapport ${rod * 2 + (positions[rod] < 0 ? 1 : 2)}`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <SmallButton onClick={() => move(rod, -1)} aria-label={`Fourchette ${rod * 2 + 1}-${rod * 2 + 2} vers la gauche`} className="w-12">
                    <ArrowLeft size={18} className="mx-auto" />
                  </SmallButton>
                  <div
                    className="relative h-11 flex-1 touch-none select-none rounded-lg bg-zinc-900"
                    onPointerDown={(event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      dragRod(event, rod);
                    }}
                    onPointerMove={(event) => dragRod(event, rod)}
                    onPointerUp={() => (blocked.current = false)}
                    onPointerCancel={() => (blocked.current = false)}
                  >
                    <span className="absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-700" />
                    {[0, 50, 100].map((left) => (
                      <span key={left} className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-zinc-600" style={{ left: `${left === 0 ? 8 : left === 100 ? 92 : 50}%` }} />
                    ))}
                    <span
                      className={`absolute top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 transition-all duration-150 ${
                        positions[rod] === 0 ? "border-zinc-400 bg-zinc-700" : "border-amber-300 bg-amber-500/30 shadow-[0_0_14px_rgba(251,191,36,.5)]"
                      }`}
                      style={{ left: `${8 + (positions[rod] + 1) * 42}%` }}
                    />
                  </div>
                  <SmallButton onClick={() => move(rod, 1)} aria-label={`Fourchette ${rod * 2 + 1}-${rod * 2 + 2} vers la droite`} className="w-12">
                    <ArrowRight size={18} className="mx-auto" />
                  </SmallButton>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-zinc-400">Rapport engagé : <b className="text-amber-200">{engaged || "—"}</b></p>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Synchronisation au banc (régler une vitesse)                        */
/* ------------------------------------------------------------------ */

const SYNC_TOL = 3;
const speedA = (time: number) => 60 + 5 * Math.sin(time / 1500);

function SyncBenchGame({ name, onWin, onMiss }: GameProps) {
  const [speedB, setSpeedB] = useState(25);
  const [view, setView] = useState({ a: 60, angleA: 0, angleB: 0 });
  const [message, setMessage] = useState("Réglez la vitesse du pignon bleu sur celle du pignon orange, puis accouplez.");
  const [tone, setTone] = useState<Tone>("idle");
  const speedBRef = useRef(speedB);
  const speedARef = useRef(60);
  const win = useWinOnce(onWin);

  useEffect(() => {
    speedBRef.current = speedB;
  }, [speedB]);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    let clock = 0;
    let angleA = 0;
    let angleB = 0;
    const tick = (now: number) => {
      const dt = Math.min(50, now - previous);
      previous = now;
      clock += dt;
      const a = speedA(clock);
      speedARef.current = a;
      angleA += a * dt * 0.006;
      angleB += speedBRef.current * dt * 0.006;
      setView({ a, angleA, angleB });
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const diff = speedB - view.a;
  const ready = Math.abs(diff) <= SYNC_TOL;

  const couple = () => {
    const gap = speedBRef.current - speedARef.current;
    if (Math.abs(gap) <= SYNC_TOL) {
      setTone("ok");
      setMessage("Les pignons s'accouplent sans à-coup.");
      win();
      return;
    }
    setTone("bad");
    setMessage(`Craquement ! Écart de ${Math.abs(Math.round(gap))} tr/min : ${gap > 0 ? "ralentissez" : "accélérez"} le pignon bleu.`);
    onMiss();
  };

  const nudge = (delta: number) => setSpeedB((value) => clamp(Math.round(value + delta), 10, 110));

  return (
    <GameFrame
      name={name}
      badge={ready ? "synchronisés" : `écart ${diff > 0 ? "+" : ""}${Math.round(diff)} tr/min`}
      message={message}
      tone={tone}
      footer={
        <div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {[-5, -1, 1, 5].map((delta) => (
              <SmallButton key={delta} onClick={() => nudge(delta)} aria-label={`${delta > 0 ? "Accélérer" : "Ralentir"} de ${Math.abs(delta)} tour par minute`}>
                {delta > 0 ? "+" : "−"}
                {Math.abs(delta)}
              </SmallButton>
            ))}
          </div>
          <input
            type="range"
            min={10}
            max={110}
            step={1}
            value={speedB}
            aria-label="Vitesse du pignon bleu, en tours par minute"
            onChange={(event) => setSpeedB(Number(event.target.value))}
            className="mt-2 h-8 w-full accent-sky-400"
          />
          <ActionButton onClick={couple} className={ready ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200" : ""}>
            Accoupler
          </ActionButton>
        </div>
      }
    >
      <GameBoard className="p-3">
        <svg viewBox="0 0 280 130" className="relative z-10 mx-auto w-full" aria-hidden>
          <GearSvg cx={72} cy={62} teeth={18} outer={48} rotate={view.angleA} stroke="#f59e0b" mark="#fde68a" />
          <GearSvg cx={208} cy={62} teeth={18} outer={48} rotate={view.angleB} stroke={ready ? "#34d399" : "#38bdf8"} mark="#bae6fd" />
          <circle cx="140" cy="62" r="8" fill={ready ? "#34d399" : "#52525b"} opacity={ready ? 1 : 0.6} />
          <text x="72" y="124" fontSize="11" fill="#fcd34d" textAnchor="middle">
            {Math.round(view.a)} tr/min
          </text>
          <text x="208" y="124" fontSize="11" fill="#7dd3fc" textAnchor="middle">
            {speedB} tr/min
          </text>
        </svg>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Diagnostic des rapports (tester, comparer, désigner)                */
/* ------------------------------------------------------------------ */

const TRACE_LEN = 24;
const FAULTY_GEAR = 3;
const traceOf = (faulty: boolean) =>
  Array.from({ length: TRACE_LEN }, (_, i) => {
    const t = i / (TRACE_LEN - 1);
    const base = Math.sin(Math.PI * t) * 0.55;
    if (!faulty) return base;
    if (i >= 10 && i <= 12) return 0.1;
    if (i === 13) return 1;
    return base;
  });
const TRACE_OK = traceOf(false);
const TRACE_BAD = traceOf(true);

function Trace({ values, count }: { values: number[]; count: number }) {
  const shown = values.slice(0, count);
  const points = shown.map((v, i) => `${(i / (TRACE_LEN - 1)) * 118 + 1},${(30 - v * 26).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 120 32" className="h-9 w-full rounded-md bg-black/50" aria-hidden>
      <line x1="0" y1="30" x2="120" y2="30" stroke="#3f3f46" strokeWidth="0.6" />
      {shown.length > 1 && <polyline points={points} fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinejoin="round" />}
    </svg>
  );
}

function GearDiagnosisGame({ name, onWin, onMiss }: GameProps) {
  const [tested, setTested] = useState<boolean[]>([false, false, false, false, false]);
  const [cleared, setCleared] = useState<boolean[]>([false, false, false, false, false]);
  const [running, setRunning] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("Testez chaque rapport : la courbe doit rester régulière. Repérez celle qui accroche.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);

  useEffect(() => {
    if (running == null) return;
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      setCount(step);
      if (step >= TRACE_LEN) {
        window.clearInterval(timer);
        setTested((list) => list.map((value, i) => value || i === running));
        setRunning(null);
      }
    }, 45);
    return () => window.clearInterval(timer);
  }, [running]);

  const test = (index: number) => {
    setCount(0);
    setRunning(index);
    setTone("idle");
    setMessage(`Passage du rapport ${index + 1}…`);
  };

  const designate = (index: number) => {
    if (index === FAULTY_GEAR) {
      setTone("ok");
      setMessage(`Le rapport ${index + 1} accroche : synchro à remplacer.`);
      win();
      return;
    }
    setCleared((list) => list.map((value, i) => value || i === index));
    setTone("bad");
    setMessage(`Le rapport ${index + 1} passe correctement. Cherchez ailleurs.`);
    onMiss();
  };

  return (
    <GameFrame name={name} badge={`${tested.filter(Boolean).length} / 5 testés`} message={message} tone={tone}>
      <GameBoard className="p-3">
        <ul className="relative z-10 space-y-2">
          {tested.map((done, index) => {
            const isRunning = running === index;
            const values = index === FAULTY_GEAR ? TRACE_BAD : TRACE_OK;
            return (
              <li key={index} className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-line bg-black/30 p-2 ${cleared[index] ? "opacity-50" : ""}`}>
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-line font-display font-bold text-zinc-200">{index + 1}</span>
                <div role="img" aria-label={done ? (index === FAULTY_GEAR ? `Rapport ${index + 1} : courbe avec un à-coup` : `Rapport ${index + 1} : courbe régulière`) : `Rapport ${index + 1} : pas encore testé`}>
                  <Trace values={values} count={done ? TRACE_LEN : isRunning ? count : 0} />
                </div>
                <div className="flex gap-1">
                  <SmallButton disabled={running != null || cleared[index]} onClick={() => test(index)}>
                    {done ? "Retester" : "Tester"}
                  </SmallButton>
                  <SmallButton disabled={!done || running != null || cleared[index]} onClick={() => designate(index)} className="border-amber-400/40 text-amber-200">
                    Accroche
                  </SmallButton>
                </div>
              </li>
            );
          })}
        </ul>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Montage d'un train de pignons (glisser-déposer / toucher-poser)     */
/* ------------------------------------------------------------------ */

type Shaft = "primaire" | "secondaire";
type Size = "S" | "M" | "L";
const SIZE_DIAM: Record<Size, number> = { S: 13, M: 18, L: 23 };
const SIZE_TEETH: Record<Size, number> = { S: 10, M: 14, L: 18 };
const SIZE_LABEL: Record<Size, string> = { S: "petit", M: "moyen", L: "grand" };
const SHAFT_COLOR: Record<Shaft, string> = { primaire: "#f59e0b", secondaire: "#38bdf8" };
const ROW_Y = { primaire: 17, secondaire: 40 };

const SLOTS: { id: string; shaft: Shaft; size: Size; x: number; y: number }[] = [
  { id: "p1", shaft: "primaire", size: "S", x: 20, y: ROW_Y.primaire },
  { id: "p2", shaft: "primaire", size: "M", x: 50, y: ROW_Y.primaire },
  { id: "p3", shaft: "primaire", size: "L", x: 80, y: ROW_Y.primaire },
  { id: "s1", shaft: "secondaire", size: "L", x: 20, y: ROW_Y.secondaire },
  { id: "s2", shaft: "secondaire", size: "M", x: 50, y: ROW_Y.secondaire },
  { id: "s3", shaft: "secondaire", size: "S", x: 80, y: ROW_Y.secondaire },
];
const PINIONS: { id: string; shaft: Shaft; size: Size; x: number; y: number }[] = [
  { id: "t1", shaft: "secondaire", size: "M", x: 20, y: 68 },
  { id: "t2", shaft: "primaire", size: "L", x: 50, y: 68 },
  { id: "t3", shaft: "secondaire", size: "S", x: 80, y: 68 },
  { id: "t4", shaft: "primaire", size: "S", x: 20, y: 89 },
  { id: "t5", shaft: "secondaire", size: "L", x: 50, y: 89 },
  { id: "t6", shaft: "primaire", size: "M", x: 80, y: 89 },
];

function PinionAssemblyGame({ name, onWin, onMiss }: GameProps) {
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [message, setMessage] = useState("Glissez chaque pignon sur l'emplacement de même arbre et de même taille (ou touchez le pignon, puis l'emplacement).");
  const [tone, setTone] = useState<Tone>("idle");
  const boardRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const win = useWinOnce(onWin);
  const count = Object.keys(placed).length;

  const toPercent = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = boardRef.current!.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100, w: rect.width, h: rect.height };
  };

  const attempt = (pinionId: string, slotId: string) => {
    const pinion = PINIONS.find((p) => p.id === pinionId)!;
    const slot = SLOTS.find((s) => s.id === slotId)!;
    if (Object.values(placed).includes(slotId)) {
      setMessage("Cet emplacement est déjà occupé.");
      return;
    }
    setSelected(null);
    if (pinion.shaft !== slot.shaft || pinion.size !== slot.size) {
      setTone("bad");
      setMessage(pinion.shaft !== slot.shaft ? `Ce pignon va sur l'arbre ${pinion.shaft}, pas sur le ${slot.shaft}.` : `Taille incorrecte : ce pignon est ${SIZE_LABEL[pinion.size]}.`);
      onMiss();
      return;
    }
    const next = { ...placed, [pinionId]: slotId };
    setPlaced(next);
    setTone("ok");
    if (Object.keys(next).length >= PINIONS.length) {
      setMessage("Train de pignons monté.");
      win();
      return;
    }
    setMessage(`Pignon posé. Encore ${PINIONS.length - Object.keys(next).length}.`);
  };

  const drop = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    const point = toPercent(event);
    const start = startRef.current;
    startRef.current = null;
    setDrag(null);
    if (!start) return;
    if (Math.hypot(((point.x - start.x) * point.w) / 100, ((point.y - start.y) * point.h) / 100) < 8) {
      setSelected((value) => (value === id ? null : id));
      setTone("idle");
      setMessage("Pignon sélectionné : touchez son emplacement.");
      return;
    }
    let best: { id: string; dist: number } | null = null;
    for (const slot of SLOTS) {
      const dist = Math.hypot(((slot.x - point.x) * point.w) / 100, ((slot.y - point.y) * point.h) / 100);
      if (!best || dist < best.dist) best = { id: slot.id, dist };
    }
    if (best && best.dist < point.w * 0.14) attempt(id, best.id);
  };

  const gear = (shaft: Shaft, size: Size) => (
    <svg viewBox="-30 -30 60 60" className="h-full w-full" aria-hidden>
      <GearSvg cx={0} cy={0} teeth={SIZE_TEETH[size]} outer={27} stroke={SHAFT_COLOR[shaft]} />
    </svg>
  );

  return (
    <GameFrame name={name} badge={`${count} / ${PINIONS.length}`} message={message} tone={tone}>
      <GameBoard>
        <div ref={boardRef} className="relative mx-auto aspect-[5/6] w-full touch-none select-none">
          {(["primaire", "secondaire"] as Shaft[]).map((shaft) => (
            <div key={shaft} aria-hidden className="absolute inset-x-[6%]" style={{ top: `${ROW_Y[shaft]}%` }}>
              <span className="absolute inset-x-0 h-1.5 -translate-y-1/2 rounded-full" style={{ background: SHAFT_COLOR[shaft], opacity: 0.35 }} />
            </div>
          ))}
          {(["primaire", "secondaire"] as Shaft[]).map((shaft) => (
            <span key={shaft} aria-hidden className="absolute left-[6%] text-[10px] font-semibold uppercase tracking-widest" style={{ top: shaft === "primaire" ? "2%" : "24.5%", color: SHAFT_COLOR[shaft] }}>
              Arbre {shaft}
            </span>
          ))}
          {SLOTS.map((slot) => {
            const taken = Object.values(placed).includes(slot.id);
            return (
              <button
                key={slot.id}
                type="button"
                disabled={taken || selected == null}
                aria-label={`Emplacement ${SIZE_LABEL[slot.size]}, arbre ${slot.shaft}${taken ? ", occupé" : ""}`}
                onClick={() => selected && attempt(selected, slot.id)}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed transition disabled:cursor-default"
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: `${SIZE_DIAM[slot.size]}%`,
                  aspectRatio: "1 / 1",
                  borderColor: taken ? "transparent" : SHAFT_COLOR[slot.shaft],
                  background: selected && !taken ? "rgba(255,255,255,.06)" : "transparent",
                }}
              />
            );
          })}
          {PINIONS.map((pinion) => {
            const slotId = placed[pinion.id];
            const slot = slotId ? SLOTS.find((s) => s.id === slotId)! : null;
            const dragging = drag?.id === pinion.id;
            const x = slot ? slot.x : dragging ? drag.x : pinion.x;
            const y = slot ? slot.y : dragging ? drag.y : pinion.y;
            return (
              <button
                key={pinion.id}
                type="button"
                disabled={!!slot}
                aria-label={`Pignon ${SIZE_LABEL[pinion.size]}, arbre ${pinion.shaft}${selected === pinion.id ? ", sélectionné" : ""}`}
                aria-pressed={selected === pinion.id}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const p = toPercent(event);
                  startRef.current = { x: p.x, y: p.y };
                  setDrag({ id: pinion.id, x: p.x, y: p.y });
                }}
                onPointerMove={(event) => {
                  if (!startRef.current) return;
                  const p = toPercent(event);
                  setDrag({ id: pinion.id, x: p.x, y: p.y });
                }}
                onPointerUp={(event) => drop(event, pinion.id)}
                onPointerCancel={() => {
                  startRef.current = null;
                  setDrag(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected((value) => (value === pinion.id ? null : pinion.id));
                    setMessage("Pignon sélectionné : activez son emplacement.");
                  }
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none rounded-full ${slot ? "" : "cursor-grab"} ${dragging ? "z-20 cursor-grabbing drop-shadow-[0_6px_10px_rgba(0,0,0,.6)]" : "z-10"} ${
                  selected === pinion.id ? "ring-2 ring-white" : ""
                } focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400`}
                style={{ left: `${x}%`, top: `${y}%`, width: `${SIZE_DIAM[pinion.size]}%`, aspectRatio: "1 / 1" }}
              >
                {gear(pinion.shaft, pinion.size)}
              </button>
            );
          })}
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Réglage de la tringlerie (combinaison de mouvements)                */
/* ------------------------------------------------------------------ */

const LINK_TARGETS = [3, 6, 2];
const slotX = (col: number) => 20 + col * 30;
const slotY = (row: number) => 50 + row * 30;
const slotGear = (col: number, row: number) => (row === 0 ? 0 : col * 2 + (row < 0 ? 1 : 2));

function LinkageGame({ name, onWin, onMiss }: GameProps) {
  const [knob, setKnob] = useState({ col: 1, row: 0 });
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Le levier ne change de colonne qu'au point mort. Engagez le rapport demandé.");
  const [tone, setTone] = useState<Tone>("idle");
  const blocked = useRef(false);
  const win = useWinOnce(onWin);

  const step = (dc: number, dr: number) => {
    const col = knob.col + dc;
    const row = knob.row + dr;
    if (col < 0 || col > 2 || row < -1 || row > 1) return;
    if (dc !== 0 && knob.row !== 0) {
      if (!blocked.current) {
        blocked.current = true;
        setTone("bad");
        setMessage("Blocage : revenez au point mort avant de changer de colonne.");
        onMiss();
      }
      return;
    }
    blocked.current = false;
    setKnob({ col, row });
    const gear = slotGear(col, row);
    if (gear === 0) {
      setTone("idle");
      setMessage(`Point mort. Rapport demandé : ${LINK_TARGETS[progress]}.`);
      return;
    }
    if (gear === LINK_TARGETS[progress]) {
      const done = progress + 1;
      setProgress(done);
      setTone("ok");
      if (done >= LINK_TARGETS.length) {
        setMessage("Tringlerie réglée : les trois rapports passent.");
        win();
        return;
      }
      setMessage(`Rapport ${gear} engagé ! Revenez au point mort, puis passez le ${LINK_TARGETS[done]}.`);
      return;
    }
    setTone("bad");
    setMessage(`Vous avez engagé le ${gear} au lieu du ${LINK_TARGETS[progress]}. Revenez au point mort.`);
    onMiss();
  };

  const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.type !== "pointerdown" && event.buttons === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const col = clamp(Math.round((x - 20) / 30), 0, 2);
    const row = clamp(Math.round((y - 50) / 30), -1, 1);
    if (col !== knob.col) step(Math.sign(col - knob.col), 0);
    else if (row !== knob.row) step(0, Math.sign(row - knob.row));
  };

  const pad = (label: string, dc: number, dr: number, icon: ReactNode) => (
    <SmallButton onClick={() => step(dc, dr)} aria-label={label} className="grid h-12 w-12 place-items-center p-0">
      {icon}
    </SmallButton>
  );

  return (
    <GameFrame name={name} badge={`${progress} / ${LINK_TARGETS.length}`} message={message} tone={tone}>
      <GameBoard className="p-3">
        <div className="relative z-10">
          <Chips items={LINK_TARGETS} current={progress} />
          <div className="flex items-center justify-center gap-4">
            <div
              role="application"
              tabIndex={0}
              aria-label="Levier de vitesses : flèches du clavier pour déplacer"
              onKeyDown={(event) => {
                const map: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
                const move = map[event.key];
                if (!move) return;
                event.preventDefault();
                step(move[0], move[1]);
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                drag(event);
              }}
              onPointerMove={drag}
              onPointerUp={() => (blocked.current = false)}
              onPointerCancel={() => (blocked.current = false)}
              className="relative aspect-square w-full max-w-[220px] touch-none select-none rounded-xl border border-zinc-700 bg-zinc-900/80 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
                <path d="M20 20 V80 M50 20 V80 M80 20 V80 M20 50 H80" stroke="#52525b" strokeWidth="4" strokeLinecap="round" fill="none" />
                {[0, 1, 2].flatMap((col) =>
                  [-1, 1].map((row) => (
                    <text key={`${col}${row}`} x={slotX(col)} y={slotY(row) + (row < 0 ? -6 : 11)} fontSize="9" fill={slotGear(col, row) === LINK_TARGETS[progress] ? "#fbbf24" : "#a1a1aa"} textAnchor="middle" fontWeight="700">
                      {slotGear(col, row)}
                    </text>
                  )),
                )}
                <circle cx={slotX(knob.col)} cy={slotY(knob.row)} r="7" fill="#f59e0b" stroke="#fde68a" strokeWidth="1.5" style={{ transition: "cx .12s, cy .12s" }} />
              </svg>
            </div>
            <div className="grid grid-cols-3 gap-1" role="group" aria-label="Commande du levier">
              <span />
              {pad("Vers l'avant", 0, -1, <ArrowUp size={18} />)}
              <span />
              {pad("À gauche", -1, 0, <ArrowLeft size={18} />)}
              <span />
              {pad("À droite", 1, 0, <ArrowRight size={18} />)}
              <span />
              {pad("Vers l'arrière", 0, 1, <ArrowDown size={18} />)}
              <span />
            </div>
          </div>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Test d'étanchéité (jauge de pression, localiser la fuite)           */
/* ------------------------------------------------------------------ */

const JOINTS = [
  { id: "carter", label: "Joint de carter", x: 50, y: 18, leak: false, stain: "dry" },
  { id: "primaire", label: "Joint d'arbre primaire", x: 14, y: 52, leak: false, stain: "none" },
  { id: "secondaire", label: "Joint d'arbre secondaire", x: 86, y: 52, leak: true, stain: "wet" },
  { id: "bouchon", label: "Bouchon de vidange", x: 38, y: 84, leak: false, stain: "dry" },
  { id: "reniflard", label: "Reniflard", x: 66, y: 84, leak: false, stain: "none" },
] as const;
const PRESSURE_MIN = 40;
const stainText = { wet: "suintement brillant", dry: "tache sèche", none: "aucune trace" };

function TightnessTestGame({ name, onWin, onMiss }: GameProps) {
  const [pressure, setPressure] = useState(100);
  const [done, setDone] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [message, setMessage] = useState("La pression chute : repérez le joint qui fuit (suintement brillant) avant le seuil.");
  const [tone, setTone] = useState<Tone>("idle");
  const pressureRef = useRef(100);
  const missRef = useRef(onMiss);
  const win = useWinOnce(onWin);

  useEffect(() => {
    missRef.current = onMiss;
  }, [onMiss]);

  useEffect(() => {
    if (done) return;
    const timer = window.setInterval(() => {
      pressureRef.current -= 0.28;
      if (pressureRef.current <= PRESSURE_MIN) {
        pressureRef.current = 100;
        setTone("bad");
        setMessage("Pression sous le seuil : on regonfle le carter, cherchez plus vite.");
        missRef.current();
      }
      setPressure(pressureRef.current);
    }, 100);
    return () => window.clearInterval(timer);
  }, [done]);

  const inspect = (joint: (typeof JOINTS)[number]) => {
    if (done || checked.includes(joint.id)) return;
    if (joint.leak) {
      setDone(true);
      setTone("ok");
      setMessage("Fuite localisée et colmatée : le carter tient la pression.");
      win();
      return;
    }
    setChecked((list) => [...list, joint.id]);
    pressureRef.current = Math.max(PRESSURE_MIN + 4, pressureRef.current - 6);
    setPressure(pressureRef.current);
    setTone("bad");
    setMessage(`${joint.label} : étanche (${stainText[joint.stain]}). La pression a baissé pendant le contrôle.`);
    onMiss();
  };

  const angle = -120 + (pressure / 100) * 240;
  const low = pressure < PRESSURE_MIN + 15;

  return (
    <GameFrame name={name} badge={`${Math.round(pressure)} % de pression`} message={message} tone={tone}>
      <GameBoard className="p-3">
        <div className="relative z-10 grid items-center gap-3 sm:grid-cols-[auto_1fr]">
          <svg viewBox="-62 -62 124 106" className="mx-auto w-40" role="img" aria-label={`Manomètre : ${Math.round(pressure)} pour cent, seuil ${PRESSURE_MIN} pour cent`}>
            <path d="M-45 26 A52 52 0 1 1 45 26" fill="none" stroke="#3f3f46" strokeWidth="9" strokeLinecap="round" />
            <line x1="0" y1="-44" x2="0" y2="-58" stroke="#ef4444" strokeWidth="3" transform={`rotate(${-120 + (PRESSURE_MIN / 100) * 240})`} />
            <line x1="0" y1="0" x2="0" y2="-40" stroke={low ? "#f87171" : "#fbbf24"} strokeWidth="3" strokeLinecap="round" transform={`rotate(${angle})`} style={{ transition: "transform .1s linear" }} />
            <circle r="5" fill="#27272a" stroke="#71717a" />
            <text y="34" fontSize="9" fill="#a1a1aa" textAnchor="middle">
              seuil {PRESSURE_MIN} %
            </text>
          </svg>
          <div className="relative mx-auto aspect-[3/2] w-full max-w-[300px] rounded-2xl border border-zinc-600 bg-zinc-900/80">
            {JOINTS.map((joint) => (
              <button
                key={joint.id}
                type="button"
                disabled={done || checked.includes(joint.id)}
                onClick={() => inspect(joint)}
                aria-label={`${joint.label}, ${stainText[joint.stain]}`}
                className="absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-zinc-500 bg-zinc-800 transition hover:border-amber-300 disabled:opacity-40"
                style={{ left: `${joint.x}%`, top: `${joint.y}%` }}
              >
                {joint.stain === "wet" && <Droplet size={18} className="fill-sky-300 text-sky-200" aria-hidden />}
                {joint.stain === "dry" && <span aria-hidden className="h-3 w-5 rounded-full bg-amber-950" />}
                {joint.stain === "none" && <span aria-hidden className="h-2 w-2 rounded-full bg-zinc-500" />}
              </button>
            ))}
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[10px] uppercase tracking-widest text-zinc-600">carter</span>
          </div>
        </div>
        <p className="relative z-10 mt-2 text-center text-[11px] text-zinc-500">Touchez un joint pour le contrôler : goutte brillante = suintement, tache brune = ancienne trace sèche.</p>
      </GameBoard>
    </GameFrame>
  );
}

export const GEARBOX_GAMES = {
  forks: ForkSelectionGame,
  sync: SyncBenchGame,
  diagnosis: GearDiagnosisGame,
  pinions: PinionAssemblyGame,
  linkage: LinkageGame,
  tightness: TightnessTestGame,
} satisfies Record<string, ComponentType<GameProps>>;

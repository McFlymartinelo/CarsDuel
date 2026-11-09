"use client";

/** Mini-jeux boîte : fourchettes, synchronisation, diagnostic, train de pignons, tringlerie, étanchéité, bruit, roulements, sélecteur, huile, jeu axial. */

import { useCallback, useEffect, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Droplet, RotateCw } from "lucide-react";
import {
  ActionButton,
  GameBoard,
  GameFrame,
  GearSvg,
  PartArt,
  SmallButton,
  clamp,
  useClock,
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
const traceOf = (faulty: boolean, faultStart = 10, faultLength = 3) =>
  Array.from({ length: TRACE_LEN }, (_, i) => {
    const t = i / (TRACE_LEN - 1);
    const base = Math.sin(Math.PI * t) * 0.55;
    if (!faulty) return base;
    if (i >= faultStart && i < faultStart + faultLength) return 0.1;
    if (i === faultStart + faultLength) return 1;
    return base;
  });
const TRACE_OK = traceOf(false);

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
  const [fault] = useState(() => {
    const start = 4 + Math.floor(Math.random() * 12);
    const length = 1 + Math.floor(Math.random() * 4);
    return { index: Math.floor(Math.random() * 5), trace: traceOf(true, start, length) };
  });
  const faultyGear = fault.index;
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
    if (index === faultyGear) {
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
            const values = index === faultyGear ? fault.trace : TRACE_OK;
            return (
              <li key={index} className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-line bg-black/30 p-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] ${cleared[index] ? "opacity-50" : ""}`}>
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-line font-display font-bold text-zinc-200">{index + 1}</span>
                <div role="img" aria-label={done ? (index === faultyGear ? `Rapport ${index + 1} : courbe avec un à-coup` : `Rapport ${index + 1} : courbe régulière`) : `Rapport ${index + 1} : pas encore testé`}>
                  <Trace values={values} count={done ? TRACE_LEN : isRunning ? count : 0} />
                </div>
                <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
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

const LINK_GEAR_POOL = [1, 2, 3, 4, 5, 6];
function createLinkTargets() {
  const values = [...LINK_GEAR_POOL];
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  const length = 3 + Math.floor(Math.random() * 3);
  return values.slice(0, length);
}
const slotX = (col: number) => 20 + col * 30;
const slotY = (row: number) => 50 + row * 30;
const slotGear = (col: number, row: number) => (row === 0 ? 0 : col * 2 + (row < 0 ? 1 : 2));

function LinkageGame({ name, onWin, onMiss }: GameProps) {
  const [targets] = useState(createLinkTargets);
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
      setMessage(`Point mort. Rapport demandé : ${targets[progress]}.`);
      return;
    }
    if (gear === targets[progress]) {
      const done = progress + 1;
      setProgress(done);
      setTone("ok");
      if (done >= targets.length) {
        setMessage("Tringlerie réglée : les trois rapports passent.");
        win();
        return;
      }
      setMessage(`Rapport ${gear} engagé ! Revenez au point mort, puis passez le ${targets[done]}.`);
      return;
    }
    setTone("bad");
    setMessage(`Vous avez engagé le ${gear} au lieu du ${targets[progress]}. Revenez au point mort.`);
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
    <GameFrame name={name} badge={`${progress} / ${targets.length}`} message={message} tone={tone}>
      <GameBoard className="p-3">
        <div className="relative z-10">
          <Chips items={targets} current={progress} />
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
                      <text key={`${col}${row}`} x={slotX(col)} y={slotY(row) + (row < 0 ? -6 : 11)} fontSize="9" fill={slotGear(col, row) === targets[progress] ? "#fbbf24" : "#a1a1aa"} textAnchor="middle" fontWeight="700">
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
  { id: "carter", label: "Joint de carter", short: "Couvercle", x: 50, y: 16, leak: false, stain: "dry" },
  { id: "primaire", label: "Joint d'arbre primaire", short: "Primaire", x: 12, y: 52, leak: false, stain: "none" },
  { id: "secondaire", label: "Joint d'arbre secondaire", short: "Secondaire", x: 88, y: 52, leak: true, stain: "wet" },
  { id: "bouchon", label: "Bouchon de vidange", short: "Vidange", x: 37, y: 86, leak: false, stain: "dry" },
  { id: "reniflard", label: "Reniflard", short: "Reniflard", x: 82, y: 17, leak: false, stain: "none" },
] as const;
const PRESSURE_MIN = 40;
const PRESSURE_COST = 6;
const stainText = { wet: "suintement brillant", dry: "tache sèche", none: "aucune trace" };
const gaugePoint = (radius: number, deg: number) => ({
  x: radius * Math.sin((deg * Math.PI) / 180),
  y: -radius * Math.cos((deg * Math.PI) / 180),
});
const gaugeArc = (radius: number, from: number, to: number) => {
  const a = gaugePoint(radius, from);
  const b = gaugePoint(radius, to);
  return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

function TightnessTestGame({ name, onWin, onMiss }: GameProps) {
  const [joints] = useState(() => {
    const leakIndex = Math.floor(Math.random() * JOINTS.length);
    return JOINTS.map((joint, index) => ({
      ...joint,
      leak: index === leakIndex,
      stain: index === leakIndex ? "wet" as const : joint.stain === "wet" ? "dry" as const : joint.stain,
    }));
  });
  const [pressure, setPressure] = useState(100);
  const [done, setDone] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [message, setMessage] = useState("Inspectez les joints : la pression fuit en continu.");
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
        setMessage("Pression sous 40 % : le carter est regonflé à 100 %, réessayez.");
        missRef.current();
      }
      setPressure(pressureRef.current);
    }, 100);
    return () => window.clearInterval(timer);
  }, [done]);

  const inspect = (joint: (typeof joints)[number]) => {
    if (done || checked.includes(joint.id)) return;
    if (joint.leak) {
      setDone(true);
      setTone("ok");
      setMessage("Fuite localisée et colmatée : le carter tient la pression.");
      win();
      return;
    }
    setChecked((list) => [...list, joint.id]);
    pressureRef.current = Math.max(PRESSURE_MIN + 4, pressureRef.current - PRESSURE_COST);
    setPressure(pressureRef.current);
    setTone("bad");
    setMessage(`${joint.label} : étanche (${stainText[joint.stain]}). Contrôle raté : −${PRESSURE_COST} % de pression.`);
    onMiss();
  };

  const angle = -120 + (pressure / 100) * 240;
  const thresholdAngle = -120 + (PRESSURE_MIN / 100) * 240;
  const low = pressure < PRESSURE_MIN + 15;
  const thresholdAt = gaugePoint(38, thresholdAngle);

  return (
    <GameFrame name={name} badge={`${Math.round(pressure)} % de pression`} message={message} tone={tone}>
      <GameBoard className="p-3">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,.08),transparent_62%)]" />

        <div className="relative z-10 space-y-3">
          {/* Consigne et légende des indices */}
          <div className="rounded-xl border border-line bg-black/30 px-2.5 py-2">
            <p className="text-center text-[11px] leading-snug text-zinc-300">
              <b className="text-zinc-100">Un seul joint fuit.</b> Cliquez sur la <b className="text-sky-300">goutte brillante</b>, pas sur les traces brunes. Chaque erreur coûte <b className="text-red-300">−{PRESSURE_COST} %</b> de pression.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[9px] font-semibold">
              <span className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-1.5 text-sky-200">
                <Droplet size={11} className="shrink-0 fill-sky-300 text-sky-200" aria-hidden />Goutte = fuite
              </span>
              <span className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-amber-800/50 bg-amber-950/30 px-1.5 text-amber-200">
                <span aria-hidden className="h-2.5 w-4 shrink-0 rounded-[50%] bg-[radial-gradient(circle_at_35%_30%,#a8753f,#4a2d10_72%)]" />Trace sèche
              </span>
              <span className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-line bg-black/30 px-1.5 text-zinc-400">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />Aucune trace
              </span>
            </div>
          </div>

          {/* Jauge de pression */}
          <div className="flex items-center gap-2 rounded-xl border border-line bg-black/35 p-2">
            <svg viewBox="-58 -58 116 104" className="w-[126px] shrink-0" role="img" aria-label={`Manomètre : ${Math.round(pressure)} pour cent, seuil ${PRESSURE_MIN} pour cent`}>
              <defs>
                <linearGradient id="tight-bezel" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e4e4e7" />
                  <stop offset="32%" stopColor="#71717a" />
                  <stop offset="58%" stopColor="#27272a" />
                  <stop offset="80%" stopColor="#a1a1aa" />
                  <stop offset="100%" stopColor="#3f3f46" />
                </linearGradient>
                <radialGradient id="tight-face" cx="42%" cy="34%" r="72%">
                  <stop offset="0%" stopColor="#26262c" />
                  <stop offset="100%" stopColor="#0b0b0e" />
                </radialGradient>
              </defs>
              <circle r="50" fill="#000000" opacity=".45" />
              <circle r="48" fill="url(#tight-face)" stroke="url(#tight-bezel)" strokeWidth="5" />
              <path d={gaugeArc(41, -120, 120)} fill="none" stroke="#3f3f46" strokeWidth="7" strokeLinecap="round" />
              <path d={gaugeArc(41, -120, thresholdAngle)} fill="none" stroke="#ef4444" strokeWidth="7" strokeLinecap="butt" />
              <path d={gaugeArc(41, thresholdAngle, 120)} fill="none" stroke="#34d399" strokeWidth="7" strokeLinecap="round" strokeOpacity=".75" />
              {Array.from({ length: 21 }, (_, i) => {
                const value = i * 5;
                const deg = -120 + (value / 100) * 240;
                const outer = gaugePoint(48, deg);
                const inner = gaugePoint(i % 4 === 0 ? 43.5 : 46, deg);
                return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={i % 4 === 0 ? "#d4d4d8" : "#71717a"} strokeWidth={i % 4 === 0 ? 1 : .5} strokeLinecap="round" />;
              })}
              <text x={thresholdAt.x} y={thresholdAt.y} fontSize="5" fontWeight="700" fill="#fca5a5" textAnchor="middle">{PRESSURE_MIN}</text>
              <text x="-41" y="32" fontSize="7" fill="#a1a1aa" textAnchor="middle">0</text>
              <text x="41" y="32" fontSize="7" fill="#a1a1aa" textAnchor="middle">100</text>
              <g transform={`rotate(${angle})`} style={{ filter: `drop-shadow(0 0 3px ${low ? "rgba(248,113,113,.75)" : "rgba(251,191,36,.5)"})` }}>
                <path d="M0 2 L-2.5 -31 L0 -36 L2.5 -31 Z" fill={low ? "#f87171" : "#fbbf24"} />
              </g>
              <circle r="7" fill="#27272a" stroke="url(#tight-bezel)" strokeWidth="1.2" />
              <circle r="2.5" fill="#111114" stroke="#71717a" strokeWidth=".7" />
              <text y="42" fontSize="4.8" letterSpacing="1.6" textAnchor="middle" fill="#52525b">PRESSION</text>
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-zinc-500">Pression carter</p>
              <p className={`font-display text-2xl font-bold tabular-nums ${low ? "text-red-300" : "text-amber-200"}`}>{Math.round(pressure)} %</p>
              <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
                <span className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400" style={{ width: `${pressure}%` }} />
                <span className="absolute inset-y-0 w-px bg-white/85 shadow-[0_0_4px_#fff]" style={{ left: `${PRESSURE_MIN}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-zinc-500">
                <span>0</span>
                <span className="font-semibold text-red-300">seuil {PRESSURE_MIN}</span>
                <span>100</span>
              </div>
              <p className="mt-1 text-[9px] text-zinc-500">Chaque joint contrôlé à tort coûte {PRESSURE_COST} %.</p>
            </div>
          </div>

          {/* Carter et joints */}
          <div className="relative mx-auto aspect-[3/2] w-full max-w-[360px]">
            <svg viewBox="0 0 300 200" className="absolute inset-0 h-full w-full" aria-hidden>
              <defs>
                <linearGradient id="gear-metal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3d4047" />
                  <stop offset="48%" stopColor="#26282d" />
                  <stop offset="100%" stopColor="#141519" />
                </linearGradient>
                <linearGradient id="gear-top" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4a4d55" />
                  <stop offset="100%" stopColor="#2b2d33" />
                </linearGradient>
                <radialGradient id="gear-bolt" cx="38%" cy="32%" r="70%">
                  <stop offset="0%" stopColor="#bfc2c9" />
                  <stop offset="100%" stopColor="#4a4d55" />
                </radialGradient>
              </defs>
              <ellipse cx="150" cy="184" rx="120" ry="8" fill="#000000" opacity=".55" />
              {/* cloche d'embrayage */}
              <ellipse cx="62" cy="100" rx="47" ry="58" fill="url(#gear-metal)" stroke="#0a0a0c" strokeWidth="2" />
              <ellipse cx="62" cy="100" rx="35" ry="45" fill="none" stroke="#4a4d55" strokeWidth="1.2" strokeOpacity=".8" />
              <ellipse cx="62" cy="100" rx="27" ry="36" fill="#191b1f" stroke="#121316" strokeWidth="1" />
              {/* corps principal */}
              <rect x="72" y="38" width="198" height="124" rx="16" fill="url(#gear-metal)" stroke="#0a0a0c" strokeWidth="2" />
              <rect x="80" y="46" width="182" height="108" rx="11" fill="none" stroke="#4a4d55" strokeWidth=".8" strokeOpacity=".55" />
              {/* nervures */}
              <g stroke="#4b4e56" strokeWidth="1.2" strokeOpacity=".35">
                <path d="M96 56 V146 M116 56 V146 M136 56 V146 M156 56 V146 M176 56 V146 M196 56 V146 M216 56 V146 M236 56 V146 M256 56 V146" />
                <path d="M88 66 L264 66 M88 134 L264 134" />
              </g>
              {/* couvercle supérieur */}
              <rect x="88" y="28" width="166" height="20" rx="7" fill="url(#gear-top)" stroke="#0a0a0c" strokeWidth="1.4" />
              <path d="M94 33 H248" stroke="#6f737c" strokeWidth="1" strokeOpacity=".45" />
              {/* plan de joint */}
              <path d="M74 100 H266" stroke="#111216" strokeWidth="2" />
              <path d="M74 98 H266" stroke="#585b63" strokeWidth=".7" strokeOpacity=".5" />
              {/* plaque centrale */}
              <rect x="119" y="76" width="94" height="34" rx="6" fill="#17191d" stroke="#42454c" strokeWidth="1" />
              <text x="166" y="97" fontSize="11" letterSpacing="2.4" textAnchor="middle" fill="#7b7f88">CARTER</text>
              {/* arbre primaire */}
              <rect x="6" y="91" width="34" height="18" rx="3" fill="#5c6068" stroke="#202226" />
              <circle cx="36" cy="100" r="12" fill="#23252a" stroke="#7a7e86" strokeWidth="1.2" />
              {/* arbre secondaire */}
              <rect x="258" y="91" width="36" height="18" rx="3" fill="#5c6068" stroke="#202226" />
              <circle cx="264" cy="100" r="12" fill="#23252a" stroke="#7a7e86" strokeWidth="1.2" />
              {/* bouchon de vidange */}
              <circle cx="111" cy="162" r="12" fill="#2b2d33" stroke="#7a7e86" strokeWidth="1.3" />
              <path d="M104 162 H118 M111 155 V169 M106 157 L116 167 M116 157 L106 167" stroke="#555961" strokeWidth=".9" />
              {/* reniflard */}
              <circle cx="246" cy="34" r="9" fill="#2b2d33" stroke="#7a7e86" strokeWidth="1.2" />
              <path d="M241 30 L251 38 M251 30 L241 38" stroke="#555961" strokeWidth=".8" />
              {/* boulons */}
              {[[86, 44], [254, 44], [86, 154], [254, 154], [74, 100], [266, 100]].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="2.6" fill="url(#gear-bolt)" stroke="#15171a" strokeWidth=".6" />
              ))}
            </svg>
            {joints.map((joint) => {
              const inspected = checked.includes(joint.id);
              return (
                <div key={joint.id}>
                  <button
                    type="button"
                    disabled={done || inspected}
                    onClick={() => inspect(joint)}
                    aria-label={`${joint.label}, ${stainText[joint.stain]}`}
                    className={`absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-zinc-800/95 shadow-[0_3px_10px_rgba(0,0,0,.65),inset_0_1px_1px_rgba(255,255,255,.14)] transition hover:border-amber-300 disabled:opacity-60 ${
                      joint.leak ? "border-sky-400/60 shadow-[0_0_14px_rgba(56,189,248,.3)]" : "border-zinc-500"
                    }`}
                    style={{ left: `${joint.x}%`, top: `${joint.y}%` }}
                  >
                    <span className={`absolute inset-[5px] rounded-full border ${joint.leak ? "border-sky-300/35" : "border-zinc-600/70"}`} />
                    {joint.stain === "wet" && <Droplet size={18} className="relative fill-sky-300 text-sky-200 drop-shadow-[0_0_5px_rgba(125,211,252,.85)]" aria-hidden />}
                    {joint.stain === "dry" && <span aria-hidden className="relative h-3.5 w-6 rounded-[50%] bg-[radial-gradient(circle_at_35%_30%,#a8753f,#4a2d10_72%)] shadow-[0_0_0_1px_rgba(0,0,0,.35)]" />}
                    {joint.stain === "none" && <span aria-hidden className="relative h-2 w-2 rounded-full bg-zinc-500 shadow-[inset_0_1px_1px_rgba(255,255,255,.25)]" />}
                    {inspected && <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full border border-emerald-200 bg-emerald-500 text-[9px] font-bold text-emerald-950">✓</span>}
                  </button>
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold uppercase tracking-wider ${joint.leak ? "text-sky-200/90" : "text-zinc-400/85"}`}
                    style={{ left: `${joint.x}%`, top: `calc(${joint.y}% + ${joint.y > 65 ? -34 : 27}px)` }}
                  >
                    {joint.short}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Diagnostic d'un rapport bruyant (comparer des signaux animés)       */
/* ------------------------------------------------------------------ */

const NOISY_COUNT = 52;
const shuffleValues = <T,>(values: T[]) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

function noisySamples(faulty: boolean, spike: number, phase: number) {
  return Array.from({ length: NOISY_COUNT }, (_, i) => {
    const t = i / (NOISY_COUNT - 1);
    const base = 0.42 + 0.18 * Math.sin((t + phase) * Math.PI * 5) + 0.07 * Math.sin((t + phase) * Math.PI * 13);
    if (!faulty) return base;
    if (i === spike) return 1;
    if (i === spike + 1) return 0.74;
    if (i === spike - 1) return 0.68;
    return base;
  });
}

function NoisySignal({ faulty, spike, phase, scan }: { faulty: boolean; spike: number; phase: number; scan: number }) {
  const points = noisySamples(faulty, spike, phase)
    .map((value, i) => `${(i / (NOISY_COUNT - 1)) * 100},${(26 - value * 21).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" className="h-11 w-full rounded-md border border-line bg-black/55" aria-hidden>
      <line x1="0" y1="27" x2="100" y2="27" stroke="#3f3f46" strokeWidth=".5" />
      <polyline points={points} fill="none" stroke="#fbbf24" strokeWidth="1.3" strokeLinejoin="round" />
      <line x1={scan} y1="1" x2={scan} y2="29" stroke="#34d399" strokeWidth=".8" strokeOpacity=".65" />
    </svg>
  );
}

function createNoisyRound() {
  return {
    faulty: Math.floor(Math.random() * 5),
    spike: 20 + Math.floor(Math.random() * 16),
  };
}

function NoisyGearDiagnosisGame({ name, onWin, onMiss }: GameProps) {
  const [round] = useState(createNoisyRound);
  const [cleared, setCleared] = useState<boolean[]>([false, false, false, false, false]);
  const [message, setMessage] = useState("Comparez les 5 signaux : l'un produit un à-coup régulier dans sa courbe.");
  const [tone, setTone] = useState<Tone>("idle");
  const tick = useClock(45);
  const scan = (tick * 1.6) % 100;
  const win = useWinOnce(onWin);

  const designate = (index: number) => {
    if (cleared[index]) return;
    if (index === round.faulty) {
      setTone("ok");
      setMessage(`Rapport ${index + 1} : signal irrégulier, roulement ou synchro à contrôler.`);
      win();
      return;
    }
    setCleared((list) => list.map((value, i) => value || i === index));
    setTone("bad");
    setMessage(`Rapport ${index + 1} : signal régulier, ce n'est pas lui.`);
    onMiss();
  };

  return (
    <GameFrame name={name} badge={`${cleared.filter(Boolean).length} / 5 écartés`} message={message} tone={tone}>
      <GameBoard className="p-3">
        <div className="relative z-10 space-y-2">
          <p className="text-center text-[11px] text-zinc-400">
            Objectif : isoler <b className="text-amber-200">1 rapport sur 5</b>. Un signal sain reste lisse ; le rapport bruyant montre un pic net.
          </p>
          {[0, 1, 2, 3, 4].map((index) => {
            const faulty = index === round.faulty;
            return (
              <div
                key={index}
                className={`grid grid-cols-[2.4rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-2 ${
                  cleared[index] ? "border-line bg-black/20 opacity-45" : faulty ? "border-line bg-black/35" : "border-line bg-black/35"
                }`}
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-black/40 font-display text-base font-bold text-zinc-200">{index + 1}</span>
                <div>
                  <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Rapport {index + 1} · signal boîte</span>
                  <NoisySignal faulty={faulty} spike={round.spike} phase={index * 0.09} scan={scan} />
                </div>
                <SmallButton disabled={cleared[index]} onClick={() => designate(index)} className="border-amber-400/30 text-amber-200" aria-label={`Signaler le rapport ${index + 1} comme bruyant`}>
                  Signaler
                </SmallButton>
              </div>
            );
          })}
          <p className="text-center text-[10px] text-zinc-500">La ligne verte balaie les signaux pour faciliter la comparaison. Aucun son n&apos;est nécessaire.</p>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Montage des roulements (associer, orienter le joint)                */
/* ------------------------------------------------------------------ */

const BEARING_TYPES = ["6205", "6207", "6305", "6308"] as const;
type BearingType = (typeof BEARING_TYPES)[number];
const BEARING_LABEL: Record<BearingType, string> = {
  "6205": "Ø 25 mm",
  "6207": "Ø 35 mm",
  "6305": "Ø 25 mm · large",
  "6308": "Ø 40 mm",
};

function BearingArt({ seal = 0 }: { seal?: number }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <circle cx="50" cy="50" r="45" fill="#111318" stroke="#71717a" strokeWidth="2" />
      <circle cx="50" cy="50" r="36" fill="none" stroke="#52525b" strokeWidth="7" />
      <circle cx="50" cy="50" r="30" fill="#1c1f25" stroke="#a1a1aa" strokeWidth="1.2" />
      {Array.from({ length: 9 }, (_, i) => {
        const angle = (i / 9) * Math.PI * 2;
        return <circle key={i} cx={50 + Math.cos(angle) * 25} cy={50 + Math.sin(angle) * 25} r="4.2" fill="#d4d4d8" stroke="#3f3f46" strokeWidth="1" />;
      })}
      <circle cx="50" cy="50" r="17" fill="#0b0c0f" stroke="#a1a1aa" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="8" fill="#27272a" stroke="#71717a" strokeWidth="1" />
      <path d={seal === 0 ? "M13 33 A40 40 0 0 0 13 67" : "M87 33 A40 40 0 0 1 87 67"} fill="none" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 3px rgba(245,158,11,.55))" }} />
    </svg>
  );
}

function createBearingRound() {
  const types = shuffleValues([...BEARING_TYPES]);
  return { types, seals: types.map(() => (Math.random() < 0.5 ? 0 : 1)) };
}

function BearingAssemblyGame({ name, onWin, onMiss }: GameProps) {
  const [round] = useState(createBearingRound);
  const [installed, setInstalled] = useState<({ type: BearingType; seal: number } | null)[]>(() => round.types.map(() => null));
  const [selected, setSelected] = useState<BearingType | null>(null);
  const [message, setMessage] = useState("Choisissez un roulement, puis son poste sur l'arbre : la référence doit correspondre.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);
  const count = installed.filter(Boolean).length;

  const place = (index: number) => {
    if (installed[index]) {
      setMessage("Ce poste est déjà équipé.");
      return;
    }
    if (selected == null) {
      setTone("bad");
      setMessage("Sélectionnez d'abord un roulement dans la réserve.");
      return;
    }
    if (selected !== round.types[index]) {
      setTone("bad");
      setMessage(`Le poste ${index + 1} demande un ${round.types[index]} (${BEARING_LABEL[round.types[index]]}), pas un ${selected}.`);
      onMiss();
      return;
    }
    setInstalled((list) => list.map((entry, i) => (i === index ? { type: selected, seal: 0 } : entry)));
    setSelected(null);
    setTone("ok");
    setMessage(`Roulement ${selected} monté au poste ${index + 1}. Orientez le joint du bon côté.`);
  };

  const flip = (index: number) => {
    setInstalled((list) => list.map((entry, i) => (i === index && entry ? { ...entry, seal: entry.seal === 0 ? 1 : 0 } : entry)));
    setTone("idle");
    setMessage(`Joint du poste ${index + 1} retourné.`);
  };

  const check = () => {
    if (count < 4) {
      setTone("bad");
      setMessage(`Il manque ${4 - count} roulement${4 - count > 1 ? "s" : ""}.`);
      return;
    }
    const wrong = installed.filter((entry, i) => entry != null && entry.seal !== round.seals[i]).length;
    if (wrong > 0) {
      setTone("bad");
      setMessage(`${wrong} joint${wrong > 1 ? "s" : ""} mal orienté${wrong > 1 ? "s" : ""} : le côté orange doit suivre la flèche.`);
      onMiss();
      return;
    }
    setTone("ok");
    setMessage("Roulements montés dans l'ordre et correctement orientés.");
    win();
  };

  return (
    <GameFrame
      name={name}
      badge={`${count} / 4`}
      message={message}
      tone={tone}
      footer={<ActionButton onClick={check} disabled={count < 4}>Contrôler l&apos;arbre</ActionButton>}
    >
      <GameBoard className="p-3">
        <div className="relative z-10 space-y-3">
          <p className="text-center text-[11px] text-zinc-400">Objectif : 4 roulements. Le côté orange du joint doit pointer vers la flèche du poste.</p>
          <div className="relative">
            <span aria-hidden className="absolute inset-x-3 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-zinc-700 via-zinc-500 to-zinc-700" />
            <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-4">
              {round.types.map((type, index) => {
                const entry = installed[index];
                const goodSeal = entry?.seal === round.seals[index];
                return (
                  <div key={index} className="rounded-xl border border-line bg-black/55 p-2">
                    <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                      <span>Poste {index + 1}</span>
                      <span className={goodSeal && entry ? "text-emerald-300" : "text-amber-300"}>{round.seals[index] === 0 ? "◀ joint" : "joint ▶"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => place(index)}
                      aria-label={`Poste ${index + 1}, roulement ${type}${entry ? " monté" : " vide"}`}
                      className={`mt-1 grid aspect-square w-full place-items-center rounded-lg border bg-zinc-950/70 p-1 transition ${
                        entry ? (goodSeal ? "border-emerald-400/50" : "border-amber-400/70") : "border-dashed border-zinc-600 hover:border-amber-300"
                      }`}
                    >
                      <span className="h-full w-full">
                        <BearingArt seal={entry?.seal ?? round.seals[index]} />
                      </span>
                      <span className="mt-1 block text-center font-display text-[11px] font-bold text-zinc-300">{type}</span>
                    </button>
                    {entry ? (
                      <SmallButton onClick={() => flip(index)} className="mt-1 flex w-full items-center justify-center gap-1 py-1.5 text-[10px]">
                        <RotateCw size={12} aria-hidden /> Retourner
                      </SmallButton>
                    ) : (
                      <p className="mt-1 text-center text-[9px] text-zinc-600">{BEARING_LABEL[type]}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Roulements disponibles</p>
            <div className="grid grid-cols-4 gap-2">
              {BEARING_TYPES.map((type) => {
                const used = installed.some((entry) => entry?.type === type);
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={used}
                    aria-pressed={selected === type}
                    onClick={() => {
                      setSelected((value) => (value === type ? null : type));
                      setTone("idle");
                      setMessage(`Roulement ${type} sélectionné : touchez son poste.`);
                    }}
                    className={`rounded-lg border p-1 transition disabled:opacity-30 ${
                      selected === type ? "border-amber-300 bg-amber-500/10" : "border-line bg-black/30 hover:border-zinc-500"
                    }`}
                  >
                    <span className="mx-auto block h-12 w-12"><BearingArt /></span>
                    <span className="block text-[10px] font-bold text-zinc-300">{type}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Réglage du sélecteur (grille, position interdite)                   */
/* ------------------------------------------------------------------ */

type SelectorGear = number | "R";
const SELECTOR_GATE: SelectorGear[][] = [
  [1, 2],
  [3, 4],
  [5, "R"],
];
const selectorGear = (col: number, row: number): SelectorGear | 0 => {
  if (row === 0) return 0;
  return SELECTOR_GATE[col][row < 0 ? 0 : 1];
};

function createSelectorRound() {
  const forbidden = 1 + Math.floor(Math.random() * 5);
  const pool = ([1, 2, 3, 4, 5, "R"] as SelectorGear[]).filter((gear) => gear !== forbidden);
  return { forbidden, targets: shuffleValues(pool).slice(0, 3) };
}

function SelectorGearButton({
  col,
  row,
  gear,
  forbidden,
  target,
  onEngage,
}: {
  col: number;
  row: number;
  gear: SelectorGear | 0;
  forbidden: boolean;
  target: boolean;
  onEngage: (col: number, row: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onEngage(col, row)}
      aria-label={`Rapport ${gear}${forbidden ? ", position interdite" : target ? ", cible" : ""}`}
      className={`absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${
        forbidden
          ? "border-red-500/60 bg-red-500/10 text-red-200 hover:bg-red-500/20"
          : target
            ? "border-amber-300/70 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
            : "border-zinc-600 bg-black/40 text-zinc-200 hover:border-zinc-400"
      }`}
      style={{ left: `${20 + col * 30}%`, top: `${50 + row * 26}%` }}
    >
      {gear}
    </button>
  );
}

function SelectorAdjustmentGame({ name, onWin, onMiss }: GameProps) {
  const [round] = useState(createSelectorRound);
  const [knob, setKnob] = useState({ col: 1, row: 0 });
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Guidez le sélecteur : passez par le point mort et évitez la position barrée en rouge.");
  const [tone, setTone] = useState<Tone>("idle");
  const blocked = useRef(false);
  const win = useWinOnce(onWin);

  const blockedMessage = useCallback(() => {
    if (!blocked.current) {
      blocked.current = true;
      setTone("bad");
      setMessage("Passez par le point mort avant de changer de colonne.");
      onMiss();
    }
  }, [onMiss]);

  const engage = useCallback((col: number, row: number) => {
    if (row !== 0 && knob.row !== 0) {
      blockedMessage();
      return;
    }
    if (col !== knob.col && knob.row !== 0) {
      blockedMessage();
      return;
    }
    blocked.current = false;
    const gear = selectorGear(col, row);
    if (gear !== 0 && gear === round.forbidden) {
      setKnob({ col, row: 0 });
      setTone("bad");
      setMessage(`Position ${gear} interdite : le sélecteur bute et revient au point mort.`);
      onMiss();
      return;
    }
    setKnob({ col, row });
    if (gear === 0) {
      setTone("idle");
      setMessage(`Point mort. Rapport demandé : ${round.targets[progress]}.`);
      return;
    }
    if (gear === round.targets[progress]) {
      const next = progress + 1;
      setProgress(next);
      setTone("ok");
      if (next >= round.targets.length) {
        setMessage("Sélection réglée : tous les rapports passent sans blocage.");
        win();
        return;
      }
      setMessage(`Rapport ${gear} engagé. Prochain : ${round.targets[next]}.`);
      return;
    }
    setTone("bad");
    setMessage(`Rapport ${gear} engagé au lieu du ${round.targets[progress]}. Revenez au point mort.`);
    onMiss();
  }, [blockedMessage, knob.col, knob.row, onMiss, progress, round, win]);

  const move = (dc: number, dr: number) => {
    const col = clamp(knob.col + dc, 0, 2);
    const row = clamp(knob.row + dr, -1, 1);
    if (col === knob.col && row === knob.row) return;
    if (dc !== 0 && knob.row !== 0) {
      blockedMessage();
      return;
    }
    engage(col, row);
  };

  const neutral = () => {
    setKnob({ col: 1, row: 0 });
    blocked.current = false;
    setTone("idle");
    setMessage(`Point mort. Rapport demandé : ${round.targets[progress]}.`);
  };

  const pad = (label: string, dc: number, dr: number, icon: ReactNode) => (
    <SmallButton onClick={() => move(dc, dr)} aria-label={label} className="grid h-11 w-11 place-items-center p-0">
      {icon}
    </SmallButton>
  );

  return (
    <GameFrame name={name} badge={`${progress} / ${round.targets.length}`} message={message} tone={tone}>
      <GameBoard className="p-3">
        <div className="relative z-10 space-y-2">
          <Chips items={round.targets} current={progress} />
          <div className="flex items-center justify-center gap-3">
            <div
              role="application"
              tabIndex={0}
              aria-label="Grille du sélecteur : flèches du clavier pour déplacer"
              onKeyDown={(event) => {
                const map: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
                const direction = map[event.key];
                if (!direction) return;
                event.preventDefault();
                move(direction[0], direction[1]);
              }}
              className="relative aspect-square w-full max-w-[250px] touch-none select-none rounded-xl border border-zinc-700 bg-zinc-900/80 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
                <path d="M20 25 V75 M50 25 V75 M80 25 V75 M20 50 H80" stroke="#52525b" strokeWidth="4" strokeLinecap="round" fill="none" />
                <circle cx={20 + knob.col * 30} cy={50 + knob.row * 26} r="3.4" fill="#f59e0b" stroke="#fde68a" strokeWidth="1.3" />
              </svg>
              {[0, 1, 2].flatMap((col) =>
                [-1, 1].map((row) => {
                  const gear = selectorGear(col, row);
                  return (
                    <SelectorGearButton
                      key={`b${col}-${row}`}
                      col={col}
                      row={row}
                      gear={gear}
                      forbidden={gear === round.forbidden}
                      target={gear === round.targets[progress]}
                      onEngage={engage}
                    />
                  );
                }),
              )}
            </div>
            <div className="grid grid-cols-3 gap-1" role="group" aria-label="Commande du sélecteur">
              <span />
              {pad("Vers l'avant", 0, -1, <ArrowUp size={17} />)}
              <span />
              {pad("À gauche", -1, 0, <ArrowLeft size={17} />)}
              <SmallButton onClick={neutral} aria-label="Revenir au point mort" className="grid h-11 w-11 place-items-center p-0 text-sm">
                N
              </SmallButton>
              {pad("À droite", 1, 0, <ArrowRight size={17} />)}
              <span />
              {pad("Vers l'arrière", 0, 1, <ArrowDown size={17} />)}
              <span />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
            <span className="rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-0.5 text-amber-200">cible</span>
            <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-red-200">interdit</span>
            <span>Rapport engagé : <b className="text-zinc-200">{selectorGear(knob.col, knob.row) || "point mort"}</b></span>
          </div>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Choix de l'huile de boîte (lire les caractéristiques)               */
/* ------------------------------------------------------------------ */

const OIL_VISCOSITIES = ["75W-80", "75W-90", "75W-85", "80W-90"] as const;
const OIL_NORMS = ["GL-4", "GL-5"] as const;
const OIL_SPEC_TEMPS = [140, 160, 180] as const;
type OilSpec = { viscosity: (typeof OIL_VISCOSITIES)[number]; norm: (typeof OIL_NORMS)[number]; temp: number };
type OilOption = OilSpec & { id: string };

function createOilRound() {
  const spec: OilSpec = {
    viscosity: OIL_VISCOSITIES[Math.floor(Math.random() * OIL_VISCOSITIES.length)],
    norm: OIL_NORMS[Math.floor(Math.random() * OIL_NORMS.length)],
    temp: OIL_SPEC_TEMPS[Math.floor(Math.random() * OIL_SPEC_TEMPS.length)],
  };
  const other = <T,>(values: readonly T[], current: T) => values.find((value) => value !== current)!;
  const lowerTemp = spec.temp - 20;
  const candidates: Omit<OilOption, "id">[] = [
    { ...spec },
    { ...spec, viscosity: other(OIL_VISCOSITIES, spec.viscosity) },
    { ...spec, norm: other(OIL_NORMS, spec.norm) },
    { ...spec, temp: lowerTemp },
  ];
  const labels = ["A", "B", "C", "D"];
  const options: OilOption[] = shuffleValues(candidates).map((oil, index) => ({ ...oil, id: labels[index] }));
  return { spec, options };
}

function OilBottle({ active = false, uid }: { active?: boolean; uid: string }) {
  const gradientId = `oil-body-${uid}`;
  return (
    <svg viewBox="0 0 70 102" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={active ? "#b45309" : "#92400e"} />
          <stop offset="45%" stopColor={active ? "#f59e0b" : "#d97706"} />
          <stop offset="100%" stopColor={active ? "#78350f" : "#60300b"} />
        </linearGradient>
      </defs>
      <rect x="24" y="4" width="22" height="12" rx="3" fill="#27272a" stroke="#71717a" strokeWidth="1.3" />
      <path d="M26 16 H44 L50 28 V90 Q50 98 42 98 H28 Q20 98 20 90 V28 Z" fill={`url(#${gradientId})`} stroke="#18181b" strokeWidth="1.4" />
      <rect x="24" y="38" width="22" height="30" rx="3" fill="#f5f5f4" opacity=".92" />
      <path d="M35 45 C31 51 29 54 29 58 A6 6 0 0 0 41 58 C41 54 39 51 35 45 Z" fill="#b45309" />
      <text x="35" y="76" fontSize="6" fontWeight="700" textAnchor="middle" fill="#fde68a">HUILE</text>
      <path d="M24 90 H46" stroke="#fde68a" strokeWidth="1" opacity=".4" />
    </svg>
  );
}

function GearOilChoiceGame({ name, onWin, onMiss }: GameProps) {
  const [round] = useState(createOilRound);
  const [selected, setSelected] = useState<OilOption | null>(null);
  const [message, setMessage] = useState("Lisez les caractéristiques requises, puis sélectionnez l'huile qui les respecte toutes.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);

  const validate = () => {
    if (!selected) return;
    if (selected.viscosity === round.spec.viscosity && selected.norm === round.spec.norm && selected.temp === round.spec.temp) {
      setTone("ok");
      setMessage(`Huile ${selected.id} conforme : la boîte est correctement lubrifiée.`);
      win();
      return;
    }
    const fails: string[] = [];
    if (selected.viscosity !== round.spec.viscosity) fails.push(`viscosité ${selected.viscosity}`);
    if (selected.norm !== round.spec.norm) fails.push(`norme ${selected.norm}`);
    if (selected.temp !== round.spec.temp) fails.push(`température ${selected.temp} °C`);
    setTone("bad");
    setMessage(`Huile ${selected.id} non conforme : ${fails.join(", ")}.`);
    onMiss();
  };

  return (
    <GameFrame
      name={name}
      badge={selected ? `Huile ${selected.id}` : "4 huiles"}
      message={message}
      tone={tone}
      footer={<ActionButton onClick={validate} disabled={selected == null}>Valider l&apos;huile</ActionButton>}
    >
      <GameBoard className="p-3">
        <PartArt src="/cards/boite/_manuelle.webp" opacity={0.1} />
        <div className="relative z-10 space-y-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-[.2em] text-emerald-300">Caractéristiques requises</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <span className="rounded-lg border border-line bg-black/35 px-1 py-1.5"><b className="block text-zinc-400">Viscosité</b><b className="text-emerald-200">{round.spec.viscosity}</b></span>
              <span className="rounded-lg border border-line bg-black/35 px-1 py-1.5"><b className="block text-zinc-400">Norme</b><b className="text-emerald-200">{round.spec.norm}</b></span>
              <span className="rounded-lg border border-line bg-black/35 px-1 py-1.5"><b className="block text-zinc-400">Temp. max ≥</b><b className="text-emerald-200">{round.spec.temp} °C</b></span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {round.options.map((option) => {
              const active = selected?.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSelected(option);
                    setTone("idle");
                    setMessage(`Huile ${option.id} sélectionnée : vérifiez chaque caractéristique avant de valider.`);
                  }}
                  className={`rounded-xl border p-2 text-left transition ${
                    active ? "border-amber-300 bg-amber-500/10" : "border-line bg-black/35 hover:border-zinc-500"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-16 w-11 shrink-0"><OilBottle active={active} uid={option.id} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-sm font-bold text-zinc-100">Huile {option.id}</span>
                      <span className="mt-1 block text-[10px] text-zinc-300">{option.viscosity}</span>
                      <span className="block text-[10px] text-zinc-300">{option.norm} · {option.temp} °C</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="flex items-center justify-center gap-1.5 text-center text-[10px] text-zinc-500">
            <Droplet size={11} aria-hidden /> Une seule huile respecte les trois critères.
          </p>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Contrôle du jeu axial (jauge de tolérance)                          */
/* ------------------------------------------------------------------ */

const AXIAL_MAX = 0.4;
const axialAngle = (value: number) => -120 + (value / AXIAL_MAX) * 240;
const fmtAxial = (value: number) => `${value.toFixed(2).replace(".", ",")} mm`;

function createAxialRound() {
  const low = [0.04, 0.06, 0.08, 0.10, 0.12, 0.14][Math.floor(Math.random() * 6)];
  const high = Math.round((low + 0.05 + Math.random() * 0.06) * 100) / 100;
  const start = Math.random() < 0.5 ? Math.max(0, low - 0.04 - Math.random() * 0.04) : high + 0.04 + Math.random() * 0.05;
  return { low, high, start: Math.round(clamp(start, 0, AXIAL_MAX) * 100) / 100 };
}

function AxialPlayGame({ name, onWin, onMiss }: GameProps) {
  const [round] = useState(createAxialRound);
  const [value, setValue] = useState(round.start);
  const [message, setMessage] = useState("Réglez la position de l'arbre jusqu'à la plage verte de la jauge.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);
  const inBand = value >= round.low && value <= round.high;
  const needle = axialAngle(value);
  const bandFrom = axialAngle(round.low);
  const bandTo = axialAngle(round.high);
  const lowAt = gaugePoint(38, bandFrom);
  const highAt = gaugePoint(38, bandTo);

  const set = (next: number) => {
    setValue(Math.round(clamp(next, 0, AXIAL_MAX) * 100) / 100);
    setTone("idle");
    setMessage("Ajustez finement, puis validez la mesure.");
  };

  const validate = () => {
    if (inBand) {
      setTone("ok");
      setMessage(`Jeu axial ${fmtAxial(value)} : dans la tolérance constructeur.`);
      win();
      return;
    }
    setTone("bad");
    setMessage(value < round.low ? "Jeu axial trop faible : l'arbre est bridé." : "Jeu axial trop important : l'arbre flotte.");
    onMiss();
  };

  return (
    <GameFrame
      name={name}
      badge={fmtAxial(value)}
      message={message}
      tone={tone}
      footer={
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <SmallButton onClick={() => set(value - 0.05)} aria-label="Réduire le jeu de 5 centièmes">−0,05</SmallButton>
            <SmallButton onClick={() => set(value - 0.01)} aria-label="Réduire le jeu de 1 centième">−0,01</SmallButton>
            <span className={`min-w-24 text-center font-display text-lg font-bold tabular-nums ${inBand ? "text-emerald-300" : "text-amber-200"}`}>{fmtAxial(value)}</span>
            <SmallButton onClick={() => set(value + 0.01)} aria-label="Augmenter le jeu de 1 centième">+0,01</SmallButton>
            <SmallButton onClick={() => set(value + 0.05)} aria-label="Augmenter le jeu de 5 centièmes">+0,05</SmallButton>
          </div>
          <input
            type="range"
            min={0}
            max={AXIAL_MAX}
            step={0.01}
            value={value}
            aria-label="Jeu axial mesuré, en millimètres"
            onChange={(event) => set(Number(event.target.value))}
            className="h-8 w-full accent-amber-400"
          />
          <ActionButton onClick={validate}>Valider la mesure</ActionButton>
        </div>
      }
    >
      <GameBoard className="p-3">
        <div className="relative z-10 space-y-2">
          <p className="text-center text-xs font-semibold text-emerald-200">Tolérance : {fmtAxial(round.low)} à {fmtAxial(round.high)}</p>
          <div className="flex items-center gap-2">
            <svg viewBox="-62 -62 124 112" className="w-[58%] max-w-[230px]" role="img" aria-label={`Jauge de jeu axial : ${fmtAxial(value)}, plage ${fmtAxial(round.low)} à ${fmtAxial(round.high)}`}>
              <defs>
                <linearGradient id="axial-bezel" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e4e4e7" />
                  <stop offset="30%" stopColor="#71717a" />
                  <stop offset="58%" stopColor="#27272a" />
                  <stop offset="82%" stopColor="#a1a1aa" />
                  <stop offset="100%" stopColor="#3f3f46" />
                </linearGradient>
                <radialGradient id="axial-face" cx="42%" cy="34%" r="72%">
                  <stop offset="0%" stopColor="#26262c" />
                  <stop offset="100%" stopColor="#0b0b0e" />
                </radialGradient>
              </defs>
              <circle r="57" fill="#000000" opacity=".45" />
              <circle r="55" fill="url(#axial-face)" stroke="url(#axial-bezel)" strokeWidth="5.5" />
              <path d={gaugeArc(45, -120, 120)} fill="none" stroke="#3f3f46" strokeWidth="6" strokeLinecap="round" />
              <path d={gaugeArc(45, bandFrom, bandTo)} fill="none" stroke="#34d399" strokeWidth="6" style={{ filter: "drop-shadow(0 0 4px rgba(52,211,153,.6))" }} />
              {Array.from({ length: 9 }, (_, i) => {
                const v = i * 0.05;
                const deg = axialAngle(v);
                const outer = gaugePoint(50, deg);
                const inner = gaugePoint(i % 2 === 0 ? 40 : 43, deg);
                return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={i % 2 === 0 ? "#d4d4d8" : "#71717a"} strokeWidth={i % 2 === 0 ? 1 : .5} strokeLinecap="round" />;
              })}
              <text x={lowAt.x} y={lowAt.y} fontSize="4.4" fill="#6ee7b7" textAnchor="middle">{round.low.toFixed(2)}</text>
              <text x={highAt.x} y={highAt.y} fontSize="4.4" fill="#6ee7b7" textAnchor="middle">{round.high.toFixed(2)}</text>
              <g transform={`rotate(${needle})`} style={{ filter: `drop-shadow(0 0 4px ${inBand ? "rgba(52,211,153,.8)" : "rgba(251,191,36,.55)"})` }}>
                <path d="M0 2 L-2.6 -31 L0 -39 L2.6 -31 Z" fill={inBand ? "#6ee7b7" : "#fbbf24"} />
              </g>
              <circle r="7" fill="#27272a" stroke="url(#axial-bezel)" strokeWidth="1.2" />
              <circle r="2.5" fill="#111114" stroke="#71717a" strokeWidth=".7" />
              <rect x="-36" y="22" width="72" height="22" rx="6" fill="#09090b" stroke={inBand ? "#34d399" : "#3f3f46"} />
              <text y="38" fontSize="12" fontWeight="700" fill={inBand ? "#6ee7b7" : "#fde68a"} textAnchor="middle">{fmtAxial(value)}</text>
              <text y="50" fontSize="4" letterSpacing="1.5" textAnchor="middle" fill="#71717a">JEU AXIAL</text>
            </svg>
            <svg viewBox="0 0 120 100" className="w-[40%] max-w-[150px]" role="img" aria-label={`Arbre déplacé de ${fmtAxial(value)}`}>
              <ellipse cx="60" cy="88" rx="50" ry="7" fill="#000" opacity=".45" />
              <rect x="10" y="30" width="100" height="36" rx="8" fill="#1b1d22" stroke="#52525b" strokeWidth="1.4" />
              <g transform={`translate(${(value / AXIAL_MAX) * 26} 0)`}>
                <rect x="18" y="38" width="76" height="20" rx="4" fill="#3f3f46" stroke="#a1a1aa" strokeWidth="1.2" />
                <rect x="78" y="34" width="14" height="28" rx="3" fill="#71717a" stroke="#d4d4d8" strokeWidth="1" />
                <circle cx="34" cy="48" r="8" fill="#27272a" stroke="#a1a1aa" strokeWidth="1.2" />
              </g>
              <path d="M35 24 H78" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" markerEnd="url(#axial-arrow)" />
              <defs>
                <marker id="axial-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                  <path d="M0 0 L10 5 L0 10 Z" fill="#fbbf24" />
                </marker>
              </defs>
              <text x="60" y="19" fontSize="5.4" textAnchor="middle" fill="#fde68a">DÉPLACEMENT</text>
            </svg>
          </div>
          <p className="text-center text-[10px] text-zinc-500">Déplacez l&apos;arbre au centième de millimètre. La cible est matérialisée en vert.</p>
        </div>
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
  noisyGear: NoisyGearDiagnosisGame,
  bearings: BearingAssemblyGame,
  selector: SelectorAdjustmentGame,
  gearOil: GearOilChoiceGame,
  axialPlay: AxialPlayGame,
} satisfies Record<string, ComponentType<GameProps>>;

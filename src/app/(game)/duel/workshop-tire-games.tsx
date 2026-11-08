"use client";

/** Mini-jeux pneus : carcasse, équilibrage, sculpture, crevaison, profondeur, gonflage. */

import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Eraser, RotateCcw, RotateCw } from "lucide-react";
import {
  ActionButton,
  GameBoard,
  GameFrame,
  ProbeBoard,
  Rotary,
  SmallButton,
  clamp,
  norm360,
  useClock,
  useWinOnce,
  type GameProps,
  type Point,
  type Tone,
} from "./workshop-kit";
import { TireFace } from "./workshop-tire-art";

const polar = (cx: number, cy: number, radius: number, deg: number) => ({
  x: cx + radius * Math.sin((deg * Math.PI) / 180),
  y: cy - radius * Math.cos((deg * Math.PI) / 180),
});

const fmtBar = (value: number) => `${value.toFixed(2).replace(".", ",")} bar`;
const fmtDepth = (value: number) => `${value.toFixed(1).replace(".", ",")} mm`;

/* ------------------------------------------------------------------ */
/* Inspection de carcasse (faire tourner, qualifier les défauts)       */
/* ------------------------------------------------------------------ */

type DefectKind = "cut" | "bulge" | "object";
const DEFECT_LABEL: Record<DefectKind, string> = { cut: "Coupure", bulge: "Hernie", object: "Objet incrusté" };
function createDefects(): { angle: number; kind: DefectKind }[] {
  const positions = Array.from({ length: 8 }, (_, index) => index * 45);
  const count = 3 + Math.floor(Math.random() * 4);
  const kinds: DefectKind[] = ["cut", "bulge", "object"];
  const extras: DefectKind[] = ["cut", "bulge", "object"];
  for (let i = positions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  for (let i = kinds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  for (let i = extras.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [extras[i], extras[j]] = [extras[j], extras[i]];
  }
  kinds.push(...extras.slice(0, count - kinds.length));
  for (let i = kinds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  return positions.slice(0, count).map((angle, index) => ({ angle, kind: kinds[index] }));
}
const LENS_TOLERANCE = 16;

function DefectIcon({ kind }: { kind: DefectKind }) {
  if (kind === "cut") return <path d="M-6 -6 L6 6 M-2 -7 L8 3" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />;
  if (kind === "bulge") return <><circle r="8" fill="rgba(251,191,36,.25)" stroke="#fbbf24" strokeWidth="2" /><circle r="3.5" fill="none" stroke="#fde68a" strokeWidth="1.2" /></>;
  return <><path d="M-7 7 L5 -5" stroke="#d4d4d8" strokeWidth="2.4" strokeLinecap="round" /><circle cx="6.5" cy="-6.5" r="3" fill="#a1a1aa" stroke="#e4e4e7" /></>;
}

function CarcassInspectionGame({ name, onWin, onMiss }: GameProps) {
  const [defects] = useState(createDefects);
  const [angle, setAngle] = useState(() => norm360(-defects[0].angle));
  const [tagged, setTagged] = useState<boolean[]>(() => defects.map(() => false));
  const [message, setMessage] = useState("Faites tourner le pneu : amenez un défaut sous la loupe, puis qualifiez-le.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);

  const underLens = defects.findIndex((defect) => Math.abs(norm360(defect.angle + angle + 180) - 180) <= LENS_TOLERANCE);

  const qualify = (kind: DefectKind) => {
    if (underLens < 0) {
      setTone("bad");
      setMessage("Rien sous la loupe : tournez le pneu jusqu'à un défaut.");
      onMiss();
      return;
    }
    if (tagged[underLens]) {
      setTone("idle");
      setMessage("Ce défaut est déjà signalé.");
      return;
    }
    if (defects[underLens].kind !== kind) {
      setTone("bad");
      setMessage(`Ce n'est pas : ${DEFECT_LABEL[kind].toLowerCase()}. Observez sa forme.`);
      onMiss();
      return;
    }
    const next = tagged.map((value, i) => value || i === underLens);
    setTagged(next);
    setTone("ok");
    if (next.every(Boolean)) {
      setMessage("Carcasse inspectée : tous les défauts sont relevés.");
      win();
      return;
    }
    setMessage(`Défaut signalé (${DEFECT_LABEL[kind].toLowerCase()}). Encore ${next.filter((v) => !v).length}.`);
  };

  const spin = (delta: number) => setAngle((value) => norm360(Math.round((value + delta) / 5) * 5));

  return (
    <GameFrame
      name={name}
      badge={`${tagged.filter(Boolean).length} / ${defects.length}`}
      message={message}
      tone={tone}
      footer={
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <SmallButton onClick={() => spin(-15)} aria-label="Tourner le pneu à gauche"><RotateCcw size={18} className="mx-auto" /></SmallButton>
            <span className="text-xs text-zinc-500">{underLens >= 0 ? "Défaut sous la loupe" : "Glissez ou utilisez les flèches"}</span>
            <SmallButton onClick={() => spin(15)} aria-label="Tourner le pneu à droite"><RotateCw size={18} className="mx-auto" /></SmallButton>
          </div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Qualifier le défaut sous la loupe">
            {(Object.keys(DEFECT_LABEL) as DefectKind[]).map((kind) => (
              <SmallButton key={kind} onClick={() => qualify(kind)} className="border-amber-400/30 text-amber-200">
                {DEFECT_LABEL[kind]}
              </SmallButton>
            ))}
          </div>
        </div>
      }
    >
      <GameBoard className="p-2">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(251,191,36,.10),transparent_62%)]" />
        <Rotary angle={angle} onChange={(value) => setAngle(norm360(Math.round(value / 5) * 5))} label="Pneu : faire tourner" step={15} className="relative mx-auto aspect-square w-full max-w-[380px]">
          <div className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
            <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
              <TireFace variant="worn" size={88} />
              {defects.map((defect, i) => {
                const at = polar(100, 100, 80, defect.angle);
                return (
                  <g key={i} transform={`translate(${at.x} ${at.y}) rotate(${defect.angle})`} opacity={tagged[i] ? 0.55 : 1}>
                    <circle r="12" fill="rgba(9,9,11,.58)" stroke={tagged[i] ? "#34d399" : "rgba(255,255,255,.22)"} strokeWidth="1" />
                    <DefectIcon kind={defect.kind} />
                    {tagged[i] && <circle r="14" fill="none" stroke="#34d399" strokeWidth="1.8" strokeDasharray="3 2" />}
                  </g>
                );
              })}
            </svg>
          </div>
          <svg viewBox="0 0 200 200" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <ellipse cx="100" cy="192" rx="56" ry="7" fill="#000000" opacity=".55" />
            <defs>
              <radialGradient id="inspection-glass" cx="38%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity=".2" />
                <stop offset="55%" stopColor="#fbbf24" stopOpacity=".08" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="100" cy="22" r="18" fill="url(#inspection-glass)" stroke={underLens >= 0 ? "#34d399" : "#fbbf24"} strokeWidth="2.4" strokeDasharray="5 4" />
            <circle cx="100" cy="22" r="12" fill="none" stroke={underLens >= 0 ? "#6ee7b7" : "#fde68a"} strokeWidth="1" strokeOpacity=".55" />
            <path d="M100 1 V8 M91 22 H94 M106 22 H109 M100 36 V40" stroke={underLens >= 0 ? "#6ee7b7" : "#fde68a"} strokeWidth="1.5" strokeLinecap="round" />
            <text x="100" y="49" fontSize="5" letterSpacing="1.2" textAnchor="middle" fill={underLens >= 0 ? "#6ee7b7" : "#fde68a"} opacity=".75">LOUPE</text>
          </svg>
        </Rotary>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Équilibrage de roue (placer des masses)                             */
/* ------------------------------------------------------------------ */

const MASS_GRAMS = 5;
const BALANCE_TOL = 3;
const clockHour = (deg: number) => Math.round(norm360(deg) / 30) || 12;

function WheelBalanceGame({ name, onWin, onMiss }: GameProps) {
  const [heavy] = useState(() => ({ angle: Math.floor(Math.random() * 24) * 15, grams: (1 + Math.floor(Math.random() * 4)) * MASS_GRAMS }));
  const massMax = heavy.grams / MASS_GRAMS;
  const [masses, setMasses] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const [message, setMessage] = useState("Le point lourd tire la roue : posez des masses de 5 g du côté opposé.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);

  const vector = [{ angle: heavy.angle, grams: heavy.grams }, ...masses.map((angle) => ({ angle, grams: MASS_GRAMS }))].reduce(
    (total, item) => ({
      x: total.x + item.grams * Math.sin((item.angle * Math.PI) / 180),
      y: total.y - item.grams * Math.cos((item.angle * Math.PI) / 180),
    }),
    { x: 0, y: 0 },
  );
  const residual = Math.hypot(vector.x, vector.y);
  const residualAngle = norm360((Math.atan2(vector.x, -vector.y) * 180) / Math.PI);

  const place = () => {
    if (masses.length >= massMax) {
      setTone("bad");
      setMessage("Plus de masses disponibles : retirez-en une pour la déplacer.");
      return;
    }
    setMasses((list) => [...list, cursor]);
    setTone("idle");
    setMessage(`Masse posée à ${clockHour(cursor)} h.`);
  };

  const test = () => {
    if (residual <= BALANCE_TOL) {
      setTone("ok");
      setMessage("Roue équilibrée : plus de vibration au banc.");
      win();
      return;
    }
    setTone("bad");
    setMessage(`Balourd résiduel ${residual.toFixed(0)} g vers ${clockHour(residualAngle)} h : compensez à l'opposé.`);
    onMiss();
  };

  const setSnapped = (value: number) => setCursor(norm360(Math.round(value / 15) * 15));
  const heavyAt = polar(100, 100, 75, heavy.angle);
  const cursorAt = polar(100, 100, 58, cursor);
  const needle = polar(100, 100, Math.min(44, residual * 2.6), residualAngle);

  return (
    <GameFrame
      name={name}
      badge={`${masses.length} / ${massMax} masses`}
      message={message}
      tone={tone}
      footer={
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <SmallButton onClick={() => setSnapped(cursor - 15)} aria-label="Déplacer le curseur à gauche"><RotateCcw size={18} className="mx-auto" /></SmallButton>
            <SmallButton onClick={place} className="border-amber-400/40 text-amber-200">Poser une masse ({MASS_GRAMS} g)</SmallButton>
            <SmallButton onClick={() => setSnapped(cursor + 15)} aria-label="Déplacer le curseur à droite"><RotateCw size={18} className="mx-auto" /></SmallButton>
            <SmallButton disabled={masses.length === 0} onClick={() => setMasses((list) => list.slice(0, -1))}>
              <Eraser size={14} className="mr-1 inline" aria-hidden />Retirer
            </SmallButton>
          </div>
          <ActionButton onClick={test}>Lancer l&apos;équilibreuse</ActionButton>
        </div>
      }
    >
      <GameBoard className="p-2">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,.08),transparent_66%)]" />
        <Rotary angle={cursor} onChange={setSnapped} label="Position de la masse sur la jante" step={15} className="relative mx-auto aspect-square w-full max-w-[360px]">
          <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <radialGradient id="balance-glow" cx="50%" cy="50%" r="50%">
                <stop offset="62%" stopColor="#fbbf24" stopOpacity="0" />
                <stop offset="88%" stopColor="#fbbf24" stopOpacity=".07" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx="100" cy="188" rx="54" ry="7" fill="#000000" opacity=".55" />
            <TireFace size={86} />
            <circle cx="100" cy="100" r="99" fill="url(#balance-glow)" />
            {Array.from({ length: 12 }, (_, i) => {
              const a = i * 30;
              const outer = polar(100, 100, 98, a);
              const inner = polar(100, 100, i % 3 === 0 ? 90 : 94, a);
              return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={i % 3 === 0 ? "#a1a1aa" : "#52525b"} strokeWidth={i % 3 === 0 ? 1.6 : 1} strokeLinecap="round" />;
            })}
            <g transform={`translate(${heavyAt.x} ${heavyAt.y})`} style={{ filter: "drop-shadow(0 0 5px rgba(248,113,113,.8))" }}>
              <circle r="10" fill="rgba(239,68,68,.32)" stroke="#f87171" strokeWidth="2" />
              <text y="2.6" fontSize="7" fontWeight="700" fill="#fecaca" textAnchor="middle">{heavy.grams}g</text>
            </g>
            {masses.map((angle, i) => {
              const at = polar(100, 100, 58, angle);
              return (
                <g key={i} transform={`translate(${at.x} ${at.y}) rotate(${angle})`} style={{ filter: "drop-shadow(0 0 3px rgba(251,191,36,.55))" }}>
                  <rect x="-6.5" y="-3.5" width="13" height="7" rx="1.6" fill="#fbbf24" stroke="#fde68a" strokeWidth=".9" />
                  <path d="M-4.5 -1.6 H4.5" stroke="#78350f" strokeWidth=".8" opacity=".8" />
                </g>
              );
            })}
            <circle cx={cursorAt.x} cy={cursorAt.y} r="9" fill="none" stroke="#34d399" strokeWidth="2.2" strokeDasharray="4 3" />
            <circle cx={cursorAt.x} cy={cursorAt.y} r="2.2" fill="#6ee7b7" />
            <line x1="100" y1="100" x2={needle.x} y2={needle.y} stroke={residual <= BALANCE_TOL ? "#34d399" : "#f87171"} strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${residual <= BALANCE_TOL ? "rgba(52,211,153,.8)" : "rgba(248,113,113,.7)"})` }} />
            <circle cx="100" cy="100" r="5" fill="#27272a" stroke="#a1a1aa" strokeWidth="1.4" />
            <circle cx="100" cy="100" r="1.8" fill="#0a0a0c" />
          </svg>
        </Rotary>
        <p className="pb-1 text-center text-xs text-zinc-300">
          Point lourd : <b className="text-red-300">{heavy.grams} g à {clockHour(heavy.angle)} h</b> · balourd résiduel : <b className={residual <= BALANCE_TOL ? "text-emerald-300" : "text-amber-200"}>{residual.toFixed(0)} g</b> · tolérance {BALANCE_TOL} g
        </p>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Motif de sculpture (orienter les blocs de gomme)                    */
/* ------------------------------------------------------------------ */

/* 0 vide, 1 vertical, 2 oblique « / », 3 horizontal, 4 oblique « \ ». */
const TREAD_PATTERNS = [
  [2, 2, 4, 4, 1, 0, 0, 1, 4, 4, 2, 2],
  [1, 3, 1, 3, 2, 0, 4, 0, 4, 2, 4, 2],
  [4, 1, 2, 0, 3, 4, 1, 2, 0, 4, 3, 1],
  [0, 2, 0, 4, 4, 1, 3, 2, 1, 0, 4, 3],
  [3, 4, 1, 2, 0, 2, 4, 1, 3, 1, 0, 4],
];
const TREAD_ROT = [0, 0, 45, 90, 135];
const TREAD_NAME = ["vide", "vertical", "oblique droite", "horizontal", "oblique gauche"];

function TreadBlock({ state }: { state: number }) {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
      <rect x=".8" y=".8" width="22.4" height="22.4" rx="4" fill="#1b1b1f" stroke="#3b3b43" strokeWidth=".7" />
      <path d="M3 3.2 H21" stroke="#ffffff" strokeOpacity=".07" strokeWidth=".8" />
      <path d="M2.6 20.8 H21.4" stroke="#000000" strokeOpacity=".5" strokeWidth="1.2" />
      {state === 0 ? (
        <rect x="8" y="4" width="8" height="16" rx="2" fill="#101013" stroke="#4a4a52" strokeDasharray="2 2" />
      ) : (
        <g transform={`rotate(${TREAD_ROT[state]} 12 12)`}>
          <rect x="7.2" y="2.2" width="9.6" height="19.6" rx="2.4" fill="#33333a" stroke="#0c0c0f" strokeWidth="1" />
          <rect x="9" y="4" width="6" height="16" rx="1.8" fill="#16161a" />
          <path d="M9.4 5 V19" stroke="#fbbf24" strokeOpacity=".5" strokeWidth=".7" />
          <path d="M14.6 5 V19" stroke="#ffffff" strokeOpacity=".08" strokeWidth=".7" />
        </g>
      )}
      <rect x=".8" y=".8" width="22.4" height="22.4" rx="4" fill="none" stroke="#000000" strokeOpacity=".55" />
    </svg>
  );
}

function TreadPatternGame({ name, onWin, onMiss }: GameProps) {
  const [target] = useState(() => TREAD_PATTERNS[Math.floor(Math.random() * TREAD_PATTERNS.length)]);
  const [blocks, setBlocks] = useState(() => Array.from({ length: target.length }, () => Math.floor(Math.random() * 5)));
  const [wrong, setWrong] = useState<number[]>([]);
  const [message, setMessage] = useState("Touchez un bloc pour l'orienter : reproduisez le motif de référence.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);
  const good = blocks.filter((value, i) => value === target[i]).length;

  const cycle = (index: number) => {
    setBlocks((list) => list.map((value, i) => (i === index ? (value + 1) % 5 : value)));
    setWrong((list) => list.filter((i) => i !== index));
    setTone("idle");
  };

  const check = () => {
    const bad = blocks.flatMap((value, i) => (value === target[i] ? [] : [i]));
    if (bad.length === 0) {
      setTone("ok");
      setMessage("Sculpture conforme au motif.");
      win();
      return;
    }
    setWrong(bad);
    setTone("bad");
    setMessage(`${bad.length} bloc${bad.length > 1 ? "s" : ""} à corriger (cerclés en rouge).`);
    onMiss();
  };

  return (
    <GameFrame
      name={name}
      badge={`${good} / ${target.length}`}
      message={message}
      tone={tone}
      footer={<ActionButton onClick={check}>Contrôler la sculpture</ActionButton>}
    >
      <GameBoard className="p-2 sm:p-3">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,.10),transparent_60%)]" />
        <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 opacity-[.07]">
          <TireFace size={100} variant="slick" />
        </svg>
        <div className="relative z-10 space-y-2 sm:space-y-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Motif d&apos;usine</p>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">référence</span>
            </div>
            <div className="mx-auto grid max-w-[150px] grid-cols-4 gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-1 sm:max-w-[180px]" role="img" aria-label={`Motif cible : ${target.map((s) => TREAD_NAME[s]).join(", ")}`}>
              {target.map((state, i) => (
                <span key={i} className="aspect-square"><TreadBlock state={state} /></span>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Votre bande</p>
              <span className="text-[10px] font-semibold tabular-nums text-zinc-400">{good} / {target.length} conformes</span>
            </div>
            <div className="mx-auto max-w-[270px] rounded-xl border border-line bg-black/35 p-1.5 sm:max-w-[320px]">
              <div className="grid grid-cols-4 gap-1">
                {blocks.map((state, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => cycle(i)}
                    aria-label={`Bloc ligne ${Math.floor(i / 4) + 1}, colonne ${(i % 4) + 1} : ${TREAD_NAME[state]}`}
                    className={`aspect-square rounded-lg border bg-black/40 transition hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      wrong.includes(i) ? "border-red-400 bg-red-500/10" : "border-line"
                    }`}
                  >
                    <TreadBlock state={state} />
                  </button>
                ))}
              </div>
              <div className="mx-1 mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-800">
                <span className="block h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-300 transition-all" style={{ width: `${(good / target.length) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Réparation de crevaison (repérer, poncer, coller)                   */
/* ------------------------------------------------------------------ */

const PUNCTURE: Point = { x: 76, y: 31 };
const PUNCTURE_TOL = 8;
const PATCH_HOLD_MS = 1500;
const PUNCTURE_STEPS = ["1 Repérer", "2 Poncer", "3 Coller"];

function PunctureRepairGame({ name, onWin, onMiss }: GameProps) {
  const [phase, setPhase] = useState(0);
  const [pos, setPos] = useState<Point>({ x: 38, y: 60 });
  const [sanding, setSanding] = useState(0);
  const [holdMs, setHoldMs] = useState(0);
  const [holding, setHolding] = useState(false);
  const [message, setMessage] = useState("Plongez le pneu : les bulles montent depuis la fuite. Placez le repère à leur source.");
  const [tone, setTone] = useState<Tone>("idle");
  const tick = useClock(240, phase === 0);
  const last = useRef<Point | null>(null);
  const holdRef = useRef(0);
  const win = useWinOnce(onWin);

  useEffect(() => {
    if (!holding) return;
    const timer = window.setInterval(() => {
      holdRef.current += 50;
      setHoldMs(holdRef.current);
      if (holdRef.current >= PATCH_HOLD_MS) {
        window.clearInterval(timer);
        setHolding(false);
        setTone("ok");
        setMessage("Rustine collée : le pneu est de nouveau étanche.");
        win();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [holding, win]);

  const mark = (at: Point = pos) => {
    if (Math.hypot(at.x - PUNCTURE.x, at.y - PUNCTURE.y) > PUNCTURE_TOL) {
      setTone("bad");
      setMessage("Pas de bulles à cet endroit : cherchez où elles naissent.");
      onMiss();
      return;
    }
    setPos(PUNCTURE);
    setPhase(1);
    setTone("ok");
    setMessage("Fuite repérée. Poncez la zone entourée pour préparer le collage.");
  };

  const sand = (amount: number) => {
    setSanding((value) => {
      const next = clamp(value + amount);
      if (next >= 100 && value < 100) {
        setPhase(2);
        setTone("ok");
        setMessage("Zone prête. Maintenez le bouton pour presser la rustine.");
      }
      return next;
    });
  };

  const scrub = (event: ReactPointerEvent<HTMLDivElement>, start: boolean) => {
    if (phase !== 1) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const at = { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
    if (start) {
      event.currentTarget.setPointerCapture(event.pointerId);
      last.current = at;
    }
    const before = last.current;
    last.current = at;
    if (!before) return;
    if (Math.hypot(at.x - PUNCTURE.x, at.y - PUNCTURE.y) > 13) {
      setTone("idle");
      setMessage("Restez sur la zone entourée.");
      return;
    }
    const moved = Math.hypot(at.x - before.x, at.y - before.y);
    if (moved > 0.3) sand(Math.min(12, moved * 2.4));
  };

  const startHold = () => {
    if (holding || phase !== 2) return;
    holdRef.current = 0;
    setHoldMs(0);
    setHolding(true);
    setTone("idle");
    setMessage("Pressez… sans relâcher.");
  };

  const endHold = () => {
    if (!holding) return;
    setHolding(false);
    if (holdRef.current < PATCH_HOLD_MS) {
      holdRef.current = 0;
      setHoldMs(0);
      setTone("bad");
      setMessage("Relâché trop tôt : la colle n'a pas pris. Recommencez.");
      onMiss();
    }
  };

  const holdKey = (event: ReactKeyboardEvent<HTMLButtonElement>, down: boolean) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (down) {
      if (!event.repeat) startHold();
    } else endHold();
  };

  const bubbles = Array.from({ length: 6 }, (_, k) => {
    const age = (tick + k * 2) % 12;
    return {
      x: PUNCTURE.x + Math.sin(k * 2.1 + age * 0.7) * 2.4,
      y: PUNCTURE.y - age * 1.7,
      o: 1 - age / 13,
      r: 0.9 + (k % 3) * 0.35,
    };
  });

  return (
    <GameFrame
      name={name}
      badge={PUNCTURE_STEPS[phase]}
      message={message}
      tone={tone}
      footer={
        phase === 0 ? (
          <ActionButton onClick={() => mark()}>Marquer la fuite ici</ActionButton>
        ) : phase === 1 ? (
          <ActionButton onClick={() => sand(25)}>Poncer (ou frottez la zone)</ActionButton>
        ) : (
          <ActionButton
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              startHold();
            }}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onKeyDown={(event) => holdKey(event, true)}
            onKeyUp={(event) => holdKey(event, false)}
            className={holding ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200" : ""}
          >
            {holding ? `Pressez… ${Math.round((holdMs / PATCH_HOLD_MS) * 100)} %` : "Maintenir la rustine"}
          </ActionButton>
        )
      }
    >
      <GameBoard>
        {phase === 0 ? (
          <ProbeBoard pos={pos} onMove={setPos} onAct={mark} label="Bac d'eau : déplacez le repère avec les flèches, Entrée pour marquer" className="aspect-square w-full">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
              <defs>
                <linearGradient id="puncture-water" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#155e75" stopOpacity=".55" />
                  <stop offset="45%" stopColor="#0e7490" stopOpacity=".38" />
                  <stop offset="100%" stopColor="#082f49" stopOpacity=".75" />
                </linearGradient>
                <linearGradient id="puncture-glass" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e0f2fe" stopOpacity=".14" />
                  <stop offset="45%" stopColor="#e0f2fe" stopOpacity=".02" />
                  <stop offset="100%" stopColor="#e0f2fe" stopOpacity=".08" />
                </linearGradient>
              </defs>
              <rect x="2" y="3" width="96" height="94" rx="5" fill="#071e2a" stroke="#38bdf8" strokeOpacity=".18" strokeWidth=".8" />
              <rect x="5" y="8" width="90" height="86" rx="3" fill="url(#puncture-water)" />
              <path d="M5 13 Q 20 10.5 35 13 T 65 13 T 95 13 V 94 H 5 Z" fill="#0e7490" fillOpacity=".2" />
              <path d="M5 13 Q 20 10.5 35 13 T 65 13 T 95 13" fill="none" stroke="#7dd3fc" strokeOpacity=".45" strokeWidth=".8" />
              <ellipse cx="24" cy="80" rx="20" ry="4" fill="#7dd3fc" opacity=".06" />
              <ellipse cx="74" cy="74" rx="14" ry="3" fill="#7dd3fc" opacity=".05" />
              <TireFace cx={50} cy={52} size={38} />
              <circle cx="50" cy="52" r="38" fill="#0ea5e9" opacity=".13" />
              <rect x="2" y="3" width="96" height="94" rx="5" fill="url(#puncture-glass)" />
              <path d="M8 10 L26 10 L10 88 L6 88 Z" fill="#bae6fd" opacity=".05" />
              <rect x="2" y="3" width="96" height="94" rx="5" fill="none" stroke="#7dd3fc" strokeOpacity=".16" />
              <text x="8" y="7.4" fontSize="2.6" letterSpacing=".8" fill="#7dd3fc" opacity=".6">BAC D&apos;EAU</text>
              {Array.from({ length: 7 }, (_, i) => (
                <line key={i} x1="6" y1={24 + i * 10} x2={i % 2 === 0 ? 9.5 : 8} y2={24 + i * 10} stroke="#7dd3fc" strokeOpacity=".22" strokeWidth=".5" />
              ))}
            </svg>
            {bubbles.map((bubble, i) => (
              <span
                key={i}
                aria-hidden
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-100/70 bg-sky-200/25 shadow-[0_0_6px_rgba(125,211,252,.55)]"
                style={{ left: `${bubble.x}%`, top: `${bubble.y}%`, width: `${bubble.r * 2.4}%`, aspectRatio: "1 / 1", opacity: bubble.o }}
              />
            ))}
            <span aria-hidden className="absolute z-10 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,.45)]" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
              <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200" />
            </span>
          </ProbeBoard>
        ) : (
          <div
            className="relative aspect-square w-full touch-none select-none"
            onPointerDown={(event) => scrub(event, true)}
            onPointerMove={(event) => event.buttons !== 0 && scrub(event, false)}
            onPointerUp={() => (last.current = null)}
            onPointerCancel={() => (last.current = null)}
          >
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
              <defs>
                <radialGradient id="puncture-halo" cx="50%" cy="50%" r="50%">
                  <stop offset="50%" stopColor="#fbbf24" stopOpacity=".02" />
                  <stop offset="84%" stopColor="#fbbf24" stopOpacity=".1" />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                </radialGradient>
              </defs>
              <ellipse cx="50" cy="94" rx="30" ry="3.2" fill="#000000" opacity=".5" />
              <circle cx="50" cy="50" r="49" fill="url(#puncture-halo)" />
              <TireFace cx={50} cy={50} size={44} variant="worn" />
            </svg>
            <span
              aria-hidden
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${phase === 2 ? "border-emerald-400 bg-amber-200/20" : "border-dashed border-amber-300"}`}
              style={{ left: `${PUNCTURE.x}%`, top: `${PUNCTURE.y}%`, width: "26%", aspectRatio: "1 / 1", background: phase === 1 ? `rgba(251,191,36,${0.05 + sanding / 400})` : undefined }}
            />
            {phase === 2 && (
              <span
                aria-hidden
                className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-zinc-300/90 text-[8px] font-bold tracking-widest text-zinc-100 shadow-[0_0_18px_rgba(0,0,0,.6)]"
                style={{
                  left: `${PUNCTURE.x}%`,
                  top: `${PUNCTURE.y}%`,
                  width: `${14 + (holdMs / PATCH_HOLD_MS) * 8}%`,
                  aspectRatio: "1 / 1",
                  background: "radial-gradient(circle at 34% 28%, #5a5a62, #26262b 58%, #111114)",
                }}
              >
                <span className="absolute inset-[12%] rounded-full border border-zinc-500/70" />
                <span className="relative">RUSTINE</span>
              </span>
            )}
          </div>
        )}
      </GameBoard>
      {phase === 1 && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-label="Préparation de la zone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(sanding)}>
          <span className="block h-full rounded-full bg-amber-400" style={{ width: `${sanding}%` }} />
        </div>
      )}
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Contrôle de profondeur (mesurer, décider)                           */
/* ------------------------------------------------------------------ */

const DEPTH_MAX_GAP = 1.5;

function createDepthRounds() {
  const around = (center: number, spread: number) =>
    Math.round((center + (Math.random() * 2 - 1) * spread) * 10) / 10;
  const goodCenter = 3 + Math.random() * 4;
  const lowCenter = 2.5 + Math.random();
  const highCenter = 5.6 + Math.random() * 1.4;
  const rounds = [
    { depths: Array.from({ length: 4 }, () => around(goodCenter, 0.4)), ok: true },
    { depths: [around(lowCenter, 0.2), around(lowCenter, 0.2), around(highCenter, 0.2), around(highCenter, 0.2)], ok: false },
  ];
  return Math.random() < 0.5 ? rounds : rounds.reverse();
}

function DepthCheckGame({ name, onWin, onMiss }: GameProps) {
  const [rounds] = useState(createDepthRounds);
  const [round, setRound] = useState(0);
  const [probes, setProbes] = useState([0, 0, 0, 0]);
  const [groove, setGroove] = useState(0);
  const [message, setMessage] = useState(`Mesurez les 4 rainures. Rechapable si l'écart entre rainures reste ≤ ${fmtDepth(DEPTH_MAX_GAP)}.`);
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);
  const data = rounds[round];
  const measured = data.depths.map((depth, i) => (probes[i] >= depth ? depth : null));
  const allMeasured = measured.every((value) => value != null);
  const gap = Math.max(...data.depths) - Math.min(...data.depths);

  const setProbe = (value: number) => {
    setProbes((list) => list.map((entry, i) => (i === groove ? value : entry)));
    setTone("idle");
    const depth = data.depths[groove];
    setMessage(value >= depth ? `Contact : rainure ${groove + 1} = ${fmtDepth(depth)}.` : "Enfoncez la sonde jusqu'au fond de la rainure.");
  };

  const decide = (retread: boolean) => {
    if (retread !== data.ok) {
      setTone("bad");
      setMessage(`Écart mesuré : ${fmtDepth(gap)}. ${data.ok ? "Inférieur" : "Supérieur"} à ${fmtDepth(DEPTH_MAX_GAP)} : ${data.ok ? "carcasse rechapable" : "usure irrégulière, carcasse à réformer"}.`);
      onMiss();
      return;
    }
    setTone("ok");
    if (round + 1 >= rounds.length) {
      setMessage("Bonnes décisions : le contrôle est terminé.");
      win();
      return;
    }
    setRound(round + 1);
    setProbes([0, 0, 0, 0]);
    setGroove(0);
    setMessage("Décision correcte. Pneu suivant : mesurez ses 4 rainures.");
  };

  const x = (i: number) => 45 + i * 50;

  return (
    <GameFrame
      name={name}
      badge={`Pneu ${round + 1} / ${rounds.length}`}
      message={message}
      tone={tone}
      footer={
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SmallButton disabled={!allMeasured} onClick={() => decide(true)} className="border-emerald-400/40 text-emerald-200">Rechapable</SmallButton>
          <SmallButton disabled={!allMeasured} onClick={() => decide(false)} className="border-red-400/40 text-red-200">À réformer</SmallButton>
        </div>
      }
    >
      <GameBoard className="p-3">
        <div className="relative z-10 space-y-3">
          <svg viewBox="0 0 240 138" className="w-full" role="img" aria-label={message}>
            <defs>
              <linearGradient id="depth-rubber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3a3a42" />
                <stop offset="45%" stopColor="#26262c" />
                <stop offset="100%" stopColor="#151519" />
              </linearGradient>
              <linearGradient id="depth-probe" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#71717a" />
                <stop offset="45%" stopColor="#f4f4f5" />
                <stop offset="100%" stopColor="#52525b" />
              </linearGradient>
              <pattern id="depth-bench" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M0 8 L8 0" stroke="#27272a" strokeWidth=".6" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="240" height="138" fill="url(#depth-bench)" opacity=".45" />
            <ellipse cx="120" cy="120" rx="104" ry="7" fill="#000000" opacity=".55" />
            <path
              d="M24 34 H216 Q226 34 227 46 V96 Q227 109 214 109 H26 Q13 109 13 96 V46 Q14 34 24 34 Z"
              fill="url(#depth-rubber)"
              stroke="#08080a"
              strokeWidth="1.6"
            />
            <rect x="14" y="34" width="212" height="15" fill="#2f2f36" />
            <path d="M14 49 H226" stroke="#101013" strokeWidth="1.2" />
            <path d="M16 82 H224 M16 89 H224 M16 96 H224" stroke="#55555f" strokeWidth="1.4" strokeDasharray="5 2" opacity=".32" />
            <path d="M16 86 H224 M16 93 H224" stroke="#777782" strokeWidth="1" strokeDasharray="2 3" opacity=".28" />
            {data.depths.map((depth, i) => {
              const measuredDepth = measured[i] != null;
              const bottom = 34 + (measuredDepth ? depth * 8 : 12);
              const probeTip = 34 + Math.min(probes[i], depth) * 8;
              const active = groove === i;
              return (
                <g key={i}>
                  {/* rainure */}
                  <rect
                    x={x(i) - 8}
                    y="34"
                    width="16"
                    height={bottom - 34}
                    rx="3"
                    fill="#070709"
                    stroke={active ? "#fbbf24" : "#3d3d46"}
                    strokeWidth={active ? 1.3 : .7}
                  />
                  <path d={`M${x(i) - 6.5} 37 V${bottom - 3}`} stroke="#000000" strokeWidth="2" opacity=".7" />
                  <path d={`M${x(i) + 6.5} 37 V${bottom - 3}`} stroke="#ffffff" strokeWidth=".7" opacity=".07" />
                  {measuredDepth && (
                    <g>
                      <rect x={x(i) - 14} y={bottom + 4} width="28" height="11" rx="3" fill="#052e24" stroke="#34d399" strokeOpacity=".45" />
                      <text x={x(i)} y={bottom + 11.6} fontSize="6.4" fontWeight="700" fill="#6ee7b7" textAnchor="middle">{fmtDepth(depth)}</text>
                    </g>
                  )}
                  {active && (
                    <path
                      d={`M${x(i) - 1.5} 12 V${probeTip - 2}`}
                      stroke={probeTip >= bottom - 0.15 ? "#6ee7b7" : "#fbbf24"}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeDasharray="3 2"
                      opacity=".25"
                    />
                  )}
                </g>
              );
            })}
            {/* blocs de gomme entre les rainures */}
            {[0, 1, 2, 3].map((i) => {
              const from = i === 0 ? 20 : x(i - 1) + 10;
              const to = x(i) - 10;
              return (
                <g key={i} stroke="#17171b" strokeWidth=".8" opacity=".8">
                  <path d={`M${from + 4} 37 V47 M${from + 10} 37 V47 M${to - 4} 37 V47 M${to - 10} 37 V47`} />
                </g>
              );
            })}
            {/* sonde */}
            <g>
              <rect x={x(groove) - 7} y="2" width="14" height="8" rx="2.2" fill="#3f3f46" stroke="#71717a" strokeWidth=".8" />
              <rect x={x(groove) - 1.6} y="10" width="3.2" height={34 + Math.min(probes[groove], data.depths[groove]) * 8 - 10} fill="url(#depth-probe)" />
              <path
                d={`M${x(groove) - 1.6} ${34 + Math.min(probes[groove], data.depths[groove]) * 8} L${x(groove)} ${34 + Math.min(probes[groove], data.depths[groove]) * 8 + 4} L${x(groove) + 1.6} ${34 + Math.min(probes[groove], data.depths[groove]) * 8} Z`}
                fill="#e4e4e7"
              />
              <rect x={x(groove) - 17} y="3" width="7" height="6" rx="1.5" fill="#18181b" stroke="#52525b" strokeWidth=".6" />
              <rect x={x(groove) + 10} y="3" width="7" height="6" rx="1.5" fill="#18181b" stroke="#52525b" strokeWidth=".6" />
            </g>
            <text x="120" y="21" fontSize="5.6" letterSpacing="1.5" textAnchor="middle" fill="#a1a1aa" opacity=".62">BANDE DE ROULEMENT</text>
            <text x="120" y="128" fontSize="5" letterSpacing="1.6" textAnchor="middle" fill="#71717a" opacity=".75">CARCASSE</text>
            <text x="12" y="128" fontSize="4.6" fill="#52525b">RAINURE {groove + 1} / 4</text>
          </svg>
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Rainure à mesurer">
            {data.depths.map((_, i) => (
              <SmallButton key={i} aria-pressed={groove === i} onClick={() => setGroove(i)} className={groove === i ? "border-amber-300 text-amber-200" : ""}>
                Rainure {i + 1}{measured[i] != null ? " ✓" : ""}
              </SmallButton>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={probes[groove]}
            aria-label={`Sonde de la rainure ${groove + 1}, en millimètres`}
            onChange={(event) => setProbe(Number(event.target.value))}
            className="h-8 w-full accent-amber-400"
          />
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Pression de gonflage (régler sans dépasser)                         */
/* ------------------------------------------------------------------ */

const P_BURST = 2.8;
const P_MAX = 4;
const P_STABLE_MS = 1200;

const arc = (r: number, from: number, to: number) => {
  const a = polar(0, 0, r, from);
  const b = polar(0, 0, r, to);
  return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};
const pressureAngle = (value: number) => -120 + (value / P_MAX) * 240;

function InflationGame({ name, onWin, onMiss }: GameProps) {
  const [targetZone] = useState<[number, number]>(() => {
    const low = 1.4 + Math.floor(Math.random() * 11) / 10;
    return [low, low + 0.2];
  });
  const [pressure, setPressure] = useState(1.2);
  const [stable, setStable] = useState(0);
  const [holding, setHolding] = useState(false);
  const [message, setMessage] = useState("Gonflez par à-coups jusqu'à la zone verte, sans dépasser la zone rouge, puis tenez 1 seconde.");
  const [tone, setTone] = useState<Tone>("idle");
  const pressureRef = useRef(1.2);
  const stableRef = useRef(0);
  const holdingRef = useRef(false);
  const missRef = useRef(onMiss);
  const win = useWinOnce(onWin);

  useEffect(() => {
    missRef.current = onMiss;
  }, [onMiss]);

  const apply = (value: number) => {
    let next = clamp(value, 0, P_MAX);
    if (next >= P_BURST) {
      next = 1.4;
      stableRef.current = 0;
      holdingRef.current = false;
      setHolding(false);
      setStable(0);
      setTone("bad");
      setMessage("Surpression ! La soupape a lâché : on repart de 1,4 bar.");
      missRef.current();
    }
    pressureRef.current = next;
    setPressure(next);
  };

  useEffect(() => {
    if (!holding) return;
    const timer = window.setInterval(() => apply(pressureRef.current + 0.02), 50);
    return () => window.clearInterval(timer);
  }, [holding]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const inZone = pressureRef.current >= targetZone[0] && pressureRef.current <= targetZone[1];
      stableRef.current = inZone ? stableRef.current + 100 : 0;
      setStable(stableRef.current);
      if (stableRef.current >= P_STABLE_MS) {
        window.clearInterval(timer);
        holdingRef.current = false;
        setHolding(false);
        setTone("ok");
        setMessage(`Pression réglée à ${fmtBar(pressureRef.current)}.`);
        win();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [targetZone, win]);

  const start = () => {
    if (holdingRef.current) return;
    holdingRef.current = true;
    setHolding(true);
    setTone("idle");
    setMessage("Gonflage…");
  };
  const stop = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHolding(false);
    setMessage(pressureRef.current < targetZone[0] ? "Pression encore trop basse." : pressureRef.current > targetZone[1] ? "Trop haut : purgez un peu." : "Dans la zone : ne touchez plus à rien.");
  };

  const inZone = pressure >= targetZone[0] && pressure <= targetZone[1];
  const nudge = (delta: number) => {
    setTone("idle");
    apply(pressureRef.current + delta);
  };

  return (
    <GameFrame
      name={name}
      badge={`${Math.min(stable, P_STABLE_MS) / 1000 < 0.05 ? "0,0" : (Math.min(stable, P_STABLE_MS) / 1000).toFixed(1).replace(".", ",")} s / 1,2 s`}
      message={message}
      tone={tone}
      footer={
        <div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <SmallButton onClick={() => nudge(-0.1)} aria-label="Purger 0,1 bar">Purger −0,10</SmallButton>
            <SmallButton onClick={() => nudge(-0.02)} aria-label="Purger 0,02 bar">−0,02</SmallButton>
            <SmallButton onClick={() => nudge(0.02)} aria-label="Gonfler de 0,02 bar">+0,02</SmallButton>
          </div>
          <ActionButton
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              start();
            }}
            onPointerUp={stop}
            onPointerCancel={stop}
            onKeyDown={(event) => {
              if (event.key !== " " && event.key !== "Enter") return;
              event.preventDefault();
              if (!event.repeat) start();
            }}
            onKeyUp={(event) => {
              if (event.key !== " " && event.key !== "Enter") return;
              event.preventDefault();
              stop();
            }}
            className={holding ? "border-sky-400/60 bg-sky-500/10 text-sky-200" : ""}
          >
            {holding ? "Gonflage en cours…" : "Maintenir pour gonfler"}
          </ActionButton>
        </div>
      }
    >
      <GameBoard className="p-3">
        <p className="relative z-10 mb-1 text-center text-xs font-semibold text-emerald-200">Pression optimale : {fmtBar(targetZone[0])} à {fmtBar(targetZone[1])}</p>
        <svg viewBox="-70 -70 140 124" className="relative z-10 mx-auto w-full max-w-[320px]" role="img" aria-label={`Manomètre : ${fmtBar(pressure)}, zone cible ${fmtBar(targetZone[0])} à ${fmtBar(targetZone[1])}`}>
          <defs>
            <linearGradient id="gauge-bezel" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e4e4e7" />
              <stop offset="28%" stopColor="#71717a" />
              <stop offset="52%" stopColor="#27272a" />
              <stop offset="74%" stopColor="#a1a1aa" />
              <stop offset="100%" stopColor="#3f3f46" />
            </linearGradient>
            <radialGradient id="gauge-face" cx="42%" cy="34%" r="70%">
              <stop offset="0%" stopColor="#26262c" />
              <stop offset="100%" stopColor="#0b0b0e" />
            </radialGradient>
            <radialGradient id="gauge-glow" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#34d399" stopOpacity="0" />
              <stop offset="88%" stopColor="#34d399" stopOpacity={inZone ? ".22" : "0"} />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle r="59" fill="#000000" opacity=".45" />
          <circle r="57" fill="#0c0d10" stroke="url(#gauge-bezel)" strokeWidth="6.5" />
          <circle r="51" fill="url(#gauge-face)" stroke="#2b2e34" strokeWidth=".8" />
          <circle r="51" fill="url(#gauge-glow)" />
          <path d={arc(46, -120, 120)} fill="none" stroke="#3f3f46" strokeWidth="6.5" strokeLinecap="round" />
          <path d={arc(46, pressureAngle(targetZone[0]), pressureAngle(targetZone[1]))} fill="none" stroke="#34d399" strokeWidth="6.5" strokeLinecap="butt" style={{ filter: "drop-shadow(0 0 3px rgba(52,211,153,.55))" }} />
          <path d={arc(46, pressureAngle(P_BURST), 120)} fill="none" stroke="#ef4444" strokeWidth="6.5" strokeLinecap="round" />
          {Array.from({ length: 21 }, (_, i) => {
            const value = i * 0.2;
            const angle = pressureAngle(value);
            const outer = polar(0, 0, 51.5, angle);
            const inner = polar(0, 0, i % 5 === 0 ? 38.5 : 41.5, angle);
            return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={i % 5 === 0 ? "#d4d4d8" : "#71717a"} strokeWidth={i % 5 === 0 ? 1.1 : .55} strokeLinecap="round" />;
          })}
          {[0, 1, 2, 3, 4].map((value) => {
            const at = polar(0, 0, 32, pressureAngle(value));
            return <text key={value} x={at.x} y={at.y + 2} fontSize="5.6" fontWeight="700" fill="#a1a1aa" textAnchor="middle">{value}</text>;
          })}
          <g transform={`rotate(${pressureAngle(pressure)})`} style={{ filter: `drop-shadow(0 0 3px ${inZone ? "rgba(52,211,153,.7)" : "rgba(251,191,36,.55)"})` }}>
            <path d="M0 3 L-2.8 -31 L0 -41 L2.8 -31 Z" fill={inZone ? "#6ee7b7" : "#fbbf24"} />
            <path d="M0 0 L-1.1 -30 L0 -38 Z" fill="#ffffff" opacity=".3" />
          </g>
          <circle r="8" fill="#27272a" stroke="url(#gauge-bezel)" strokeWidth="1.4" />
          <circle r="3" fill="#111114" stroke="#71717a" strokeWidth=".8" />
          <rect x="-30" y="22" width="60" height="23" rx="6" fill="#09090b" stroke={inZone ? "#34d399" : "#3f3f46"} strokeWidth="1" />
          <text y="38" fontSize="12" fontWeight="700" fill={inZone ? "#6ee7b7" : "#fde68a"} textAnchor="middle">{fmtBar(pressure)}</text>
          <text y="49" fontSize="4" letterSpacing="1.6" textAnchor="middle" fill="#71717a">PRESSION</text>
          <text x="-53" y="50" fontSize="4.4" fill="#52525b" textAnchor="middle">MIN</text>
          <text x="53" y="50" fontSize="4.4" fill="#ef4444" textAnchor="middle">MAX</text>
        </svg>
      </GameBoard>
    </GameFrame>
  );
}

export const TIRE_GAMES = {
  carcass: CarcassInspectionGame,
  balance: WheelBalanceGame,
  tread: TreadPatternGame,
  puncture: PunctureRepairGame,
  depth: DepthCheckGame,
  inflation: InflationGame,
} satisfies Record<string, ComponentType<GameProps>>;

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
const DEFECTS: { angle: number; kind: DefectKind }[] = [
  { angle: 40, kind: "cut" },
  { angle: 130, kind: "bulge" },
  { angle: 215, kind: "object" },
  { angle: 305, kind: "cut" },
];
const LENS_TOLERANCE = 16;

function DefectIcon({ kind }: { kind: DefectKind }) {
  if (kind === "cut") return <path d="M-6 -6 L6 6 M-2 -7 L8 3" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />;
  if (kind === "bulge") return <><circle r="8" fill="rgba(251,191,36,.25)" stroke="#fbbf24" strokeWidth="2" /><circle r="3.5" fill="none" stroke="#fde68a" strokeWidth="1.2" /></>;
  return <><path d="M-7 7 L5 -5" stroke="#d4d4d8" strokeWidth="2.4" strokeLinecap="round" /><circle cx="6.5" cy="-6.5" r="3" fill="#a1a1aa" stroke="#e4e4e7" /></>;
}

function CarcassInspectionGame({ name, onWin, onMiss }: GameProps) {
  const [angle, setAngle] = useState(0);
  const [tagged, setTagged] = useState<boolean[]>([false, false, false, false]);
  const [message, setMessage] = useState("Faites tourner le pneu : amenez un défaut sous la loupe, puis qualifiez-le.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);

  const underLens = DEFECTS.findIndex((defect) => Math.abs(norm360(defect.angle + angle + 180) - 180) <= LENS_TOLERANCE);

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
    if (DEFECTS[underLens].kind !== kind) {
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
      badge={`${tagged.filter(Boolean).length} / ${DEFECTS.length}`}
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
        <Rotary angle={angle} onChange={(value) => setAngle(norm360(Math.round(value / 5) * 5))} label="Pneu : faire tourner" step={15} className="relative mx-auto aspect-square w-full max-w-[380px]">
          <div className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
            <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
              {Array.from({ length: 24 }, (_, i) => {
                const a = polar(100, 100, 94, i * 15);
                const b = polar(100, 100, 89, i * 15);
                return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#71717a" strokeWidth={i % 6 === 0 ? 2 : 1} />;
              })}
              {DEFECTS.map((defect, i) => {
                const at = polar(100, 100, 74, defect.angle);
                return (
                  <g key={i} transform={`translate(${at.x} ${at.y}) rotate(${defect.angle})`} opacity={tagged[i] ? 0.45 : 1}>
                    <DefectIcon kind={defect.kind} />
                    {tagged[i] && <circle r="11" fill="none" stroke="#34d399" strokeWidth="2" />}
                  </g>
                );
              })}
            </svg>
          </div>
          <svg viewBox="0 0 200 200" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <circle cx="100" cy="26" r="21" fill="none" stroke={underLens >= 0 ? "#34d399" : "#fbbf24"} strokeWidth="2.5" strokeDasharray="5 4" />
            <path d="M100 2 L100 -4" stroke="#fbbf24" />
          </svg>
        </Rotary>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Équilibrage de roue (placer des masses)                             */
/* ------------------------------------------------------------------ */

const HEAVY = { angle: 75, grams: 20 };
const MASS_GRAMS = 5;
const MASS_MAX = 4;
const BALANCE_TOL = 3;
const clockHour = (deg: number) => Math.round(norm360(deg) / 30) || 12;

function WheelBalanceGame({ name, onWin, onMiss }: GameProps) {
  const [masses, setMasses] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const [message, setMessage] = useState("Le point lourd tire la roue : posez des masses de 5 g du côté opposé.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);

  const vector = [{ angle: HEAVY.angle, grams: HEAVY.grams }, ...masses.map((angle) => ({ angle, grams: MASS_GRAMS }))].reduce(
    (total, item) => ({
      x: total.x + item.grams * Math.sin((item.angle * Math.PI) / 180),
      y: total.y - item.grams * Math.cos((item.angle * Math.PI) / 180),
    }),
    { x: 0, y: 0 },
  );
  const residual = Math.hypot(vector.x, vector.y);
  const residualAngle = norm360((Math.atan2(vector.x, -vector.y) * 180) / Math.PI);

  const place = () => {
    if (masses.length >= MASS_MAX) {
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
  const heavyAt = polar(100, 100, 72, HEAVY.angle);
  const cursorAt = polar(100, 100, 72, cursor);
  const needle = polar(100, 100, Math.min(60, residual * 3.2), residualAngle);

  return (
    <GameFrame
      name={name}
      badge={`${masses.length} / ${MASS_MAX} masses`}
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
        <Rotary angle={cursor} onChange={setSnapped} label="Position de la masse sur la jante" step={15} className="relative mx-auto aspect-square w-full max-w-[360px]">
          <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
            <circle cx="100" cy="100" r="55" fill="rgba(9,9,11,.82)" stroke="#52525b" strokeWidth="2" />
            <circle cx="100" cy="100" r="72" fill="none" stroke="#3f3f46" strokeDasharray="2 6" />
            <circle cx={heavyAt.x} cy={heavyAt.y} r="11" fill="rgba(239,68,68,.35)" stroke="#f87171" strokeWidth="2" />
            <text x={heavyAt.x} y={heavyAt.y + 3.5} fontSize="9" fontWeight="700" fill="#fecaca" textAnchor="middle">20g</text>
            {masses.map((angle, i) => {
              const at = polar(100, 100, 72, angle);
              return <rect key={i} x={at.x - 6} y={at.y - 5} width="12" height="10" rx="2" fill="#fbbf24" stroke="#fde68a" transform={`rotate(${angle} ${at.x} ${at.y})`} />;
            })}
            <circle cx={cursorAt.x} cy={cursorAt.y} r="10" fill="none" stroke="#34d399" strokeWidth="2.2" strokeDasharray="4 3" />
            <line x1="100" y1="100" x2={needle.x} y2={needle.y} stroke={residual <= BALANCE_TOL ? "#34d399" : "#f87171"} strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="100" r="4" fill="#e4e4e7" />
          </svg>
        </Rotary>
        <p className="pb-1 text-center text-xs text-zinc-300">
          Balourd résiduel : <b className={residual <= BALANCE_TOL ? "text-emerald-300" : "text-amber-200"}>{residual.toFixed(0)} g</b> · tolérance {BALANCE_TOL} g
        </p>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Motif de sculpture (orienter les blocs de gomme)                    */
/* ------------------------------------------------------------------ */

/* 0 vide, 1 vertical, 2 oblique « / », 3 horizontal, 4 oblique « \ ». */
const TREAD_TARGET = [2, 2, 4, 4, 1, 0, 0, 1, 4, 4, 2, 2];
const TREAD_START = [1, 3, 0, 2, 0, 2, 3, 4, 1, 0, 4, 3];
const TREAD_ROT = [0, 0, 45, 90, 135];
const TREAD_NAME = ["vide", "vertical", "oblique droite", "horizontal", "oblique gauche"];

function TreadBlock({ state }: { state: number }) {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden>
      {state === 0 ? (
        <rect x="8" y="4" width="8" height="16" rx="2" fill="none" stroke="#52525b" strokeDasharray="2 2" />
      ) : (
        <rect x="8" y="3" width="8" height="18" rx="2.5" fill="#27272a" stroke="#fbbf24" strokeWidth="1.2" transform={`rotate(${TREAD_ROT[state]} 12 12)`} />
      )}
    </svg>
  );
}

function TreadPatternGame({ name, onWin, onMiss }: GameProps) {
  const [blocks, setBlocks] = useState(TREAD_START);
  const [wrong, setWrong] = useState<number[]>([]);
  const [message, setMessage] = useState("Touchez un bloc pour l'orienter : reproduisez le motif de référence.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);
  const good = blocks.filter((value, i) => value === TREAD_TARGET[i]).length;

  const cycle = (index: number) => {
    setBlocks((list) => list.map((value, i) => (i === index ? (value + 1) % 5 : value)));
    setWrong((list) => list.filter((i) => i !== index));
    setTone("idle");
  };

  const check = () => {
    const bad = blocks.flatMap((value, i) => (value === TREAD_TARGET[i] ? [] : [i]));
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
      badge={`${good} / ${TREAD_TARGET.length}`}
      message={message}
      tone={tone}
      footer={<ActionButton onClick={check}>Contrôler la sculpture</ActionButton>}
    >
      <GameBoard className="p-3">
        <div className="relative z-10 space-y-3">
          <div>
            <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Motif de référence</p>
            <div className="mx-auto grid max-w-[180px] grid-cols-4 gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-1" role="img" aria-label={`Motif cible : ${TREAD_TARGET.map((s) => TREAD_NAME[s]).join(", ")}`}>
              {TREAD_TARGET.map((state, i) => (
                <span key={i} className="aspect-square"><TreadBlock state={state} /></span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Votre bande</p>
            <div className="mx-auto grid max-w-[320px] grid-cols-4 gap-1.5">
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
          </div>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Réparation de crevaison (repérer, poncer, coller)                   */
/* ------------------------------------------------------------------ */

const PUNCTURE: Point = { x: 63, y: 36 };
const PUNCTURE_TOL = 8;
const PATCH_HOLD_MS = 1500;
const PUNCTURE_STEPS = ["1 Repérer", "2 Poncer", "3 Coller"];

function PunctureRepairGame({ name, onWin, onMiss }: GameProps) {
  const [phase, setPhase] = useState(0);
  const [pos, setPos] = useState<Point>({ x: 38, y: 62 });
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
    return { x: PUNCTURE.x + Math.sin(k * 2.1 + age * 0.7) * 2.2, y: PUNCTURE.y - age * 2.4, o: 1 - age / 12 };
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
            <div aria-hidden className="absolute inset-0 bg-sky-500/20" />
            {bubbles.map((bubble, i) => (
              <span key={i} aria-hidden className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-100/80 bg-sky-200/30" style={{ left: `${bubble.x}%`, top: `${bubble.y}%`, opacity: bubble.o }} />
            ))}
            <span aria-hidden className="absolute z-10 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
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
            <span
              aria-hidden
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${phase === 2 ? "border-emerald-400 bg-amber-200/20" : "border-dashed border-amber-300"}`}
              style={{ left: `${PUNCTURE.x}%`, top: `${PUNCTURE.y}%`, width: "26%", aspectRatio: "1 / 1", background: phase === 1 ? `rgba(251,191,36,${0.05 + sanding / 400})` : undefined }}
            />
            {phase === 2 && (
              <span aria-hidden className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-zinc-200 bg-zinc-700 text-[10px] font-bold text-zinc-100" style={{ left: `${PUNCTURE.x}%`, top: `${PUNCTURE.y}%`, width: `${14 + (holdMs / PATCH_HOLD_MS) * 8}%`, aspectRatio: "1 / 1" }}>
                RUSTINE
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

const DEPTH_ROUNDS = [
  { depths: [6.1, 5.8, 6.3, 5.9], ok: true },
  { depths: [7.0, 3.2, 6.8, 3.0], ok: false },
];
const DEPTH_MAX_GAP = 1.5;

function DepthCheckGame({ name, onWin, onMiss }: GameProps) {
  const [round, setRound] = useState(0);
  const [probes, setProbes] = useState([0, 0, 0, 0]);
  const [groove, setGroove] = useState(0);
  const [message, setMessage] = useState(`Mesurez les 4 rainures. Rechapable si l'écart entre rainures reste ≤ ${fmtDepth(DEPTH_MAX_GAP)}.`);
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);
  const data = DEPTH_ROUNDS[round];
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
    if (round + 1 >= DEPTH_ROUNDS.length) {
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
      badge={`Pneu ${round + 1} / ${DEPTH_ROUNDS.length}`}
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
          <svg viewBox="0 0 240 130" className="w-full" aria-hidden>
            <rect x="10" y="30" width="220" height="86" rx="8" fill="#27272a" stroke="#52525b" />
            <rect x="10" y="30" width="220" height="10" fill="#3f3f46" />
            {data.depths.map((depth, i) => {
              const bottom = 30 + (measured[i] != null ? depth * 8 : 14);
              return (
                <g key={i}>
                  <rect x={x(i) - 8} y="30" width="16" height={bottom - 30} fill="#09090b" stroke={groove === i ? "#fbbf24" : "#52525b"} />
                  {measured[i] != null && <text x={x(i)} y={bottom + 14} fontSize="10" fill="#6ee7b7" textAnchor="middle">{fmtDepth(depth)}</text>}
                </g>
              );
            })}
            <rect x={x(groove) - 2} y={4} width="4" height={26 + Math.min(probes[groove], data.depths[groove]) * 8} fill="#fbbf24" />
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

const P_ZONE: [number, number] = [2.2, 2.4];
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
      const inZone = pressureRef.current >= P_ZONE[0] && pressureRef.current <= P_ZONE[1];
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
  }, [win]);

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
    setMessage(pressureRef.current < P_ZONE[0] ? "Pression encore trop basse." : pressureRef.current > P_ZONE[1] ? "Trop haut : purgez un peu." : "Dans la zone : ne touchez plus à rien.");
  };

  const inZone = pressure >= P_ZONE[0] && pressure <= P_ZONE[1];
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
        <svg viewBox="-66 -66 132 108" className="relative z-10 mx-auto w-full max-w-[300px]" role="img" aria-label={`Manomètre : ${fmtBar(pressure)}, zone cible ${fmtBar(P_ZONE[0])} à ${fmtBar(P_ZONE[1])}`}>
          <path d={arc(50, -120, 120)} fill="none" stroke="#3f3f46" strokeWidth="9" />
          <path d={arc(50, pressureAngle(P_ZONE[0]), pressureAngle(P_ZONE[1]))} fill="none" stroke="#34d399" strokeWidth="9" />
          <path d={arc(50, pressureAngle(P_BURST), 120)} fill="none" stroke="#ef4444" strokeWidth="9" />
          <line x1="0" y1="0" x2="0" y2="-44" stroke={inZone ? "#6ee7b7" : "#fbbf24"} strokeWidth="3" strokeLinecap="round" transform={`rotate(${pressureAngle(pressure)})`} />
          <circle r="5" fill="#27272a" stroke="#71717a" />
          <text y="30" fontSize="14" fontWeight="700" fill={inZone ? "#6ee7b7" : "#fde68a"} textAnchor="middle">{fmtBar(pressure)}</text>
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

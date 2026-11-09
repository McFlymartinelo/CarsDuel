"use client";

/** Mini-jeux moteur : stéthoscope, distribution, refroidissement, soupapes, fuites, allumage, bielles, compression, filtre, équilibrage. */

import { useEffect, useState, type ComponentType } from "react";
import { Check, Droplets, RotateCw, Wrench } from "lucide-react";
import {
  ActionButton,
  GameBoard,
  GameFrame,
  PartArt,
  ProbeBoard,
  Rotary,
  SmallButton,
  GearSvg,
  angleDelta,
  clamp,
  norm360,
  useClock,
  useTimeouts,
  useWinOnce,
  type GameProps,
  type Point,
  type Tone,
} from "./workshop-kit";

const fmtMm = (value: number) => `${value.toFixed(2).replace(".", ",")} mm`;
const shuffled = <T,>(values: T[]) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/* ------------------------------------------------------------------ */
/* Diagnostic au stéthoscope (observer, sélectionner)                  */
/* ------------------------------------------------------------------ */

const WAVE_LEN = 60;
const STETHO_CYLINDERS = [0, 1, 2, 3];

/** Signal d'un cylindre : une impulsion par temps, plus un cliquetis entre les temps si défaut. */
function wave(faulty: boolean): number[] {
  const out = Array.from({ length: WAVE_LEN }, () => 0);
  const pulse = (at: number, amplitude: number) => {
    for (let k = 0; k < 4; k += 1) {
      const i = (at + k) % WAVE_LEN;
      out[i] = Math.max(out[i], amplitude * (1 - k * 0.26));
    }
  };
  for (let at = 0; at < WAVE_LEN; at += 15) {
    pulse(at, 1);
    if (faulty) pulse(at + 8, 0.7);
  }
  return out;
}

const WAVE_OK = wave(false);
const WAVE_BAD = wave(true);

function Scope({ samples, phase, active }: { samples: number[]; phase: number; active: boolean }) {
  const points = Array.from({ length: WAVE_LEN * 2 }, (_, i) => `${i},${(34 - samples[i % WAVE_LEN] * 26).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${WAVE_LEN} 40`} className="h-12 w-full overflow-hidden rounded-md bg-black/50" aria-hidden>
      <line x1="0" y1="34" x2={WAVE_LEN} y2="34" stroke="#3f3f46" strokeWidth="0.6" />
      <g transform={`translate(${-(phase % WAVE_LEN)} 0)`}>
        <polyline points={points} fill="none" stroke={active ? "#fbbf24" : "#34d399"} strokeWidth="1.3" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function StethoscopeGame({ name, onWin, onMiss }: GameProps) {
  const [round, setRound] = useState(0);
  const [faults] = useState(() => shuffled(STETHO_CYLINDERS).slice(0, 2));
  const [selected, setSelected] = useState<number | null>(null);
  const [cleared, setCleared] = useState<boolean[]>([false, false, false, false]);
  const [message, setMessage] = useState("Comparez les 4 signaux, choisissez celui qui cliquette.");
  const [tone, setTone] = useState<Tone>("idle");
  const tick = useClock(80);
  const win = useWinOnce(onWin);
  const faulty = faults[round];

  const confirm = () => {
    if (selected == null) return;
    if (selected === faulty) {
      setTone("ok");
      if (round + 1 >= faults.length) {
        setMessage("Défaut localisé : les deux moteurs sont diagnostiqués.");
        win();
        return;
      }
      setMessage("Bien vu ! Passons au moteur suivant.");
      setRound(round + 1);
      setSelected(null);
      setCleared([false, false, false, false]);
      return;
    }
    setCleared((value) => value.map((entry, i) => entry || i === selected));
    setSelected(null);
    setTone("bad");
    setMessage("Ce cylindre est sain : signal régulier. Essayez un autre.");
    onMiss();
  };

  return (
    <GameFrame
      name={name}
      badge={`Moteur ${round + 1} / ${faults.length}`}
      message={message}
      tone={tone}
      footer={
        <ActionButton onClick={confirm} disabled={selected == null}>
          Signaler ce cylindre
        </ActionButton>
      }
    >
      <GameBoard className="p-3">
        <PartArt src="/cards/moteur/_4-cylindres.webp" opacity={0.14} />
        <ul className="relative z-10 grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((index) => {
            const isSelected = selected === index;
            return (
              <li key={index}>
                <button
                  type="button"
                  disabled={cleared[index]}
                  aria-pressed={isSelected}
                  aria-label={`Cylindre ${index + 1}${cleared[index] ? ", écarté" : ""}`}
                  onClick={() => setSelected(index)}
                  className={`w-full rounded-xl border p-2 text-left transition disabled:opacity-40 ${
                    isSelected ? "border-amber-300 bg-amber-500/10" : "border-line bg-black/30 hover:border-zinc-500"
                  }`}
                >
                  <span className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                    Cylindre {index + 1}
                    {cleared[index] && <Check size={12} className="text-emerald-300" aria-hidden />}
                  </span>
                  <Scope samples={index === faulty ? WAVE_BAD : WAVE_OK} phase={tick} active={isSelected} />
                </button>
              </li>
            );
          })}
        </ul>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Calage de distribution (tourner, dans l'ordre)                      */
/* ------------------------------------------------------------------ */

const snap5 = (angle: number) => Math.round(angle / 5) * 5;

function TimingMarksGame({ name, onWin, onMiss }: GameProps) {
  const [targets] = useState(() => [Math.floor(Math.random() * 12) * 30, Math.floor(Math.random() * 12) * 30] as const);
  const [crank, setCrank] = useState(() => (targets[0] + 130) % 360);
  const [cam, setCam] = useState(() => (targets[1] + 250) % 360);
  const [phase, setPhase] = useState<0 | 1>(0);
  const [message, setMessage] = useState("1. Amenez le repère du vilebrequin en haut, puis verrouillez-le.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);

  const lock = () => {
    const angle = phase === 0 ? crank : cam;
    const expected = targets[phase];
    const gap = angleDelta(angle, expected);
    if (Math.abs(gap) > 7) {
      setTone("bad");
      setMessage(`Repère décalé de ${Math.abs(Math.round(gap))}° ${gap > 0 ? "vers la droite" : "vers la gauche"}.`);
      onMiss();
      return;
    }
    setTone("ok");
    if (phase === 0) {
      setPhase(1);
      setMessage("Vilebrequin verrouillé. 2. Calez maintenant l'arbre à cames sur son repère.");
      return;
    }
    setMessage("Distribution calée : la courroie peut être posée.");
    win();
  };

  const gear = (which: 0 | 1) => {
    const isCrank = which === 0;
    const angle = isCrank ? crank : cam;
    const locked = phase > which;
    const disabled = locked || phase < which;
    const setAngle = (value: number) => (isCrank ? setCrank(norm360(snap5(value))) : setCam(norm360(snap5(value))));
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          {isCrank ? "1 · Vilebrequin" : "2 · Arbre à cames"}
        </span>
        <Rotary
          angle={angle}
          onChange={setAngle}
          label={isCrank ? "Vilebrequin" : "Arbre à cames"}
          disabled={disabled}
          className="w-full max-w-[150px]"
        >
          <svg viewBox="-80 -86 160 166" className="w-full" aria-hidden>
            <g transform={`rotate(${targets[which]})`}>
              <circle cx="0" cy="-73" r="6" fill={locked ? "#34d399" : "#10b981"} stroke="#bbf7d0" strokeWidth="1.5" />
              <path d="M0 -62 L0 -68" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
            </g>
            <GearSvg
              cx={0}
              cy={0}
              teeth={isCrank ? 18 : 32}
              outer={isCrank ? 54 : 60}
              rotate={angle}
              stroke={locked ? "#34d399" : "#f59e0b"}
              mark="#fde68a"
            />
          </svg>
        </Rotary>
        <div className="flex items-center gap-2">
          <SmallButton disabled={disabled} onClick={() => setAngle(angle - 10)} aria-label="Tourner à gauche">
            −10°
          </SmallButton>
          <SmallButton disabled={disabled} onClick={() => setAngle(angle + 10)} aria-label="Tourner à droite">
            +10°
          </SmallButton>
        </div>
      </div>
    );
  };

  return (
    <GameFrame
      name={name}
      badge={`${phase} / 2`}
      message={message}
      tone={tone}
      footer={
        <ActionButton onClick={lock}>{phase === 0 ? "Verrouiller le vilebrequin" : "Verrouiller l'arbre à cames"}</ActionButton>
      }
    >
      <GameBoard className="p-3">
        <PartArt src="/cards/moteur/_6-cylindres-en-ligne.webp" opacity={0.14} />
        <p className="relative z-10 mb-3 text-center text-xs font-semibold text-emerald-200">Alignez chaque trait jaune avec le repère vert lumineux. Cibles : vilebrequin {targets[0]}° · arbre à cames {targets[1]}°.</p>
        <div className="relative z-10 grid grid-cols-2 gap-3">
          {gear(0)}
          {gear(1)}
        </div>
        <p className="relative z-10 mt-2 text-center text-[11px] text-zinc-500">
          Glissez le pignon ou utilisez les flèches du clavier (Maj : pas triple).
        </p>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Circuit de refroidissement (pivoter les durites)                    */
/* ------------------------------------------------------------------ */

/* Côtés : 0 haut, 1 droite, 2 bas, 3 gauche. */
type PipeKind = "straight" | "elbow";
type Pipe = { kind: PipeKind; rot: number };

const PIPE_BASE: Record<PipeKind, number[]> = { straight: [1, 3], elbow: [0, 1] };
const pipeSides = ({ kind, rot }: Pipe) => PIPE_BASE[kind].map((side) => (side + rot) % 4);
const SIDE_STEP = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];
const SIDE_POINT = [
  [20, 0],
  [40, 20],
  [20, 40],
  [0, 20],
];
function createCircuit(): Pipe[] {
  const routes = [[0, 1, 2, 5, 8], [0, 3, 6, 7, 8]];
  const path = routes[Math.floor(Math.random() * routes.length)];
  return Array.from({ length: 9 }, (_, index) => {
    const at = path.indexOf(index);
    if (at < 0) return { kind: Math.random() < 0.5 ? "straight" : "elbow", rot: Math.floor(Math.random() * 4) };
    const sides: number[] = [];
    if (at === 0) sides.push(3); else {
      const prev = path[at - 1];
      sides.push(prev === index - 3 ? 0 : prev === index + 3 ? 2 : prev === index + 1 ? 1 : 3);
    }
    if (at === path.length - 1) sides.push(1); else {
      const next = path[at + 1];
      sides.push(next === index - 3 ? 0 : next === index + 3 ? 2 : next === index + 1 ? 1 : 3);
    }
    const kind: PipeKind = (sides[0] + 2) % 4 === sides[1] ? "straight" : "elbow";
    const rot = kind === "straight" ? (sides[0] === 1 || sides[0] === 3 ? 0 : 1) : (sides[0] === 0 && sides[1] === 1 || sides.includes(0) && sides.includes(1) ? 0 : sides[0] === 1 && sides[1] === 2 || sides.includes(1) && sides.includes(2) ? 1 : sides.includes(2) && sides.includes(3) ? 2 : 3);
    return { kind, rot: (rot + Math.floor(Math.random() * 3) + 1) % 4 };
  });
}

/** Suit le liquide depuis la pompe (entrée à gauche de la case 0) jusqu'au radiateur (sortie à droite de la case 8). */
function traceCircuit(pipes: Pipe[]) {
  const cells: number[] = [];
  let r = 0;
  let c = 0;
  let enter = 3;
  for (let guard = 0; guard < 12; guard += 1) {
    const sides = pipeSides(pipes[r * 3 + c]);
    if (!sides.includes(enter)) return { cells, ok: false, leak: { index: cells.length ? cells[cells.length - 1] : -1, side: enter } };
    cells.push(r * 3 + c);
    const exit = sides.find((side) => side !== enter) ?? enter;
    const nr = r + SIDE_STEP[exit][0];
    const nc = c + SIDE_STEP[exit][1];
    if (nr < 0 || nr > 2 || nc < 0 || nc > 2) {
      return { cells, ok: r === 2 && c === 2 && exit === 1, leak: { index: r * 3 + c, side: exit } };
    }
    r = nr;
    c = nc;
    enter = (exit + 2) % 4;
  }
  return { cells, ok: false, leak: { index: -1, side: 0 } };
}

function CoolingCircuitGame({ name, onWin, onMiss }: GameProps) {
  const [pipes, setPipes] = useState<Pipe[]>(createCircuit);
  const [tested, setTested] = useState(false);
  const [message, setMessage] = useState("Touchez une durite pour la pivoter : reliez la pompe au radiateur.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);
  const flow = traceCircuit(pipes);
  const flowing = new Set(flow.cells);

  const rotate = (index: number) => {
    setPipes((value) => value.map((pipe, i) => (i === index ? { ...pipe, rot: (pipe.rot + 1) % 4 } : pipe)));
    setTested(false);
    setTone("idle");
    setMessage("Continuez jusqu'au radiateur, puis mettez en pression.");
  };

  const test = () => {
    setTested(true);
    if (flow.ok) {
      setTone("ok");
      setMessage("Circuit étanche : le liquide circule jusqu'au radiateur.");
      win();
      return;
    }
    setTone("bad");
    setMessage("Fuite ! Le liquide s'échappe au raccord marqué en rouge.");
    onMiss();
  };

  const leakCell = tested && !flow.ok ? flow.leak : null;

  return (
    <GameFrame
      name={name}
      badge={`${flow.cells.length} durite${flow.cells.length > 1 ? "s" : ""} en eau`}
      message={message}
      tone={tone}
      footer={<ActionButton onClick={test}>Mettre en pression</ActionButton>}
    >
      <GameBoard className="p-3">
        <PartArt src="/cards/moteur/_4-cylindres.webp" opacity={0.1} />
        <div className="relative z-10 mx-auto grid max-w-[360px] grid-cols-[1fr_repeat(3,minmax(0,1.5fr))_1fr] items-center gap-1">
          {[0, 1, 2].map((row) => (
            <div key={row} className="contents">
              <div className="flex items-center justify-end">
                {row === 0 && (
                  <span className="flex h-full min-h-10 w-full items-center justify-center rounded-md border border-sky-400/40 bg-sky-500/10 text-[9px] font-bold uppercase text-sky-200">
                    Pompe
                  </span>
                )}
              </div>
              {[0, 1, 2].map((col) => {
                const index = row * 3 + col;
                const pipe = pipes[index];
                const wet = flowing.has(index);
                const isLeak = leakCell?.index === index;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => rotate(index)}
                    aria-label={`Durite ligne ${row + 1}, colonne ${col + 1}, ${pipe.kind === "elbow" ? "coudée" : "droite"}${wet ? ", sous liquide" : ""}`}
                    className="aspect-square w-full rounded-lg border border-line bg-black/40 transition hover:border-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                  >
                    <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
                      {pipeSides(pipe).map((side) => (
                        <line key={`o${side}`} x1="20" y1="20" x2={SIDE_POINT[side][0]} y2={SIDE_POINT[side][1]} stroke="#18181b" strokeWidth="12" strokeLinecap="round" />
                      ))}
                      {pipeSides(pipe).map((side) => (
                        <line key={`p${side}`} x1="20" y1="20" x2={SIDE_POINT[side][0]} y2={SIDE_POINT[side][1]} stroke={wet ? "#22d3ee" : "#71717a"} strokeWidth="7" strokeLinecap="round" />
                      ))}
                      <circle cx="20" cy="20" r="4.5" fill={wet ? "#67e8f9" : "#a1a1aa"} />
                      {isLeak && leakCell && (
                        <circle cx={SIDE_POINT[leakCell.side][0]} cy={SIDE_POINT[leakCell.side][1]} r="5" fill="#ef4444" stroke="#fecaca" strokeWidth="1.5" />
                      )}
                    </svg>
                  </button>
                );
              })}
              <div className="flex items-center">
                {row === 2 && (
                  <span
                    className={`flex h-full min-h-10 w-full items-center justify-center rounded-md border text-[9px] font-bold uppercase ${
                      tested && flow.ok ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200" : "border-line bg-black/30 text-zinc-400"
                    }`}
                  >
                    Radia.
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Réglage du jeu aux soupapes (cale puis jauge)                       */
/* ------------------------------------------------------------------ */

const VALVE_LABELS = ["Admission 1", "Échappement 2", "Admission 3"];
const SHIM_VALUES = [0.1, 0.15, 0.2, 0.25, 0.3];
const VALVE_TOL = 0.02;

function ValveClearanceGame({ name, onWin, onMiss }: GameProps) {
  const [valves] = useState(() => VALVE_LABELS.map((label) => {
    const spec = SHIM_VALUES[Math.floor(Math.random() * SHIM_VALUES.length)];
    return { label, spec, start: Math.random() < 0.5 ? Math.min(0.38, spec + 0.1) : Math.max(0.02, spec - 0.1) };
  }));
  const [shims] = useState(() => shuffled(SHIM_VALUES));
  const [index, setIndex] = useState(0);
  const [shim, setShim] = useState<number | null>(null);
  const [rejected, setRejected] = useState<number[]>([]);
  const [gap, setGap] = useState(() => valves[0].start);
  const [message, setMessage] = useState("Choisissez la cale qui correspond au jeu prescrit.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);
  const valve = valves[index];

  const pick = (value: number) => {
    if (Math.abs(value - valve.spec) < 0.001) {
      setShim(value);
      setTone("ok");
      setMessage("Bonne cale. Réglez maintenant la vis jusqu'à la zone verte.");
      return;
    }
    setRejected((list) => [...list, value]);
    setTone("bad");
    setMessage(`Cale ${fmtMm(value)} : ${value < valve.spec ? "trop fine" : "trop épaisse"} pour ce jeu.`);
    onMiss();
  };

  const validate = () => {
    if (shim == null) return;
    const diff = gap - valve.spec;
    if (Math.abs(diff) > VALVE_TOL + 0.0001) {
      setTone("bad");
      setMessage(diff > 0 ? "Jeu trop grand : resserrez la vis." : "Jeu trop serré : desserrez la vis.");
      onMiss();
      return;
    }
    if (index + 1 >= valves.length) {
      setTone("ok");
      setMessage("Les trois soupapes sont réglées.");
      win();
      return;
    }
    const next = index + 1;
    setIndex(next);
    setShim(null);
    setRejected([]);
    setGap(valves[next].start);
    setTone("ok");
    setMessage(`Soupape réglée. Suivante : ${valves[next].label}, choisissez la cale.`);
  };

  const gapPx = gap * 150;
  const inTol = Math.abs(gap - valve.spec) <= VALVE_TOL + 0.0001;

  return (
    <GameFrame
      name={name}
      badge={`${index} / ${valves.length}`}
      message={message}
      tone={tone}
      footer={
        <ActionButton onClick={validate} disabled={shim == null}>
          Valider le réglage
        </ActionButton>
      }
    >
      <GameBoard className="p-2 sm:p-3">
        <PartArt src="/cards/moteur/_4-cylindres.webp" opacity={0.12} />
        <div className="relative z-10 space-y-2 sm:space-y-3">
          <p className="text-center text-xs font-semibold text-zinc-200 sm:text-sm">
            {valve.label} · jeu prescrit {fmtMm(valve.spec)} ± {fmtMm(VALVE_TOL)}
          </p>
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Cales d'épaisseur">
            {shims.map((value) => (
              <SmallButton
                key={value}
                disabled={shim != null || rejected.includes(value)}
                onClick={() => pick(value)}
                className={shim === value ? "border-emerald-400 text-emerald-200" : ""}
              >
                {fmtMm(value)}
              </SmallButton>
            ))}
          </div>
          <svg viewBox="0 0 240 150" className="mx-auto w-full max-w-[240px] sm:max-w-[300px]" aria-hidden>
            <rect x="30" y="10" width="180" height="26" rx="8" fill="#3f3f46" stroke="#71717a" />
            <rect x="108" y="36" width="24" height="10" fill="#a1a1aa" />
            <rect x="108" y={46 + gapPx} width="24" height={Math.max(4, 100 - gapPx)} fill="#52525b" stroke="#71717a" />
            <rect x="90" y="140" width="60" height="6" rx="3" fill="#27272a" />
            {shim != null && (
              <rect x="100" y={46 + (gapPx - shim * 150) / 2} width="40" height={shim * 150} fill="#fbbf24" opacity="0.9" />
            )}
            <text x="214" y={46 + gapPx / 2 + 4} fontSize="11" fill="#d4d4d8" textAnchor="end">
              {fmtMm(gap)}
            </text>
          </svg>
          <div className={shim == null ? "pointer-events-none opacity-40" : ""}>
            <div className="relative h-3 rounded-full bg-zinc-800">
              <span
                className="absolute inset-y-0 rounded-full bg-emerald-500/50"
                style={{ left: `${((valve.spec - VALVE_TOL) / 0.4) * 100}%`, width: `${((VALVE_TOL * 2) / 0.4) * 100}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={0.4}
              step={0.01}
              value={gap}
              disabled={shim == null}
              aria-label="Jeu mesuré à la jauge, en millimètres"
              onChange={(event) => setGap(Number(event.target.value))}
              className="mt-2 h-8 w-full accent-amber-400"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <SmallButton disabled={shim == null} onClick={() => setGap((v) => clamp(Math.round((v - 0.01) * 100) / 100, 0, 0.4))} aria-label="Resserrer la vis">
                −0,01
              </SmallButton>
              <span className={`font-display text-lg font-bold tabular-nums ${inTol ? "text-emerald-300" : "text-amber-200"}`}>{fmtMm(gap)}</span>
              <SmallButton disabled={shim == null} onClick={() => setGap((v) => clamp(Math.round((v + 0.01) * 100) / 100, 0, 0.4))} aria-label="Desserrer la vis">
                +0,01
              </SmallButton>
            </div>
          </div>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Recherche de fuite (détecteur à déplacer)                           */
/* ------------------------------------------------------------------ */

function createLeaks(): Point[] {
  const points: Point[] = [];
  while (points.length < 3) {
    const point = { x: 18 + Math.random() * 64, y: 20 + Math.random() * 60 };
    if (points.every((other) => Math.hypot(other.x - point.x, other.y - point.y) > 22)) points.push(point);
  }
  return points;
}
const LEAK_RADIUS = 8;

function LeakSearchGame({ name, onWin, onMiss }: GameProps) {
  const [leaks] = useState(createLeaks);
  const [pos, setPos] = useState<Point>({ x: 50, y: 50 });
  const [found, setFound] = useState<boolean[]>([false, false, false]);
  const [message, setMessage] = useState("Déplacez le détecteur : plus le signal monte, plus vous êtes près d'une fuite.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);

  const signal = Math.max(
    0,
    ...leaks.map((leak, i) => (found[i] ? 0 : 1 - Math.hypot(leak.x - pos.x, leak.y - pos.y) / 38)),
  );
  const count = found.filter(Boolean).length;

  const mark = (at: Point = pos) => {
    const hit = leaks.findIndex((leak, i) => !found[i] && Math.hypot(leak.x - at.x, leak.y - at.y) <= LEAK_RADIUS);
    if (hit < 0) {
      setTone("bad");
      setMessage("Rien ici : le détecteur ne mesure pas de fuite à cet endroit.");
      onMiss();
      return;
    }
    const next = found.map((value, i) => value || i === hit);
    setFound(next);
    setTone("ok");
    if (next.every(Boolean)) {
      setMessage("Les trois fuites sont repérées.");
      win();
      return;
    }
    setMessage(`Fuite repérée. Encore ${3 - next.filter(Boolean).length}.`);
  };

  return (
    <GameFrame
      name={name}
      badge={`${count} / 3`}
      message={message}
      tone={tone}
      footer={<ActionButton onClick={() => mark()}>Marquer la fuite ici</ActionButton>}
    >
      <GameBoard>
        <ProbeBoard pos={pos} onMove={setPos} onAct={mark} label="Bloc moteur : déplacez le détecteur avec les flèches, Entrée pour marquer" className="aspect-[4/3] w-full">
          <PartArt src="/cards/moteur/_v8.webp" opacity={0.3} />
          {leaks.map((leak, i) =>
            found[i] ? (
              <span key={i} aria-hidden className="absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-emerald-400 bg-emerald-500/20 text-emerald-200" style={{ left: `${leak.x}%`, top: `${leak.y}%` }}>
                <Droplets size={14} />
              </span>
            ) : null,
          )}
          <span
            aria-hidden
            className="absolute z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              boxShadow: `0 0 ${8 + signal * 28}px rgba(251,191,36,${0.25 + signal * 0.6})`,
              background: `rgba(251,191,36,${signal * 0.28})`,
            }}
          >
            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200" />
          </span>
        </ProbeBoard>
      </GameBoard>
      <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        <span>Signal</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800" role="meter" aria-label="Intensité du signal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(signal * 100)}>
          <span className="block h-full rounded-full bg-gradient-to-r from-emerald-600 to-amber-300" style={{ width: `${signal * 100}%` }} />
        </div>
        <span className="w-9 text-right tabular-nums text-amber-300">{Math.round(signal * 100)}%</span>
      </div>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Ordre d'allumage (relier les bougies)                               */
/* ------------------------------------------------------------------ */

const PLUGS = [
  { id: 1, x: 15 },
  { id: 2, x: 38 },
  { id: 3, x: 62 },
  { id: 4, x: 85 },
];

function FiringOrderGame({ name, onWin, onMiss }: GameProps) {
  const [firingOrder] = useState(() => shuffled(PLUGS.map((plug) => plug.id)));
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const [showText, setShowText] = useState(false);
  const [message, setMessage] = useState("Observez l'ordre d'étincelles, puis reliez les bougies dans le même ordre.");
  const [tone, setTone] = useState<Tone>("idle");
  const later = useTimeouts();
  const win = useWinOnce(onWin);

  const play = (delay = 0) => {
    later(() => setPlaying(true), delay);
    firingOrder.forEach((id, i) => {
      later(() => setFlash(id), delay + 400 + i * 700);
      later(() => setFlash(null), delay + 400 + i * 700 + 450);
    });
    later(() => setPlaying(false), delay + 400 + firingOrder.length * 700);
  };

  useEffect(() => {
    play(300);
    // lecture unique de l'indice au montage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const press = (id: number) => {
    if (playing || progress >= firingOrder.length) return;
    if (id !== firingOrder[progress]) {
      setProgress(0);
      setTone("bad");
      setMessage("Mauvais ordre : les câbles sont débranchés, reprenez depuis le début.");
      onMiss();
      return;
    }
    const next = progress + 1;
    setProgress(next);
    setTone("ok");
    if (next >= firingOrder.length) {
      setMessage("Ordre d'allumage correct.");
      win();
      return;
    }
    setMessage(`Bougie ${id} reliée. Suivante ?`);
  };

  const linked = firingOrder.slice(0, progress);

  return (
    <GameFrame
      name={name}
      badge={`${progress} / ${firingOrder.length}`}
      message={message}
      tone={tone}
      footer={
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <SmallButton disabled={playing} onClick={() => (setMessage("Observez l'ordre d'étincelles."), play())}>
            Revoir l&apos;indice
          </SmallButton>
          <SmallButton onClick={() => setShowText((v) => !v)} aria-pressed={showText}>
            {showText ? `Ordre : ${firingOrder.join(" → ")}` : "Indice écrit"}
          </SmallButton>
        </div>
      }
    >
      <GameBoard className="aspect-[4/3]">
        <PartArt src="/cards/moteur/_4-cylindres.webp" opacity={0.2} />
        <svg viewBox="0 0 100 75" className="absolute inset-0 h-full w-full" aria-hidden>
          {linked.map((id) => {
            const plug = PLUGS.find((p) => p.id === id)!;
            return <line key={id} x1="50" y1="16" x2={plug.x} y2="58" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" />;
          })}
          <circle cx="50" cy="16" r="7" fill="#18181b" stroke="#fbbf24" strokeWidth="1.5" />
          <text x="50" y="18" fontSize="5" fill="#fde68a" textAnchor="middle">
            Delco
          </text>
        </svg>
        {PLUGS.map((plug) => {
          const lit = flash === plug.id;
          const done = linked.includes(plug.id);
          return (
            <button
              key={plug.id}
              type="button"
              disabled={playing}
              onClick={() => press(plug.id)}
              aria-label={`Bougie ${plug.id}${done ? ", reliée" : ""}`}
              className={`absolute top-[78%] grid h-14 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg border-2 font-display text-lg font-bold transition disabled:cursor-wait ${
                lit
                  ? "border-amber-200 bg-amber-300 text-black shadow-[0_0_24px_#fbbf24]"
                  : done
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                    : "border-zinc-600 bg-zinc-900 text-zinc-300 hover:border-zinc-400"
              }`}
              style={{ left: `${plug.x}%` }}
            >
              {plug.id}
            </button>
          );
        })}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-line bg-black/60 px-2 py-0.5 text-[10px] text-zinc-400">
          <Wrench size={10} aria-hidden /> {playing ? "Indice en cours…" : "À vous"}
        </span>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Montage des bielles (associer les diamètres, orienter les chapeaux) */
/* ------------------------------------------------------------------ */

const ROD_DIAMETERS = [48, 50, 52, 54] as const;
type RodConfig = { targets: number[]; caps: number[] };

function createRodConfig(): RodConfig {
  const targets = shuffled([...ROD_DIAMETERS]);
  return { targets, caps: targets.map(() => (Math.random() < 0.5 ? 0 : 1)) };
}

function RodArt({ dia, cap = 0, ghost = false }: { dia: number; cap?: number; ghost?: boolean }) {
  return (
    <svg viewBox="0 0 80 92" className="h-full w-full" aria-hidden>
      <g opacity={ghost ? 0.4 : 1}>
        <path d="M40 34 L40 70" stroke="#a1a1aa" strokeWidth="7" strokeLinecap="round" />
        <path d="M40 34 L40 70" stroke="#f4f4f5" strokeWidth="2" strokeLinecap="round" opacity=".45" />
        <circle cx="40" cy="78" r="9" fill="#3f3f46" stroke="#a1a1aa" strokeWidth="2" />
        <circle cx="40" cy="78" r="3" fill="#0a0a0c" />
        <path d="M22 20 Q22 8 40 8 Q58 8 58 20 L58 32 Q58 42 40 42 Q22 42 22 32 Z" fill="#27272a" stroke="#d4d4d8" strokeWidth="2" />
        <path d="M26 22 H54" stroke="#52525b" strokeWidth="1.5" />
        <path d="M29 12 L34 16 M51 12 L46 16" stroke="#71717a" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="27" cy="15" r="2.4" fill="#71717a" stroke="#e4e4e7" strokeWidth=".7" />
        <circle cx="53" cy="15" r="2.4" fill="#71717a" stroke="#e4e4e7" strokeWidth=".7" />
        <circle cx="40" cy="26" r="6.5" fill="#0a0a0c" stroke="#a1a1aa" strokeWidth="1.5" />
        <path d={cap === 0 ? "M40 8 V2" : "M40 42 V48"} stroke="#fbbf24" strokeWidth="2.6" strokeLinecap="round" />
        <text x="40" y="63" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fde68a">
          {dia}
        </text>
      </g>
    </svg>
  );
}

function RodAssemblyGame({ name, onWin, onMiss }: GameProps) {
  const [config] = useState(createRodConfig);
  const [installed, setInstalled] = useState<({ dia: number; cap: number } | null)[]>(() => config.targets.map(() => null));
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState("Choisissez une bielle, puis son cylindre : le diamètre doit correspondre.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);
  const count = installed.filter(Boolean).length;

  const choose = (dia: number) => {
    setSelected((value) => (value === dia ? null : dia));
    setTone("idle");
    setMessage(`Bielle Ø ${dia} sélectionnée : touchez le cylindre au même diamètre.`);
  };

  const place = (index: number) => {
    if (installed[index]) {
      setMessage("Ce cylindre est déjà équipé.");
      return;
    }
    if (selected == null) {
      setTone("bad");
      setMessage("Choisissez d'abord une bielle dans la réserve.");
      return;
    }
    if (selected !== config.targets[index]) {
      setTone("bad");
      setMessage(`Ce cylindre attend une bielle Ø ${config.targets[index]}, pas Ø ${selected}.`);
      onMiss();
      return;
    }
    setInstalled((list) => list.map((entry, i) => (i === index ? { dia: selected, cap: 0 } : entry)));
    setSelected(null);
    setTone("ok");
    setMessage(`Bielle Ø ${selected} posée sur le cylindre ${index + 1}. Orientez le chapeau.`);
  };

  const flip = (index: number) => {
    setInstalled((list) => list.map((entry, i) => (i === index && entry ? { ...entry, cap: entry.cap === 0 ? 1 : 0 } : entry)));
    setTone("idle");
    setMessage(`Chapeau du cylindre ${index + 1} retourné : vérifiez le repère cible.`);
  };

  const check = () => {
    if (count < 4) {
      setTone("bad");
      setMessage(`Il manque ${4 - count} bielle${4 - count > 1 ? "s" : ""} avant de contrôler le montage.`);
      return;
    }
    const wrong = installed.filter((entry, i) => entry != null && entry.cap !== config.caps[i]).length;
    if (wrong > 0) {
      setTone("bad");
      setMessage(`${wrong} chapeau${wrong > 1 ? "x" : ""} mal orienté${wrong > 1 ? "s" : ""} : repère jaune à aligner avec la flèche cible.`);
      onMiss();
      return;
    }
    setTone("ok");
    setMessage("Bielles montées et chapeaux orientés : le bas moteur est prêt.");
    win();
  };

  return (
    <GameFrame
      name={name}
      badge={`${count} / 4`}
      message={message}
      tone={tone}
      footer={<ActionButton onClick={check} disabled={count < 4}>Contrôler le montage</ActionButton>}
    >
      <GameBoard className="p-3">
        <PartArt src="/cards/moteur/_v8.webp" opacity={0.12} />
        <div className="relative z-10 space-y-3">
          <p className="text-center text-[11px] text-zinc-400">
            Objectif : 4 bielles. Repère jaune du chapeau <b className="text-amber-300">vers la flèche</b> indiquée sur chaque cylindre.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {config.targets.map((targetDia, index) => {
              const entry = installed[index];
              const correctCap = entry?.cap === config.caps[index];
              return (
                <div key={index} className="rounded-xl border border-line bg-black/35 p-2">
                  <div className="flex items-center justify-between gap-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
                    <span>Cyl. {index + 1}</span>
                    <span className={correctCap && entry ? "text-emerald-300" : "text-amber-300"}>
                      {config.caps[index] === 0 ? "▲ haut" : "▼ bas"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => place(index)}
                    aria-label={`Cylindre ${index + 1}, bielle Ø ${targetDia}${entry ? " installée" : " vide"}`}
                    className={`relative mt-1 grid aspect-square w-full place-items-center rounded-lg border bg-zinc-950/80 transition ${
                      entry
                        ? correctCap
                          ? "border-emerald-400/50"
                          : "border-amber-400/70"
                        : "border-dashed border-zinc-600 hover:border-amber-300"
                    }`}
                  >
                    <span className="absolute bottom-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                      Ø {targetDia}
                    </span>
                    <span className="h-[78%] w-[78%] pb-3">
                      <RodArt dia={entry?.dia ?? targetDia} cap={entry?.cap ?? config.caps[index]} ghost={!entry} />
                    </span>
                    {!entry && <span className="absolute inset-2 rounded-lg border border-dashed border-amber-400/20" />}
                  </button>
                  {entry && (
                    <SmallButton onClick={() => flip(index)} className="mt-1 flex w-full items-center justify-center gap-1 py-1.5 text-[10px]">
                      <RotateCw size={12} aria-hidden /> Retourner
                    </SmallButton>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Bielles disponibles</p>
            <div className="grid grid-cols-4 gap-2">
              {ROD_DIAMETERS.map((dia) => {
                const used = installed.some((entry) => entry?.dia === dia);
                return (
                  <button
                    key={dia}
                    type="button"
                    disabled={used}
                    aria-pressed={selected === dia}
                    onClick={() => choose(dia)}
                    className={`rounded-lg border p-1 transition disabled:opacity-30 ${
                      selected === dia ? "border-amber-300 bg-amber-500/10" : "border-line bg-black/30 hover:border-zinc-500"
                    }`}
                  >
                    <span className="mx-auto block h-14 w-14">
                      <RodArt dia={dia} cap={0} />
                    </span>
                    <span className="text-[10px] font-bold tabular-nums text-zinc-300">Ø {dia}</span>
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
/* Diagnostic de compression (comparer, désigner)                      */
/* ------------------------------------------------------------------ */

type CompressionConfig = { spec: number; tol: number; values: number[]; faulty: number };
const COMPRESSION_MIN = 9;
const COMPRESSION_MAX = 14;

function createCompression(): CompressionConfig {
  const spec = Math.round((11 + Math.random() * 1.2) * 10) / 10;
  const tol = Math.round((0.35 + Math.random() * 0.15) * 100) / 100;
  const faulty = Math.floor(Math.random() * 4);
  const sign = Math.random() < 0.5 ? -1 : 1;
  const values = Array.from({ length: 4 }, (_, index) => {
    if (index === faulty) return Math.round((spec + sign * (tol + 0.35 + Math.random() * 0.55)) * 10) / 10;
    return Math.round((spec + (Math.random() * 2 - 1) * 0.18) * 10) / 10;
  });
  return { spec, tol, values, faulty };
}

function CompressionGame({ name, onWin, onMiss }: GameProps) {
  const [config] = useState(createCompression);
  const [selected, setSelected] = useState<number | null>(null);
  const [excluded, setExcluded] = useState<boolean[]>([false, false, false, false]);
  const [message, setMessage] = useState("Comparez les 4 compressions : un cylindre sort de la tolérance.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);
  const bandLeft = ((config.spec - config.tol - COMPRESSION_MIN) / (COMPRESSION_MAX - COMPRESSION_MIN)) * 100;
  const bandWidth = ((config.tol * 2) / (COMPRESSION_MAX - COMPRESSION_MIN)) * 100;

  const signal = () => {
    if (selected == null) return;
    if (selected === config.faulty) {
      setTone("ok");
      setMessage(`Cylindre ${selected + 1} : ${config.values[selected].toFixed(1)} bar, hors tolérance. Diagnostic correct.`);
      win();
      return;
    }
    setExcluded((list) => list.map((value, index) => value || index === selected));
    setTone("bad");
    setMessage(`Cylindre ${selected + 1} : ${config.values[selected].toFixed(1)} bar, dans la tolérance. Cherchez ailleurs.`);
    setSelected(null);
    onMiss();
  };

  return (
    <GameFrame
      name={name}
      badge={`${config.spec.toFixed(1)} ± ${config.tol.toFixed(2)} bar`}
      message={message}
      tone={tone}
      footer={<ActionButton onClick={signal} disabled={selected == null}>Signaler ce cylindre</ActionButton>}
    >
      <GameBoard className="p-3">
        <PartArt src="/cards/moteur/_4-cylindres.webp" opacity={0.13} />
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-black/35 px-2.5 py-2 text-[11px]">
            <span className="text-zinc-400">Compression nominale</span>
            <span className="font-display text-base font-bold tabular-nums text-emerald-300">{config.spec.toFixed(1)} bar</span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-200">
              tol. ± {config.tol.toFixed(2)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {config.values.map((value, index) => {
              const active = selected === index;
              const out = excluded[index];
              return (
                <button
                  key={index}
                  type="button"
                  disabled={out}
                  aria-pressed={active}
                  aria-label={`Cylindre ${index + 1}, ${value.toFixed(1)} bar${out ? ", écarté" : ""}`}
                  onClick={() => {
                    setSelected(index);
                    setTone("idle");
                    setMessage(`Cylindre ${index + 1} sélectionné : comparez sa valeur à la tolérance.`);
                  }}
                  className={`rounded-xl border p-2 text-left transition disabled:opacity-40 ${
                    active ? "border-amber-300 bg-amber-500/10" : "border-line bg-black/35 hover:border-zinc-500"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Cyl. {index + 1}</span>
                    <span className="font-display text-2xl font-bold tabular-nums text-zinc-100">
                      {value.toFixed(1)}
                      <small className="ml-0.5 text-[9px] font-semibold text-zinc-500">bar</small>
                    </span>
                  </span>
                  <span className="relative mt-2 block h-2.5 overflow-hidden rounded-full bg-zinc-800">
                    <span className="absolute inset-y-0 bg-emerald-500/35" style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }} />
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full ${out ? "bg-zinc-600" : "bg-gradient-to-r from-amber-700 to-amber-300"}`}
                      style={{ width: `${((value - COMPRESSION_MIN) / (COMPRESSION_MAX - COMPRESSION_MIN)) * 100}%` }}
                    />
                  </span>
                  <span className="mt-1 flex justify-between text-[9px] text-zinc-500">
                    <span>{COMPRESSION_MIN} bar</span>
                    <span>{out ? "écarté" : "à contrôler"}</span>
                    <span>{COMPRESSION_MAX} bar</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-center text-[10px] text-zinc-500">Bande verte = plage conforme. Une valeur hors bande trahit une perte de compression.</p>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Calage de l'allumage (régler l'avance)                              */
/* ------------------------------------------------------------------ */

const IGNITION_MAX = 30;
const ignitionPoint = (radius: number, angle: number) => ({
  x: radius * Math.sin((angle * Math.PI) / 180),
  y: -radius * Math.cos((angle * Math.PI) / 180),
});
const ignitionArc = (radius: number, from: number, to: number) => {
  const a = ignitionPoint(radius, from);
  const b = ignitionPoint(radius, to);
  return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

function createIgnition() {
  const target = 6 + Math.floor(Math.random() * 15);
  const tol = 1.5;
  const direction = Math.random() < 0.5 ? -1 : 1;
  const start = clamp(Math.round((target + direction * (5 + Math.random() * 7)) * 2) / 2, 1, 29);
  return { target, tol, start };
}

function IgnitionTimingGame({ name, onWin, onMiss }: GameProps) {
  const [config] = useState(createIgnition);
  const [timing, setTiming] = useState(config.start);
  const [message, setMessage] = useState("Ajustez l'avance : amenez l'aiguille dans la zone verte de la jauge.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);
  const angle = -120 + (timing / IGNITION_MAX) * 240;
  const low = config.target - config.tol;
  const high = config.target + config.tol;
  const inBand = timing >= low && timing <= high;

  const set = (value: number) => {
    setTiming(clamp(Math.round(value * 2) / 2, 0, IGNITION_MAX));
    setTone("idle");
    setMessage("Réglez finement, puis validez le calage.");
  };

  const validate = () => {
    if (inBand) {
      setTone("ok");
      setMessage(`Allumage calé à ${timing.toFixed(1)}° : l'étincelle part au bon moment.`);
      win();
      return;
    }
    setTone("bad");
    setMessage(timing < low ? "Avance trop faible : l'étincelle part trop tard." : "Avance trop élevée : l'étincelle part trop tôt.");
    onMiss();
  };

  const curve = Array.from({ length: 41 }, (_, i) => {
    const x = (i / 40) * IGNITION_MAX;
    const y = 64 - 34 * Math.exp(-((x - timing) ** 2) / 6) - 4 * Math.sin(x * 0.8);
    return `${(i / 40) * 200},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <GameFrame
      name={name}
      badge={`${timing.toFixed(1)}°`}
      message={message}
      tone={tone}
      footer={
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <SmallButton onClick={() => set(timing - 1)} aria-label="Réduire l'avance de 1 degré">−1°</SmallButton>
            <span className="min-w-20 text-center font-display text-lg font-bold tabular-nums text-amber-200">{timing.toFixed(1)}°</span>
            <SmallButton onClick={() => set(timing + 1)} aria-label="Augmenter l'avance de 1 degré">+1°</SmallButton>
          </div>
          <input
            type="range"
            min={0}
            max={IGNITION_MAX}
            step={0.5}
            value={timing}
            aria-label="Avance à l'allumage, en degrés"
            onChange={(event) => set(Number(event.target.value))}
            className="h-8 w-full accent-amber-400"
          />
          <ActionButton onClick={validate}>Valider le calage</ActionButton>
        </div>
      }
    >
      <GameBoard className="p-3">
        <PartArt src="/cards/moteur/_4-cylindres.webp" opacity={0.12} />
        <div className="relative z-10">
          <p className="mb-1 text-center text-xs font-semibold text-emerald-200">
            Objectif : {low.toFixed(1)}° à {high.toFixed(1)}° d&apos;avance
          </p>
          <div className="flex items-center justify-center gap-2">
            <svg viewBox="-70 -70 140 124" className="w-[54%] max-w-[220px]" role="img" aria-label={`Jauge d'allumage : ${timing.toFixed(1)} degrés, cible ${config.target} degrés`}>
              <defs>
                <linearGradient id="ignition-bezel" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e4e4e7" />
                  <stop offset="30%" stopColor="#71717a" />
                  <stop offset="56%" stopColor="#27272a" />
                  <stop offset="82%" stopColor="#a1a1aa" />
                  <stop offset="100%" stopColor="#3f3f46" />
                </linearGradient>
                <radialGradient id="ignition-face" cx="42%" cy="34%" r="72%">
                  <stop offset="0%" stopColor="#26262c" />
                  <stop offset="100%" stopColor="#0b0b0e" />
                </radialGradient>
              </defs>
              <circle r="58" fill="#000000" opacity=".45" />
              <circle r="56" fill="url(#ignition-face)" stroke="url(#ignition-bezel)" strokeWidth="6" />
              <path d={ignitionArc(45, -120, 120)} fill="none" stroke="#3f3f46" strokeWidth="6.5" strokeLinecap="round" />
              <path
                d={ignitionArc(45, -120 + (low / IGNITION_MAX) * 240, -120 + (high / IGNITION_MAX) * 240)}
                fill="none"
                stroke="#34d399"
                strokeWidth="6.5"
                style={{ filter: "drop-shadow(0 0 4px rgba(52,211,153,.6))" }}
              />
              {Array.from({ length: 16 }, (_, i) => {
                const value = i * 2;
                const deg = -120 + (value / IGNITION_MAX) * 240;
                const outer = ignitionPoint(50, deg);
                const inner = ignitionPoint(i % 5 === 0 ? 39 : 42, deg);
                return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={i % 5 === 0 ? "#d4d4d8" : "#71717a"} strokeWidth={i % 5 === 0 ? 1.1 : .55} strokeLinecap="round" />;
              })}
              {[0, 10, 20, 30].map((value) => {
                const at = ignitionPoint(31, -120 + (value / IGNITION_MAX) * 240);
                return <text key={value} x={at.x} y={at.y + 2} fontSize="6" fill="#a1a1aa" textAnchor="middle">{value}</text>;
              })}
              <g transform={`rotate(${angle})`} style={{ filter: `drop-shadow(0 0 4px ${inBand ? "rgba(52,211,153,.8)" : "rgba(251,191,36,.6)"})` }}>
                <path d="M0 2 L-2.8 -29 L0 -40 L2.8 -29 Z" fill={inBand ? "#6ee7b7" : "#fbbf24"} />
              </g>
              <circle r="8" fill="#27272a" stroke="url(#ignition-bezel)" strokeWidth="1.3" />
              <circle r="3" fill="#111114" stroke="#71717a" strokeWidth=".7" />
              <rect x="-34" y="22" width="68" height="21" rx="6" fill="#09090b" stroke={inBand ? "#34d399" : "#3f3f46"} />
              <text y="37" fontSize="11" fontWeight="700" fill={inBand ? "#6ee7b7" : "#fde68a"} textAnchor="middle">{timing.toFixed(1)}°</text>
              <text y="49" fontSize="4.2" letterSpacing="1.4" textAnchor="middle" fill="#71717a">AVANCE</text>
            </svg>
            <svg viewBox="0 0 200 78" className="w-[44%] max-w-[190px] rounded-lg border border-line bg-black/45" role="img" aria-label="Courbe d'allumage avec la zone cible">
              <rect x={(low / IGNITION_MAX) * 200} y="0" width={((high - low) / IGNITION_MAX) * 200} height="78" fill="#34d399" opacity=".14" />
              <line x1={(low / IGNITION_MAX) * 200} y1="0" x2={(low / IGNITION_MAX) * 200} y2="78" stroke="#34d399" strokeWidth=".8" strokeDasharray="3 2" />
              <line x1={(high / IGNITION_MAX) * 200} y1="0" x2={(high / IGNITION_MAX) * 200} y2="78" stroke="#34d399" strokeWidth=".8" strokeDasharray="3 2" />
              <polyline points={curve} fill="none" stroke={inBand ? "#6ee7b7" : "#fbbf24"} strokeWidth="2" strokeLinejoin="round" />
              <line x1="0" y1="64" x2="200" y2="64" stroke="#3f3f46" strokeWidth=".7" />
              <text x="4" y="75" fontSize="5" fill="#71717a">0°</text>
              <text x="184" y="75" fontSize="5" fill="#71717a">30°</text>
            </svg>
          </div>
          <p className="mt-1 text-center text-[10px] text-zinc-500">Zone verte = tolérance de ±{config.tol.toFixed(1)}° autour de la valeur cible.</p>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Remplacement du filtre à air (repérer, remplacer)                   */
/* ------------------------------------------------------------------ */

const FILTER_DIMENSIONS = [
  [280, 190],
  [320, 210],
  [250, 170],
  [300, 200],
] as const;
type FilterDimensions = readonly [number, number];

function FilterArt({ worn = false }: { worn?: boolean }) {
  return (
    <svg viewBox="0 0 120 84" className="h-full w-full" aria-hidden>
      <rect x="4" y="8" width="112" height="68" rx="6" fill={worn ? "#221a10" : "#d4d4d8"} stroke="#52525b" strokeWidth="2" />
      {Array.from({ length: 13 }, (_, i) => (
        <rect
          key={i}
          x={10 + i * 8}
          y="13"
          width={worn ? 4 : 3.5}
          height="58"
          rx="1"
          fill={worn ? (i % 3 === 0 ? "#4a3218" : "#3a2a16") : i % 2 === 0 ? "#f4f4f5" : "#a1a1aa"}
        />
      ))}
      {worn && (
        <>
          <ellipse cx="35" cy="36" rx="18" ry="12" fill="#3f2a10" opacity=".85" />
          <ellipse cx="82" cy="52" rx="22" ry="13" fill="#2d1e0b" opacity=".8" />
          <circle cx="72" cy="28" r="4" fill="#6b4a1e" />
          <circle cx="48" cy="56" r="3" fill="#5a3d18" />
        </>
      )}
      <rect x="4" y="8" width="112" height="68" rx="6" fill="none" stroke="#18181b" strokeOpacity=".5" />
    </svg>
  );
}

function FilterChangeGame({ name, onWin, onMiss }: GameProps) {
  const [round] = useState(() => {
    const spec = FILTER_DIMENSIONS[Math.floor(Math.random() * FILTER_DIMENSIONS.length)];
    const wrong = shuffled(FILTER_DIMENSIONS.filter((dim) => dim !== spec)).slice(0, 2);
    return {
      spec,
      worn: Math.floor(Math.random() * 6),
      options: shuffled([spec, ...wrong]) as FilterDimensions[],
    };
  });
  const [phase, setPhase] = useState(0);
  const [removed, setRemoved] = useState(false);
  const [message, setMessage] = useState("Repérez et retirez le filtre colmaté (le plus sombre), puis choisissez son remplacement.");
  const [tone, setTone] = useState<Tone>("idle");
  const win = useWinOnce(onWin);

  const inspect = (index: number) => {
    if (removed) return;
    if (index !== round.worn) {
      setTone("bad");
      setMessage("Ce filtre est encore propre : cherchez celui qui est colmaté.");
      onMiss();
      return;
    }
    setRemoved(true);
    setPhase(1);
    setTone("ok");
    setMessage(`Filtre usé retiré. Choisissez un remplacement de ${round.spec[0]} × ${round.spec[1]} mm.`);
  };

  const install = (dimensions: FilterDimensions) => {
    if (dimensions[0] === round.spec[0] && dimensions[1] === round.spec[1]) {
      setTone("ok");
      setMessage("Filtre neuf installé : le moteur respire correctement.");
      win();
      return;
    }
    setTone("bad");
    setMessage(`Dimensions ${dimensions[0]} × ${dimensions[1]} mm : le logement demande ${round.spec[0]} × ${round.spec[1]} mm.`);
    onMiss();
  };

  return (
    <GameFrame name={name} badge={`${phase} / 2`} message={message} tone={tone}>
      <GameBoard className="p-3">
        <PartArt src="/cards/moteur/_4-cylindres.webp" opacity={0.1} />
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-black/35 px-2.5 py-2 text-[11px]">
            <span className="text-zinc-400">Boîte à air</span>
            <span className="font-display text-base font-bold tabular-nums text-amber-200">{round.spec[0]} × {round.spec[1]} mm</span>
            <span className={`rounded-full border px-2 py-0.5 font-semibold ${phase === 1 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-line text-zinc-500"}`}>
              {phase === 1 ? "filtre retiré" : "inspection"}
            </span>
          </div>
          {phase === 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => inspect(index)}
                  aria-label={`Filtre ${index + 1}${index === round.worn ? "" : ", propre"}`}
                  className="rounded-xl border border-line bg-black/35 p-1.5 transition hover:border-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                >
                  <span className="block aspect-[10/7]">
                    <FilterArt worn={index === round.worn} />
                  </span>
                  <span className="mt-1 block text-center text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Filtre {index + 1}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {round.options.map((dimensions) => (
                <button
                  key={`${dimensions[0]}-${dimensions[1]}`}
                  type="button"
                  onClick={() => install(dimensions)}
                  aria-label={`Filtre de remplacement ${dimensions[0]} par ${dimensions[1]} millimètres`}
                  className="rounded-xl border border-line bg-black/35 p-1.5 transition hover:border-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                >
                  <span className="block aspect-[10/7]">
                    <FilterArt />
                  </span>
                  <span className="mt-1 block text-center font-display text-[11px] font-bold tabular-nums text-zinc-200">
                    {dimensions[0]} × {dimensions[1]}
                  </span>
                  <span className="block text-center text-[8px] uppercase tracking-wider text-zinc-500">mm</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-center text-[10px] text-zinc-500">
            {phase === 0 ? "Le filtre colmaté est plus foncé et couvert de poussière." : "Toutes les dimensions sont en millimètres."}
          </p>
        </div>
      </GameBoard>
    </GameFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Équilibrage du vilebrequin (poser des masses)                       */
/* ------------------------------------------------------------------ */

type CrankMass = { grams: number; angle: number };
const CRANK_WEIGHTS = [5, 10, 15] as const;
const crankClock = (deg: number) => Math.round(norm360(deg) / 30) || 12;

function createCrankRound() {
  return {
    heavyAngle: Math.floor(Math.random() * 12) * 30,
    heavyGrams: 10 + Math.floor(Math.random() * 4) * 5,
  };
}

function CrankshaftBalanceGame({ name, onWin, onMiss }: GameProps) {
  const [round] = useState(createCrankRound);
  const [masses, setMasses] = useState<CrankMass[]>([]);
  const [weight, setWeight] = useState<(typeof CRANK_WEIGHTS)[number]>(10);
  const [cursor, setCursor] = useState(0);
  const [message, setMessage] = useState("Observez la rotation, puis posez des masses à l'opposé du balourd.");
  const [tone, setTone] = useState<Tone>("idle");
  const tick = useClock(50);
  const win = useWinOnce(onWin);

  const vector = [{ angle: round.heavyAngle, grams: round.heavyGrams }, ...masses].reduce(
    (total, item) => ({
      x: total.x + item.grams * Math.sin((item.angle * Math.PI) / 180),
      y: total.y - item.grams * Math.cos((item.angle * Math.PI) / 180),
    }),
    { x: 0, y: 0 },
  );
  const residual = Math.hypot(vector.x, vector.y);
  const residualAngle = norm360((Math.atan2(vector.x, -vector.y) * 180) / Math.PI);
  const amp = Math.min(5, residual * 0.32);
  const wobbleX = Math.sin(tick / 3) * amp;
  const wobbleY = Math.cos(tick / 4) * amp;
  const heavyAt = { x: 100 + 72 * Math.sin((round.heavyAngle * Math.PI) / 180), y: 100 - 72 * Math.cos((round.heavyAngle * Math.PI) / 180) };
  const cursorAt = { x: 100 + 58 * Math.sin((cursor * Math.PI) / 180), y: 100 - 58 * Math.cos((cursor * Math.PI) / 180) };
  const snapped = (value: number) => norm360(Math.round(value / 30) * 30);

  const place = () => {
    if (masses.length >= 6) {
      setTone("bad");
      setMessage("Six masses suffisent : retirez-en une avant d'en poser une autre.");
      return;
    }
    setMasses((list) => [...list, { grams: weight, angle: cursor }]);
    setTone("idle");
    setMessage(`Masse de ${weight} g·cm posée à ${crankClock(cursor)} h.`);
  };

  const check = () => {
    if (residual <= 3) {
      setTone("ok");
      setMessage(`Balourd résiduel ${residual.toFixed(1)} g·cm : le vilebrequin tourne rond.`);
      win();
      return;
    }
    setTone("bad");
    setMessage(`Balourd résiduel ${residual.toFixed(1)} g·cm vers ${crankClock(residualAngle)} h : ajoutez du poids à l'opposé.`);
    onMiss();
  };

  return (
    <GameFrame
      name={name}
      badge={`${masses.length} masse${masses.length > 1 ? "s" : ""}`}
      message={message}
      tone={tone}
      footer={
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {CRANK_WEIGHTS.map((grams) => (
              <SmallButton key={grams} aria-pressed={weight === grams} onClick={() => setWeight(grams)} className={weight === grams ? "border-amber-300 text-amber-200" : ""}>
                {grams} g·cm
              </SmallButton>
            ))}
            <SmallButton onClick={place} className="border-amber-400/40 text-amber-200">Poser la masse</SmallButton>
            <SmallButton disabled={masses.length === 0} onClick={() => setMasses((list) => list.slice(0, -1))}>Retirer</SmallButton>
          </div>
          <ActionButton onClick={check}>Lancer le contrôle</ActionButton>
        </div>
      }
    >
      <GameBoard className="p-2">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,.08),transparent_68%)]" />
        <Rotary angle={cursor} onChange={(value) => setCursor(snapped(value))} label="Position de la masse sur le vilebrequin" step={30} className="relative mx-auto aspect-square w-full max-w-[340px]">
          <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
            <defs>
              <radialGradient id="crank-glow" cx="50%" cy="50%" r="50%">
                <stop offset="58%" stopColor="#fbbf24" stopOpacity="0" />
                <stop offset="88%" stopColor="#fbbf24" stopOpacity=".09" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="crank-steel" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#d4d4d8" />
                <stop offset="42%" stopColor="#71717a" />
                <stop offset="58%" stopColor="#3f3f46" />
                <stop offset="100%" stopColor="#18181b" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="98" fill="url(#crank-glow)" />
            <g transform={`translate(${wobbleX.toFixed(2)} ${wobbleY.toFixed(2)})`}>
              <circle cx="100" cy="100" r="78" fill="#0b0c10" stroke="#3f3f46" strokeWidth="2" />
              <circle cx="100" cy="100" r="68" fill="none" stroke="#52525b" strokeWidth="1" strokeDasharray="4 5" opacity=".55" />
              <path d="M100 30 A70 70 0 0 1 160 60 L135 92 A28 28 0 0 0 100 78 Z" fill="url(#crank-steel)" stroke="#111114" strokeWidth="1.5" />
              <path d="M100 170 A70 70 0 0 1 40 140 L65 108 A28 28 0 0 0 100 122 Z" fill="url(#crank-steel)" stroke="#111114" strokeWidth="1.5" />
              <circle cx="100" cy="100" r="30" fill="#17191d" stroke="#a1a1aa" strokeWidth="2" />
              <circle cx="100" cy="100" r="18" fill="url(#crank-steel)" stroke="#3f3f46" strokeWidth="1.4" />
              <circle cx="100" cy="100" r="6" fill="#0a0a0c" stroke="#d4d4d8" strokeWidth="1.2" />
              {[0, 90, 180, 270].map((angle) => {
                const at = { x: 100 + 57 * Math.sin((angle * Math.PI) / 180), y: 100 - 57 * Math.cos((angle * Math.PI) / 180) };
                return <circle key={angle} cx={at.x} cy={at.y} r="4" fill="#0a0a0c" stroke="#71717a" strokeWidth="1" />;
              })}
              <g transform={`translate(${heavyAt.x} ${heavyAt.y})`} style={{ filter: "drop-shadow(0 0 6px rgba(248,113,113,.85))" }}>
                <circle r="12" fill="rgba(239,68,68,.35)" stroke="#f87171" strokeWidth="2.2" />
                <text y="3" fontSize="8" fontWeight="700" fill="#fecaca" textAnchor="middle">{round.heavyGrams}</text>
              </g>
              {masses.map((mass, index) => {
                const at = { x: 100 + 72 * Math.sin((mass.angle * Math.PI) / 180), y: 100 - 72 * Math.cos((mass.angle * Math.PI) / 180) };
                return (
                  <g key={index} transform={`translate(${at.x} ${at.y}) rotate(${mass.angle})`} style={{ filter: "drop-shadow(0 0 3px rgba(251,191,36,.6))" }}>
                    <rect x="-7" y="-4" width="14" height="8" rx="2" fill="#fbbf24" stroke="#fde68a" strokeWidth="1" />
                    <text x="0" y="2.6" fontSize="5.5" fontWeight="700" fill="#451a03" textAnchor="middle">{mass.grams}</text>
                  </g>
                );
              })}
              <circle cx={cursorAt.x} cy={cursorAt.y} r="10" fill="none" stroke="#34d399" strokeWidth="2.2" strokeDasharray="5 3" />
              <circle cx={cursorAt.x} cy={cursorAt.y} r="2.5" fill="#6ee7b7" />
              <line x1="100" y1="100" x2={100 + Math.min(48, residual * 2.4) * Math.sin((residualAngle * Math.PI) / 180)} y2={100 - Math.min(48, residual * 2.4) * Math.cos((residualAngle * Math.PI) / 180)} stroke={residual <= 3 ? "#34d399" : "#f87171"} strokeWidth="3" strokeLinecap="round" />
            </g>
            <text x="100" y="194" fontSize="6" letterSpacing="1.4" textAnchor="middle" fill="#71717a">VUE DE FACE · VILEBREQUIN</text>
          </svg>
        </Rotary>
        <p className="px-2 pb-1 text-center text-xs text-zinc-300">
          Balourd : <b className="text-red-300">{round.heavyGrams} g·cm à {crankClock(round.heavyAngle)} h</b> · résiduel : <b className={residual <= 3 ? "text-emerald-300" : "text-amber-200"}>{residual.toFixed(1)} g·cm</b> · objectif ≤ 3 g·cm
        </p>
        {masses.length > 0 && (
          <p className="px-2 pb-1 text-center text-[10px] text-zinc-500">
            {masses.map((mass) => `${mass.grams} g à ${crankClock(mass.angle)} h`).join(" · ")}
          </p>
        )}
      </GameBoard>
    </GameFrame>
  );
}

export const ENGINE_GAMES = {
  stetho: StethoscopeGame,
  timing: TimingMarksGame,
  cooling: CoolingCircuitGame,
  valves: ValveClearanceGame,
  leak: LeakSearchGame,
  firing: FiringOrderGame,
  rods: RodAssemblyGame,
  compression: CompressionGame,
  ignition: IgnitionTimingGame,
  airFilter: FilterChangeGame,
  crankBalance: CrankshaftBalanceGame,
} satisfies Record<string, ComponentType<GameProps>>;

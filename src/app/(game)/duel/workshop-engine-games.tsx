"use client";

/** Mini-jeux moteur : stéthoscope, distribution, refroidissement, soupapes, fuites, allumage. */

import { useEffect, useState, type ComponentType } from "react";
import { Check, Droplets, Wrench } from "lucide-react";
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

export const ENGINE_GAMES = {
  stetho: StethoscopeGame,
  timing: TimingMarksGame,
  cooling: CoolingCircuitGame,
  valves: ValveClearanceGame,
  leak: LeakSearchGame,
  firing: FiringOrderGame,
} satisfies Record<string, ComponentType<GameProps>>;

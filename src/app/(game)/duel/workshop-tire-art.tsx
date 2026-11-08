"use client";

/**
 * Illustrations partagées des mini-jeux pneus : roue vue de dessus en vectoriel
 * (précise pour les overlays) et roue photoréaliste issue des cartes du jeu.
 */

import { useId } from "react";

export type TireVariant = "road" | "worn" | "slick";

const TREAD_COUNT = 44;
const polar = (cx: number, cy: number, radius: number, deg: number) => ({
  x: cx + radius * Math.sin((deg * Math.PI) / 180),
  y: cy - radius * Math.cos((deg * Math.PI) / 180),
});

/** Roue complète, à insérer dans un SVG (viewBox 200 × 200 par défaut). */
export function TireFace({
  cx = 100,
  cy = 100,
  size = 100,
  spin = 0,
  variant = "road",
  opacity = 1,
}: {
  cx?: number;
  cy?: number;
  size?: number;
  spin?: number;
  variant?: TireVariant;
  opacity?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `tire-${uid}-${name}`;

  return (
    <g transform={`translate(${cx} ${cy}) scale(${size / 100}) rotate(${spin})`} opacity={opacity}>
      <defs>
        <radialGradient id={id("rubber")} cx="36%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#5c5c64" />
          <stop offset="42%" stopColor="#2b2b31" />
          <stop offset="100%" stopColor="#0f0f12" />
        </radialGradient>
        <linearGradient id={id("rim")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8eaee" />
          <stop offset="30%" stopColor="#9699a2" />
          <stop offset="54%" stopColor="#43464e" />
          <stop offset="72%" stopColor="#c9ccd3" />
          <stop offset="100%" stopColor="#565961" />
        </linearGradient>
        <radialGradient id={id("disc")} cx="38%" cy="32%" r="82%">
          <stop offset="0%" stopColor="#4e5158" />
          <stop offset="100%" stopColor="#121418" />
        </radialGradient>
        <radialGradient id={id("sheen")} cx="32%" cy="20%" r="62%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Gomme */}
      <circle r="99" fill={`url(#${id("rubber")})`} stroke="#060608" strokeWidth="2" />

      {/* Bande de roulement */}
      {variant === "slick" ? (
        <>
          <circle r="91" fill="none" stroke="#45454d" strokeWidth=".7" strokeOpacity=".5" />
          <circle r="80" fill="none" stroke="#17171b" strokeWidth="2.4" />
        </>
      ) : (
        <g>
          {Array.from({ length: TREAD_COUNT }, (_, i) => {
            const angle = i * (360 / TREAD_COUNT);
            const long = i % 2 === 0;
            return (
              <g key={i} transform={`rotate(${angle})`}>
                <path
                  d={long ? "M-7 97 L7 97 L10.5 79 L-10.5 79 Z" : "M-5.5 96 L5.5 96 L8 81 L-8 81 Z"}
                  fill={variant === "worn" ? "#2d2d33" : "#35353c"}
                  stroke="#0b0b0e"
                  strokeWidth="1"
                />
                <path d="M0 96 L0 81" stroke="#141418" strokeWidth="1.2" />
                {long && <path d="M-3.2 94 L-4.2 83 M3.2 94 L4.2 83" stroke="#1b1b20" strokeWidth=".8" />}
              </g>
            );
          })}
          <circle r="96.5" fill="none" stroke="#15151a" strokeWidth="1.2" />
          <circle r="79" fill="none" stroke="#16161b" strokeWidth="2.4" />
        </g>
      )}

      {/* Flancs et marquages */}
      <circle r="74" fill="none" stroke="#3d3d44" strokeWidth="1.1" strokeOpacity=".8" />
      <circle r="69.5" fill="none" stroke="#26262c" strokeWidth="2.4" />
      <defs>
        <path id={id("side")} d="M -76 0 A 76 76 0 1 1 76 0" fill="none" />
      </defs>
      <text fontSize="4.2" letterSpacing="1.4" fill="#a1a1ab" opacity=".5">
        <textPath href={`#${id("side")}`} startOffset="50%" textAnchor="middle">
          PNEU ROUTE · 225/45 R17 · M+S
        </textPath>
      </text>

      {/* Jante */}
      <circle r="68" fill={`url(#${id("rim")})`} stroke="#24262b" strokeWidth="1.6" />
      <circle r="60.5" fill="#15171b" stroke="#777b83" strokeWidth="1" />
      <circle r="58" fill={`url(#${id("disc")})`} />

      {/* Disque percé */}
      <g fill="#0c0d10" opacity=".85">
        {Array.from({ length: 20 }, (_, i) => {
          const at = polar(0, 0, 46, i * 18);
          return <circle key={i} cx={at.x} cy={at.y} r="1.9" />;
        })}
      </g>
      <circle r="58.5" fill="none" stroke="#8a8e96" strokeWidth=".6" opacity=".45" />

      {/* Rayons doubles */}
      {Array.from({ length: 5 }, (_, i) => (
        <g
          key={i}
          transform={`rotate(${i * 72})`}
          fill={`url(#${id("rim")})`}
          stroke="#2a2d32"
          strokeWidth="1.1"
          strokeLinejoin="round"
        >
          <path d="M-4 -63 L-8 -56 L-19 -53 L-10 -21 L-3 -20 Z" />
          <path d="M4 -63 L8 -56 L19 -53 L10 -21 L3 -20 Z" />
          <path d="M-2.6 -31 L2.6 -31 L2 -17 L-2 -17 Z" fill="#202329" />
        </g>
      ))}

      {/* Moyeu et écrous */}
      <circle r="18" fill={`url(#${id("rim")})`} stroke="#393c42" strokeWidth="1.2" />
      <g fill="#202329" stroke="#9da1a9" strokeWidth=".8">
        {Array.from({ length: 5 }, (_, i) => {
          const at = polar(0, 0, 11.5, i * 72 + 36);
          return <circle key={i} cx={at.x} cy={at.y} r="2.8" />;
        })}
      </g>
      <circle r="8" fill="#17191d" stroke="#b9bcc4" strokeWidth="1.4" />
      <circle r="3" fill="#0b0c0f" />

      {/* Reflets */}
      <circle r="99" fill={`url(#${id("sheen")})`} />
      <ellipse cx="-28" cy="-48" rx="40" ry="18" fill="#ffffff" opacity=".055" transform="rotate(-30 -28 -48)" />
    </g>
  );
}

/** Roue photoréaliste (carte Pneu Route) fondue dans le plateau. */
export function TirePhoto({
  spin = 0,
  opacity = 1,
  size = "86%",
  glow = "amber",
  className = "",
}: {
  spin?: number;
  opacity?: number;
  size?: string;
  glow?: "amber" | "hot" | "none";
  className?: string;
}) {
  const halo =
    glow === "hot"
      ? "radial-gradient(circle, rgba(248,113,113,.26), rgba(248,113,113,.08) 52%, transparent 70%)"
      : glow === "amber"
        ? "radial-gradient(circle, rgba(251,191,36,.16), rgba(251,191,36,.05) 50%, transparent 70%)"
        : "transparent";
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <span
        className="absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: size, background: halo }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- illustration décorative déjà optimisée en WebP */}
      <img
        src="/cards/pneus/_route.webp"
        alt=""
        draggable={false}
        className="absolute left-1/2 top-1/2 aspect-square object-contain mix-blend-screen"
        style={{
          width: size,
          transform: `translate(-50%, -50%) rotate(${spin}deg)`,
          opacity,
          filter: "drop-shadow(0 18px 30px rgba(0,0,0,.7))",
        }}
      />
    </div>
  );
}

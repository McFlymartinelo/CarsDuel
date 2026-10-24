/** Pneu stylisé (jante à 5 branches). `ring` = classes de couleur du trait extérieur de la jante. */
export function TireIcon({ className = "h-8 w-8", ring = "stroke-emerald-500" }: { className?: string; ring?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="32" r="28" className="fill-zinc-900 stroke-zinc-600" strokeWidth="2" />
      <circle cx="32" cy="32" r="20" className={`fill-none ${ring}`} strokeWidth="3" />
      <circle cx="32" cy="32" r="6" className="fill-zinc-500" />
      {[0, 72, 144, 216, 288].map((a) => (
        <line key={a} x1="32" y1="32" x2="32" y2="14" className="stroke-zinc-400" strokeWidth="3" transform={`rotate(${a} 32 32)`} />
      ))}
    </svg>
  );
}

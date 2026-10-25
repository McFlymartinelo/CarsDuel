"use client";

import { useEffect, useState } from "react";

function label(ms: number): string {
  if (ms <= 0) return "Disponible";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h} h ${pad(m)} min ${pad(s)} s`;
}

/** Décompte jusqu'à la prochaine disponibilité d'un tirage. */
export function PullCountdown({ until }: { until: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const tick = () => setText(label(new Date(until).getTime() - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [until]);

  return (
    <p className="mt-2 text-sm text-zinc-300">
      Prochain tirage dans <span className="font-display text-lg font-bold text-amber-300 tabular-nums">{text}</span>
    </p>
  );
}

"use client";

import Image from "next/image";
import { useState } from "react";
import { Medal, Trophy } from "lucide-react";

/** Visuel d'un compteur de la vitrine, avec icône de secours si l'illustration n'est pas encore fournie. */
export function TrophyArt({ src, alt, kind }: { src: string; alt: string; kind: "trophy" | "medal" }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    const Icon = kind === "medal" ? Medal : Trophy;
    return <Icon aria-hidden className="h-full w-full text-amber-400/70" strokeWidth={1.2} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="96px"
      className="object-contain drop-shadow-[0_0_14px_rgba(245,158,11,0.28)]"
      onError={() => setFailed(true)}
    />
  );
}

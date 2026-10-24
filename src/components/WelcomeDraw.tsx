"use client";

import { useRouter } from "next/navigation";
import { CardDraw } from "@/components/CardDraw";
import type { DrawnCard } from "@/lib/types";

export function WelcomeDraw({ cards }: { cards: DrawnCard[] }) {
  const router = useRouter();
  if (cards.length === 0) return null;
  return (
    <CardDraw
      cards={cards}
      title="Premier tirage — le garage était vide"
      onClose={() => router.replace("/garage")}
    />
  );
}

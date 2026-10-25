"use client";

import { useEffect } from "react";
import { visitQuest } from "@/app/(game)/quests";

/** Marque une visite de page pour les défis, au chargement réel (pas au préchargement). */
export function QuestPing({ quest }: { quest: "inventaire" | "boutique" | "marketplace" | "leaderboard" }) {
  useEffect(() => {
    void visitQuest(quest);
  }, [quest]);
  return null;
}

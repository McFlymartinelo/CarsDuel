export interface DailyQuestState {
  second: string;
  third: string;
  progress: Record<string, number>;
  claimed: string[];
}

export const QUEST_COPY: Record<string, { title: string; detail: string }> = {
  pointage: { title: "Pointage au paddock", detail: "Se connecter." },
  inventaire: { title: "Vérification des niveaux", detail: "Ouvrir son inventaire." },
  boutique: { title: "Coup d'œil sur l'étal", detail: "Visiter la boutique." },
  recycle_bonus: { title: "Nettoyage de printemps", detail: "Recycler une carte bonus." },
  duel: { title: "Échauffement", detail: "Terminer un duel." },
  duels_2: { title: "La routine", detail: "Participer à 2 duels." },
  duels_3: { title: "En mode turbo", detail: "Participer à 3 duels." },
  attaque: { title: "Viser le sommet", detail: "Tenter une attaque sur un adversaire." },
  defense: { title: "Tenir la position", detail: "Subir un duel en défense." },
  bonus: { title: "Consommation interne", detail: "Utiliser une carte bonus pendant un duel." },
  bonus_2: { title: "Coup de boost", detail: "Faire 2 duels avec une carte bonus." },
  pneus_90: { title: "Préventif", detail: "Faire un duel avec des pneus à 90 % de gomme restante minimum." },
  leaderboard: { title: "Regarder le sommet", detail: "Consulter le leaderboard." },
  marketplace: { title: "Regarder la vitrine", detail: "Consulter la Marketplace." },
  matin: { title: "Pilote matinal", detail: "Lancer un duel avant midi." },
  nuit: { title: "Pilote nocturne", detail: "Lancer un duel entre 20 h et 23 h 59." },
  rebond: { title: "Le rebond", detail: "Lancer un duel juste après une défaite." },
  win_attaque: { title: "La passe de deux", detail: "Gagner un duel en attaque." },
  win_defense: { title: "Résistance", detail: "Gagner un duel en défense." },
};

export function questDone(id: string, progress: Record<string, number>): boolean {
  const n = (key: string) => Number(progress[key] ?? 0);
  switch (id) {
    case "pointage": return n("connect") >= 1;
    case "inventaire": return n("inventaire") >= 1;
    case "boutique": return n("boutique") >= 1;
    case "recycle_bonus": return n("recycle_bonus") >= 1;
    case "duel": return n("duels") >= 1;
    case "duels_2": return n("duels") >= 2;
    case "duels_3": return n("duels") >= 3;
    case "attaque": return n("attacks") >= 1;
    case "defense": return n("defenses") >= 1;
    case "bonus": return n("bonus_duels") >= 1;
    case "bonus_2": return n("bonus_duels") >= 2;
    case "pneus_90": return n("tire90") >= 1;
    case "leaderboard": return n("leaderboard") >= 1;
    case "marketplace": return n("marketplace") >= 1;
    case "matin": return n("morning") >= 1;
    case "nuit": return n("night") >= 1;
    case "rebond": return n("rebound") >= 1;
    case "win_attaque": return n("attack_wins") >= 1;
    case "win_defense": return n("defense_wins") >= 1;
    default: return false;
  }
}

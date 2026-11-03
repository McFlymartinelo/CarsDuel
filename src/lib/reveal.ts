import "server-only";
import { cardImageUrl } from "@/lib/card-images";
import { GEARBOX_LABEL, TIRE_LABEL } from "@/lib/format";
import type { CardTemplate, DrawnCard } from "@/lib/types";

/** Caractéristiques lisibles d'une carte, sans passer par une instance possédée. */
function templateDetails(t: CardTemplate): string[] {
  const kg = t.weight_kg != null ? `${Number(t.weight_kg).toLocaleString("fr-FR")} kg` : null;

  if (t.category === "moteur") {
    return [
      t.architecture,
      t.power_hp != null ? `${t.power_hp} ch` : null,
      kg,
      "0 run",
      t.garantie > 0 ? `Garantie ${t.garantie} run${t.garantie === 1 ? "" : "s"}` : null,
    ].filter((v): v is string => Boolean(v));
  }

  if (t.category === "boite") {
    return [
      GEARBOX_LABEL[t.gearbox_type ?? ""] ?? t.gearbox_type,
      t.shift_time_ms != null ? `${t.shift_time_ms} ms` : null,
      kg,
      "0 run",
      t.garantie > 0 ? `Garantie ${t.garantie} run${t.garantie === 1 ? "" : "s"}` : null,
    ].filter((v): v is string => Boolean(v));
  }

  if (t.category === "pneus") {
    return [
      TIRE_LABEL[t.tire_type ?? ""] ?? t.tire_type,
      t.tire_base_wear != null ? `${t.tire_base_wear} %/run` : null,
      "Gomme 100 %",
    ].filter((v): v is string => Boolean(v));
  }

  // Les cartes bonus ont une description longue : leur carte de tirage reste
  // volontairement épurée pour ne pas déborder du cadre de révélation.
  return [];
}

export function toDrawn(id: string, template: CardTemplate): DrawnCard {
  return {
    id,
    name: template.name,
    category: template.category,
    rarity: template.rarity,
    tireType: template.tire_type,
    image: cardImageUrl(template),
    details: templateDetails(template),
  };
}

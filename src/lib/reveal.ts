import "server-only";
import { cardImageUrl } from "@/lib/card-images";
import type { CardTemplate, DrawnCard } from "@/lib/types";

export function toDrawn(id: string, template: CardTemplate): DrawnCard {
  return {
    id,
    name: template.category === "bonus" ? (template.description?.trim() || template.name) : template.name,
    category: template.category,
    rarity: template.rarity,
    tireType: template.tire_type,
    image: cardImageUrl(template),
  };
}

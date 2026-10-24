export type Category = "moteur" | "boite" | "pneus" | "bonus";
export type Rarity = "commune" | "rare" | "tres_rare" | "epique" | "legendaire";
export type Weather = "sunny_hot" | "sunny_cool" | "rain_hot" | "rain_cool";

export interface Profile {
  id: string;
  username: string;
  coins: number;
  xp_total: number;
  last_daily_pull: string | null;
  last_weekly_pull: string | null;
}

export interface CardTemplate {
  id: string;
  code: string | null;
  category: Category;
  name: string;
  description: string | null;
  image_url: string | null;
  rarity: Rarity | null;
  weight_kg: number | null;
  base_break_risk: number | null;
  wear_sensitivity: number | null;
  architecture: string | null;
  power_hp: number | null;
  gearbox_type: string | null;
  shift_time_ms: number | null;
  tire_type: string | null;
  tire_base_wear: number | null;
  bonus_effect: string | null;
}

export interface UserCard {
  id: string;
  owner_id: string;
  template_id: string;
  runs_count: number;
  tire_wear: number | null; // gomme restante (100 → 0)
  is_destroyed: boolean;
  is_listed: boolean;
  card_templates: CardTemplate;
}

export interface UserDeck {
  id: string;
  owner_id: string;
  name: string;
  engine_card_id: string;
  gearbox_card_id: string;
  tire_card_id: string;
}

export interface DuelRow {
  id: string;
  attacker_id: string;
  defender_id: string;
  weather: Weather;
  result: "attacker_win" | "defender_win";
  broken_part: Category | null;
  part_saved: boolean;
  attacker_sp: number | null;
  defender_sp: number;
  attacker_coins: number;
  attacker_xp: number;
  defender_coins: number;
  defender_xp: number;
  defender_rewarded: boolean;
  created_at: string;
}

export interface Listing {
  id: string;
  seller_id: string;
  card_id: string;
  price: number | null;
  accepts_offers: boolean;
  status: "active" | "sold" | "cancelled";
  created_at: string;
  user_cards: UserCard;
}

export interface Offer {
  id: string;
  listing_id: string;
  buyer_id: string;
  amount: number;
  status: string;
}

export interface DuelOutcome {
  duel_id: string;
  weather: Weather;
  result: "attacker_win" | "defender_win";
  broken_part: Category | null;
  part_saved: boolean;
  attacker_sp: number | null;
  defender_sp: number;
  coins: number;
  xp: number;
  tire_gum_after: number | null;
  bonus: string | null;
}

/** Retour standard des Server Actions. */
export type ActionState<T = unknown> = { ok: boolean; message?: string; data?: T } | null;

/** Résultat détaillé affiché après un duel (RPC + détails relus dans duels_history). */
export interface DuelReport {
  duelId: string;
  weather: Weather;
  weatherNote: string;
  win: boolean;
  brokenPart: Category | null;
  partSaved: boolean;
  bonus: string | null;
  attackerSp: number | null;
  defenderSp: number;
  defenderName: string;
  scoreMeca: number;
  tireType: string;
  tireBonusPct: number;
  tireMalus: number;
  tireMod: number;
  engineProb: number | null;
  gearboxProb: number | null; // null : non testée (casse moteur)
  coins: number;
  xp: number;
  gumBefore: number;
  gumAfter: number | null;
  engineRun: boolean;
  gearboxRun: boolean;
  engineName: string;
  gearboxName: string;
  tireName: string;
  yourPower: number;
  yourEngineWeight: number;
  yourGearWeight: number;
  yourShift: number;
  ghostPower: number;
  ghostEngineWeight: number;
  ghostGearWeight: number;
  ghostShift: number;
  ghostGum: number;
  ghostTireType: string;
}

/** Carte révélée par un tirage (quotidien ou kit de départ). */
export interface DrawnCard {
  id: string;
  name: string;
  category: Category;
  rarity: Rarity | null;
  tireType: string | null;
  image: string | null;
}

export type Category = "moteur" | "boite" | "pneus" | "bonus";
export type Rarity = "commune" | "rare" | "tres_rare" | "epique" | "legendaire";
export type Weather = "sunny_hot" | "sunny_cool" | "rain_hot" | "rain_cool";

export interface Profile {
  id: string;
  username: string;
  coins: number;
  /** Cubes de ferraille (centre de recyclage). */
  scrap_cubes: number;
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
  restricted_to_username: string | null;
  /** Garantie constructeur en runs (moteur / boîte). */
  garantie: number;
}

export interface UserCard {
  id: string;
  owner_id: string;
  template_id: string;
  runs_count: number;
  runs_total: number; // runs réellement courus (ne se réinitialise pas à la réparation)
  wins_count: number; // duels gagnés par la carte (moteur/boîte)
  warranty_duels: number; // garantie constructeur de l'instance (en runs)
  warranty_used: number; // runs courus sous garantie (jamais remis à zéro)
  warranty_extended: boolean; // prolongation déjà utilisée (une seule fois)
  tire_wear: number | null; // gomme restante (100 → 0)
  is_destroyed: boolean;
  is_listed: boolean;
  /** Déposée dans la benne du centre de recyclage (inutilisable en deck). */
  in_recycle_bin: boolean;
  source?: string;
  acquired_at?: string;
  card_templates: CardTemplate;
}

export interface UserDeck {
  id: string;
  owner_id: string;
  name: string;
  engine_card_id: string | null;
  gearbox_card_id: string | null;
  tire_card_id: string | null;
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

/** Une instance de carte prête pour l'affichage dans les échanges (image résolue côté serveur). */
export interface TradeCard extends UserCard {
  image: string | null;
}

export type TradeSide = "proposer" | "recipient";

export interface TradeItem {
  id: string;
  trade_id: string;
  side: TradeSide;
  card_id: string;
  user_cards: TradeCard;
}

export interface TradeOffer {
  id: string;
  proposer_id: string;
  recipient_id: string;
  proposer_coins: number;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired" | "failed";
  created_at: string;
  updated_at: string;
  expires_at: string;
  items: TradeItem[];
}

/** Résultat d'une RPC d'échange. `ok: false` = vérification métier échouée (offre supprimée). */
export interface TradeResult {
  ok: boolean;
  reason?: "cards_unavailable" | "insufficient_funds" | "expired";
  accepted?: boolean;
  id?: string;
  tax?: number;
  coins_offered?: number;
}

export interface TradePartner {
  user: { id: string; username: string };
  cards: TradeCard[];
}

/** Entrée d'autocomplétion de la recherche de joueur. */
export interface TradePlayerSuggestion {
  id: string;
  username: string;
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
  weatherLines: string[];
  win: boolean;
  brokenPart: Category | null;
  partSaved: boolean;
  bonus: string | null;
  attackerSp: number | null;
  defenderSp: number | null;
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
  gumAfter: number | null;
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
  ghostScoreMeca: number;
  ghostTireBonusPct: number;
  ghostTireMalus: number;
  ghostTireMod: number;
}

export type ClmMedal = "bronze" | "silver" | "gold";

export interface ClmCircuit {
  id: string;
  name: string;
  distance_km: number;
  profile: string;
  t_base: number;
  k_circuit: number;
  medals_seconds: Record<ClmMedal, number>;
}

export interface ClmPersonalBest {
  seconds: number;
  sp: number | null;
  achieved_on: string;
}

/** Défi du jour du Contre-La-Montre solo. */
export interface ClmChallenge {
  day: string;
  weather: Weather;
  circuit: ClmCircuit;
  personal_best: ClmPersonalBest | null;
  claimed: ClmMedal[];
  participation_claimed: boolean;
  attempts: number;
  /** Prochain minuit à Paris, pour le compte à rebours de rotation. */
  changes_at: string;
}

/** Résultat d'une tentative de Contre-La-Montre solo. */
export interface ClmReport {
  attemptId: string;
  day: string;
  weather: Weather;
  circuitId: string;
  circuitName: string;
  brokenPart: Category | null;
  partSaved: boolean;
  bonus: string | null;
  spFinal: number | null;
  lapSeconds: number | null;
  previousBest: number | null;
  personalBest: number | null;
  isNewRecord: boolean;
  medal: ClmMedal | null;
  newMedals: ClmMedal[];
  medalsCoins: number;
  participationCoins: number;
  coins: number;
  /** XP réellement créditée, calée sur les montants de base (jamais multipliés). */
  xpGained: number;
  /** Coefficient de rang appliqué aux pièces au moment du gain (×1 à ×3). */
  rankMultiplier: number;
  claimed: ClmMedal[];
  participationClaimed: boolean;
  tireGumBefore: number;
  tireGumAfter: number | null;
  tireDestroyed: boolean;
  engineBreakProb: number | null;
  gearboxBreakProb: number | null;
  scoreMeca: number;
  tireType: string;
  tireBonusPct: number;
  tireMalus: number;
  tireMod: number;
  engineName: string;
  gearboxName: string;
  tireName: string;
}

export type DynoMedal = "bronze" | "silver" | "gold";

/** Contrainte simple d'un défi du Banc d'essai. */
export type DynoConstraint =
  | { type: "tire_type"; value: string }
  | { type: "max_power_hp"; value: number }
  | { type: "max_weight_total_kg"; value: number }
  | { type: "max_engine_weight_kg"; value: number }
  | { type: "max_gearbox_weight_kg"; value: number }
  | { type: "min_shift_time_ms"; value: number };

export interface DynoConfig {
  id: string;
  name: string;
  description: string;
  constraints: DynoConstraint[];
  medals_sp: Record<DynoMedal, number>;
}

export interface DynoDailyBest {
  sp: number;
  day: string;
  updated_at: string;
}

/** Défi du jour du Banc d'essai. */
export interface DynoChallenge {
  day: string;
  weather: Weather;
  config: DynoConfig;
  personal_best: DynoDailyBest | null;
  claimed: DynoMedal[];
  /** Prime du premier passage du jour déjà récupérée. */
  participation_claimed: boolean;
  attempts: number;
  /** Prochain minuit UTC, pour le compte à rebours de rotation. */
  changes_at: string;
}

/** Résultat d'un passage au banc. */
export interface DynoReport {
  attemptId: string;
  day: string;
  weather: Weather;
  configId: string;
  configName: string;
  spFinal: number;
  scoreMeca: number;
  previousBest: number | null;
  personalBest: number;
  isNewRecord: boolean;
  medal: DynoMedal | null;
  newMedals: DynoMedal[];
  medalsCoins: number;
  participationCoins: number;
  coins: number;
  /** XP réellement créditée, calée sur les montants de base (jamais multipliés). */
  xpGained: number;
  /** Coefficient de rang appliqué aux pièces au moment du gain (×1 à ×3). */
  rankMultiplier: number;
  claimed: DynoMedal[];
  participationClaimed: boolean;
  tireType: string;
  tireGum: number;
  tireBonusPct: number;
  tireMalus: number;
  tireMod: number;
  engineName: string;
  gearboxName: string;
  tireName: string;
  powerHp: number;
  engineWeightKg: number;
  gearboxWeightKg: number;
  shiftTimeMs: number;
}

/** Carte révélée par un tirage (quotidien ou kit de départ). */
export interface DrawnCard {
  id: string;
  name: string;
  category: Category;
  rarity: Rarity | null;
  tireType: string | null;
  image: string | null;
  /** Caractéristiques affichées sous le nom lors de la révélation. */
  details?: string[];
}

/** Prix de référence d'un modèle : moyenne des dernières ventes (vue market_price_ref). */
export interface PriceRef {
  avg_price: number;
  sales: number;
}

/** Une vente ou un achat clos (fonction my_market_history). `net` = gain après taxe, côté vendeur. */
export interface MarketHistoryRow {
  id: string;
  role: "sale" | "purchase";
  card_name: string;
  category: Category;
  price: number;
  net: number;
  closed_at: string;
}

export type NotificationKind =
  | "offer_received"
  | "sale"
  | "offer_accepted"
  | "offer_rejected"
  | "duel_won"
  | "duel_lost"
  | "duel_request"
  | "duel_accepted"
  | "duel_declined"
  | "trade_received"
  | "trade_accepted"
  | "trade_declined"
  | "trade_expired"
  | "trade_failed"
  | "payout";

export interface NotificationItem {
  kind: NotificationKind;
  at: string;
  label: string;
  amount: number;
  item_count?: number;
  expires_at?: string | null;
  unread: boolean;
}

export interface NotificationFeed {
  unread: number;
  items: NotificationItem[];
}

/** Pièce équipée affichée dans le mode Configs Constructeur (sans sa marque, qui fait partie de l'énigme). */
export interface ConfigPart {
  code: string;
  name: string;
  /** Intacte et non en vente : utilisable pour la validation. */
  ok: boolean;
}

/** Défi du mode Configs Constructeur : semaine courante, teaser, progression et historique. */
export interface ConfigChallenge {
  week_start: string;
  /** Lundi 00:00 UTC suivant, pour le compte à rebours. */
  ends_at: string;
  reward: { coins: number; xp: number };
  challenge: { slug: string; label: string; riddle: string } | null;
  next: { riddle: string } | null;
  found: number;
  total: number;
  equipped: { engine: ConfigPart; gearbox: ConfigPart } | null;
  history: { engine: string; gearbox: string }[];
}

export type ConfigStatus = "validated" | "duplicate" | "mismatch";

/** Résultat d'une validation de paire. `mismatch` et `duplicate` ne sont pas des erreurs. */
export interface ConfigReport {
  status: ConfigStatus;
  engine_code: string;
  gearbox_code: string;
  engine_ok: boolean;
  gearbox_ok: boolean;
  coins: number;
  xp: number;
  found: number;
  total: number;
}

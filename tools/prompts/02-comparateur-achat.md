# Prompt — Point 2 : comparateur à l'achat (Boutique / Marché)

Tu travailles dans le dépôt **CarsDuel** (Next.js 16, React 19, Tailwind v4, TypeScript, PostgreSQL).
Objectif : dans la **Boutique** et le **Marché**, afficher pour chaque pièce son écart avec la configuration
équipée, exactement comme la maquette `public/mockups/comparateur-achat.html`
(styles dans `public/mockups/comparateur-achat.css`).

Contraintes absolues :
- **Ne modifie pas** les fichiers de maquette (`public/mockups/*`).
- **Aucune migration, aucune dépendance npm, aucun appel réseau supplémentaire côté client.**
- La comparaison est calculée **côté serveur**, avec le deck déjà chargé par la page.
- Tout le texte est en français, virgule décimale, signe moins `−` (U+2212), unités `ch`, `kg`, `ms`, `%`, `pts`.

---

## 0. À lire avant d'écrire du code

1. `public/mockups/comparateur-achat.html` + `.css` : référence visuelle officielle (3 écrans :
   détail carte boutique, vue liste, annonce marché).
   URL : `http://localhost:3000/mockups/comparateur-achat.html`.
2. `src/lib/game.ts` : `scoreMeca`, `currentBreakRisk`, `tireModifier`, `tireMalus`.
3. `src/lib/types.ts` : `CardTemplate`, `UserCard`, `UserDeck`, `Weather`.
4. `src/lib/queries.ts` : `CARD_SELECT` (l.36), `qDecks` (l.69), `loadMarketplacePage` (l.306),
   `loadShopPage` (l.452).
5. `src/app/(game)/shop/page.tsx` : rendu des cartes (l.55-64 et 104-124).
6. `src/app/(game)/marketplace/page.tsx` : helper `card()` (l.115-125), `othersGrid` (l.158-214),
   section « Annonces » (l.257+).
7. `src/components/CardView.tsx` : props (l.142-158), emplacement d'insertion après la gomme (l.289-294).
8. `src/components/CardRow.tsx` : props (l.11-26), emplacement à droite (l.94).
9. `src/app/(game)/duel/page.tsx` : `const config = allDecks[0]` (l.74) — **la config équipée = `decks[0]`**.
10. `tests/unit/card-groups.test.mjs` : style des tests (`node:test`, import direct du `.ts`).

---

## 1. Créer `src/lib/compare.ts` (pur, testable)

```ts
import { currentBreakRisk, scoreMeca, tireModifier } from "@/lib/game";
import type { CardTemplate, UserCard, Weather } from "@/lib/types";

export type CompareTone = "good" | "bad" | "neutral";

export interface CompareChip {
  label: string;
  tone: CompareTone;
}

export interface CardComparison {
  headline: string;   // "+6,2 pts" | "−3,8 pts" | "+12 %"
  caption: string;    // "de score mécanique estimé" | "de modificateur pneus (moyenne)"
  tone: "good" | "bad";
  reference: string;  // nom de la pièce équipée correspondante
  chips: CompareChip[];
}

export interface EquippedPart {
  card: Pick<UserCard, "runs_count" | "tire_wear">;
  template: CardTemplate;
}

export interface EquippedConfig {
  engine: EquippedPart;
  gearbox: EquippedPart;
  tire: EquippedPart;
}

export interface TirePerfRow {
  tire_type: string;
  weather: string;
  perf_bonus_pct: number | string;
}

/**
 * Renvoie `null` quand il n'y a rien à comparer :
 * bonus, même modèle que la pièce équipée, pneus sans données météo.
 */
export function compareCandidate(
  template: CardTemplate,
  card: Pick<UserCard, "runs_count" | "tire_wear"> | null,
  equipped: EquippedConfig,
  tirePerfs: TirePerfRow[],
): CardComparison | null;
```

### 1.1 Formatage

- `f(n, d)` : `n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })`.
- `signed(n, d)` : renvoie `"0"` si `|n| < 0.05`, sinon `+` ou `−` (U+2212) + `f(Math.abs(n), d)`.
- `pt` / `pts` : singulier si `|v| < 2`.

### 1.2 Moteur (`template.category === "moteur"`)

```ts
const before = scoreMeca(equipped.engine.template, equipped.gearbox.template);
const after  = scoreMeca(template, equipped.gearbox.template);
const delta  = after - before;
```

- `headline = signed(delta, 1) + " pts"`, `caption = "de score mécanique estimé"`,
  `reference = equipped.engine.template.name`, `tone = delta >= 0 ? "good" : "bad"`.
- Chips (2 ou 3) :
  1. Puissance : `template.power_hp - equipped.engine.template.power_hp` →
     `signed(v, 0) + " ch"`, `good` si `v > 0`, `bad` si `v < 0`, `neutral` si `v === 0`.
  2. Poids : `template.weight_kg - equipped.engine.template.weight_kg` →
     `signed(v, 0) + " kg"`, `good` si `v < 0` (plus léger), `bad` si `v > 0`.
  3. Risque (si les deux risques sont non nuls) :
     `currentBreakRisk(template, card?.runs_count ?? 0) - currentBreakRisk(equipped.engine.template, equipped.engine.card.runs_count)` →
     `"risque " + signed(v, 1) + " pt"`, `bad` si `v > 0`, `good` si `v < 0`.

### 1.3 Boîte (`template.category === "boite"`)

- Même principe : `scoreMeca(equipped.engine.template, template)` contre
  `scoreMeca(equipped.engine.template, equipped.gearbox.template)`.
- `reference = equipped.gearbox.template.name`.
- Chips :
  1. Temps de passage : `template.shift_time_ms - equipped.gearbox.template.shift_time_ms` →
     `signed(v, 0) + " ms"`, `good` si `v < 0` (plus rapide), `bad` si `v > 0`.
  2. Poids : `template.weight_kg - equipped.gearbox.template.weight_kg` → `signed(v, 0) + " kg"` (plus léger = `good`).
  3. Risque : idem moteur, avec `equipped.gearbox`.
- Ne jamais comparer un moteur à une boîte : chaque catégorie garde son emplacement.

### 1.4 Pneus (`template.category === "pneus"`)

Comparaison **météo par météo** (4 météos), avec `tireModifier(bonus, gomme)` :

```ts
const gumC = card?.tire_wear ?? 100;
const gumE = equipped.tire.card.tire_wear ?? 100;
const perf = new Map(tirePerfs.map((p) => [`${p.tire_type}|${p.weather}`, Number(p.perf_bonus_pct)]));

const weathers: Weather[] = ["sunny_hot", "sunny_cool", "rain_hot", "rain_cool"];
const short: Record<Weather, string> = {
  sunny_hot: "Sec chaud", sunny_cool: "Sec frais",
  rain_hot: "Humide chaud", rain_cool: "Humide frais",
};

const deltas = weathers.map((w) => {
  const bc = perf.get(`${template.tire_type}|${w}`);
  const be = perf.get(`${equipped.tire.template.tire_type}|${w}`);
  if (bc == null || be == null) return null;
  return (tireModifier(bc, gumC) - tireModifier(be, gumE)) * 100; // en points de %
});
if (deltas.some((d) => d == null)) return null;
```

- `average = moyenne des 4 deltas`.
- `headline = signed(average, 1) + " %"`, `caption = "de modificateur pneus (moyenne)"`,
  `reference = equipped.tire.template.name`, `tone = average >= 0 ? "good" : "bad"`.
- Chips : une par météo, `"Sec chaud " + signed(d, 1) + " %"`, tone selon le signe
  (`neutral` si `|d| < 0.05`).
- Si `template.tire_type` est nul ou absent de `tirePerfs` → `null`.

### 1.5 Règles communes

- `category === "bonus"` → `null` (pas d'emplacement équipé comparable).
- Même modèle que la pièce équipée (`template.id === equipped.<slot>.template.id`) → `null`
  (inutile d'afficher « +0,0 pts »).
- Tous les textes utilisent `−` U+2212, jamais `-`.
- Aucun conseil d'achat, uniquement des écarts chiffrés.

---

## 2. Composants client (`src/components/compare/`)

### 2.1 `CompareProvider.tsx`

```tsx
"use client";
```

- Contexte `{ enabled: boolean; toggle(): void }`, exposé par `useCompareEnabled()`.
- `enabled` démarre à `true` (identique serveur/client, pas de mismatch d'hydratation).
- Dans un `useEffect`, lire `localStorage.getItem("carsduel.compare")` ; si `"off"` → `setEnabled(false)`.
- `toggle()` inverse l'état et écrit `"on"` / `"off"` dans `localStorage`.
- Si `useCompareEnabled()` est utilisé hors provider : lever une erreur explicite.

### 2.2 `CompareBar.tsx`

```tsx
"use client";
props: { equipped: { engine: string; gearbox: string; tire: string } | null }
```

Reproduit la barre `.refbar` de la maquette :

- Conteneur : `flex items-center gap-2 rounded-xl border border-line bg-panel px-2.5 py-2`.
- Pastille : `grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-300`,
  icône `Gauge size={14}`.
- Kicker : `font-display text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-500`
  → `Comparé à votre config`.
- Config : `flex flex-wrap gap-x-1.5 font-display text-[11.5px] font-bold uppercase leading-tight text-zinc-100`
  → `V8 5.0 · DCT 7 · Sport` (noms des templates, séparateur `·` en `text-zinc-500`).
- Interrupteur : `<button type="button" role="switch" aria-checked={enabled}
  aria-label="Comparer à ma configuration">` avec
  `inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-display text-[8.5px] font-bold uppercase tracking-[0.08em]`
  + état actif `border-emerald-500/30 bg-emerald-500/10 text-emerald-400` / inactif
  `border-white/10 bg-white/[0.03] text-zinc-400`. Point : `h-3.5 w-3.5 rounded-full` + `bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]`
  (gris quand désactivé). Texte `Activé` / `Désactivé`.
- Si `equipped === null` : afficher `Aucune config équipée` (kicker `Comparé à votre config`) et
  aucun interrupteur. Les comparaisons ne seront de toute façon pas rendues.

### 2.3 `CardCompare.tsx`

```tsx
"use client";
props: { comparison: CardComparison; variant?: "block" | "badge" }
```

- `useCompareEnabled()` ; si `!enabled` → `return null`.
- **`variant="block"`** (détail de carte) :
  - Conteneur : `mt-3 rounded-xl border p-2.5` +
    `border-emerald-400/30 bg-emerald-500/[0.07]` (tone good) ou
    `border-red-400/30 bg-red-500/[0.07]` (tone bad).
  - En-tête : `flex items-baseline justify-between gap-2` ;
    label `font-display text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-500` → `Vs votre config` ;
    référence `truncate font-display text-[10px] font-bold uppercase text-zinc-200` (`comparison.reference`).
  - Chiffre : `mt-1 flex items-baseline gap-1.5 font-display text-xl font-bold leading-none`
    + `text-emerald-400` / `text-red-400` ; `<small>` = `text-[10px] font-medium text-zinc-400` (`comparison.caption`).
  - Chips : `mt-2 flex flex-wrap gap-1` ; chip
    `inline-flex items-center rounded-full border px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wide` ;
    good `border-emerald-400/30 bg-emerald-500/10 text-emerald-300`,
    bad `border-red-400/30 bg-red-500/10 text-red-300`,
    neutral `border-white/10 text-zinc-400`.
- **`variant="badge"`** (vue liste) :
  - `flex flex-col items-end text-right` ;
  - valeur `font-display text-base font-bold leading-none text-emerald-400` / `text-red-400` (reprendre
    `comparison.headline` sans l'unité pour rester compact, ou la valeur complète si elle tient) ;
  - légende `mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-zinc-500` :
    `score méca` pour moteur/boîte, `pneus` pour les pneus.

---

## 3. Étendre `CardView` et `CardRow`

- `CardView` : ajouter une prop optionnelle `compare?: React.ReactNode` et la rendre **après** le bloc
  « Gomme restante » (l.289-293), **avant** `{children}` :
  ```tsx
  {compare && <div className="relative z-10 mt-3">{compare}</div>}
  ```
- `CardRow` : ajouter `compare?: React.ReactNode` et la rendre **avant** `{children}` :
  ```tsx
  {compare && <div className="ml-auto flex shrink-0 items-center">{compare}</div>}
  ```
  (la ligne est en `flex-wrap` : le badge passe à la ligne sur mobile, aligné à droite sur desktop).
- Ne rien changer d'autre au rendu ni aux styles existants.

---

## 4. Charger la configuration équipée (`src/lib/queries.ts`)

Ajouter un helper interne, à côté de `qDecks` :

```ts
async function qEquipped(c: PoolClient, uid: string): Promise<EquippedConfig | null> {
  const deck = (await c.query<UserDeck>(
    "select * from user_decks where owner_id = $1 order by created_at limit 1", [uid],
  )).rows[0];
  if (!deck) return null;

  const ids = [deck.engine_card_id, deck.gearbox_card_id, deck.tire_card_id];
  const cards = (await c.query<UserCard>(
    `${CARD_SELECT} where uc.id = any($1::uuid[])`, [ids],
  )).rows;
  const byId = new Map(cards.map((x) => [x.id, x]));
  const engine = byId.get(deck.engine_card_id!);
  const gearbox = byId.get(deck.gearbox_card_id!);
  const tire = byId.get(deck.tire_card_id!);
  if (!engine || !gearbox || !tire) return null;

  return {
    engine: { card: engine, template: engine.card_templates },
    gearbox: { card: gearbox, template: gearbox.card_templates },
    tire: { card: tire, template: tire.card_templates },
  };
}
```

- `deck.engine_card_id` etc. sont `uuid not null` en base : l'assertion non-null est sûre, mais garder les
  vérifications `!engine || ...` pour les cartes supprimées.
- `loadShopPage` : ajouter `equipped: await qEquipped(c, uid)` au retour.
- `loadMarketplacePage` : ajouter `equipped: await qEquipped(c, uid)` au retour.
- Aucune requête en plus que ces deux lectures (deck + cartes), déjà dans la même transaction.

---

## 5. Brancher la Boutique (`src/app/(game)/shop/page.tsx`)

1. Destructurer `equipped` depuis `loadShopPage`.
2. Envelopper le contenu dans `<CompareProvider>` (à l'intérieur de `CatalogViewProvider`).
3. Insérer `<CompareBar equipped={equipped ? { engine: equipped.engine.template.name, gearbox: equipped.gearbox.template.name, tire: equipped.tire.template.name } : null} />`
   **entre** `<PageHeader>` et `<CatalogFilters>` (comme la maquette).
4. Helper local :
   ```tsx
   const compare = (t: CardTemplate, card: null, variant: "block" | "badge") => {
     if (!equipped) return undefined;
     const comparison = compareCandidate(t, card, equipped, tirePerfs);
     return comparison ? <CardCompare comparison={comparison} variant={variant} /> : undefined;
   };
   ```
   (les articles de boutique sont neufs : `card = null`, `runs_count = 0`, gomme 100).
5. Passer `compare={compare(it.card_templates, null, "block")}` à chaque `CardView`
   et `compare={compare(it.card_templates, null, "badge")}` à chaque `CardRow`.
6. Ne pas toucher aux actions d'achat (`ShopBuyForm`) ni aux filtres.

---

## 6. Brancher le Marché (`src/app/(game)/marketplace/page.tsx`)

1. Destructurer `equipped` depuis `loadMarketplacePage`.
2. Envelopper le retour de la vue « marché » dans `<CompareProvider>`
   (la branche `espace=echanges` reste inchangée).
3. Insérer `<CompareBar ... />` après `<MarketplaceTabs>` dans la première section (l.226-227).
4. Étendre le helper `card()` avec un paramètre `withCompare = false` :
   ```tsx
   const card = (x, mode, children, note?, withCompare = false) => { ... }
   ```
   Quand `withCompare && equipped` :
   - calculer `compareCandidate(x.user_cards.card_templates, x.user_cards, equipped, tirePerfs)` ;
   - passer `compare={<CardCompare comparison={comparison} variant={mode === "liste" ? "badge" : "block"} />}`
     à `CardView` / `CardRow`.
5. Dans `othersGrid` uniquement, appeler `card(x, mode, ..., ..., true)`.
   `mineGrid` reste sans comparaison (ce sont vos propres annonces).
6. Les annonces d'occasion utilisent bien `x.user_cards.runs_count` pour le risque actuel et
   `x.user_cards.tire_wear` pour la gomme — ne pas utiliser `base_break_risk` seul.
7. Ne pas modifier `PriceHint`, les offres, ni les onglets.

---

## 7. Cas limites

- Aucun deck (`equipped === null`) : barre « Aucune config équipée », aucune comparaison, aucun crash.
- Deck incomplet ou carte supprimée : `qEquipped` renvoie `null`.
- Pièce bonus : pas de comparaison.
- Pièce identique à celle équipée : pas de comparaison.
- `power_hp`, `weight_kg`, `shift_time_ms` ou `base_break_risk` nuls : `scoreMeca` / `currentBreakRisk`
  les traitent déjà comme `0`, ne pas ajouter de division.
- Pneus : une météo sans modificateur → pas de comparaison pneus (pas de moitié de bloc).
- Marché : le risque affiché tient compte des runs de l'annonce, pas du risque initial.
- Le toggle ne doit déclencher **aucune navigation ni refetch** : tout est déjà rendu côté serveur.
- Pas de mismatch d'hydratation : l'état initial est `true` des deux côtés, `localStorage` n'est lu qu'en effet.

---

## 8. Tests — `tests/unit/compare.test.mjs`

Style `node:test` + `node:assert/strict`, import direct de `../../src/lib/compare.ts` et `../../src/lib/game.ts`.
Fabrique des `CardTemplate` minimalistes (`power_hp`, `weight_kg`, `shift_time_ms`, `base_break_risk`,
`wear_sensitivity`, `category`, `tire_type`, `id`, `name`) et une `EquippedConfig` fixe.

Cas obligatoires :
1. **Moteur plus puissant** → `headline` commence par `+`, `caption === "de score mécanique estimé"`,
   chip puissance `good`, chip poids `bad` si plus lourd.
2. **Moteur plus faible** → `headline` commence par `−` (U+2212), `tone === "bad"`.
3. **Boîte plus rapide** (`shift_time_ms` inférieur) → `headline` positif, chip `−N ms` en `good`.
4. **Pneus** : 4 chips (`Sec chaud`, `Sec frais`, `Humide chaud`, `Humide frais`), moyenne correcte,
   `caption === "de modificateur pneus (moyenne)"`.
5. **Bonus** → `null`.
6. **Même modèle que l'équipé** → `null`.
7. **Risque occasion** : `runs_count = 7` augmente le risque affiché et produit un chip `risque +… pt` en `bad`.
8. **Formatage** : présence de `,` décimale et de `−` (U+2212) dans les libellés négatifs.

Lancement rapide : `node --test tests/unit/compare.test.mjs`.

---

## 9. Validation

```bash
npm run typecheck
npx eslint src/lib/compare.ts src/components/compare src/components/CardView.tsx src/components/CardRow.tsx \
  src/lib/queries.ts "src/app/(game)/shop/page.tsx" "src/app/(game)/marketplace/page.tsx"
node --test tests/unit/compare.test.mjs
```

Puis vérification visuelle :
- `/shop` : barre de référence + bloc de comparaison sous les stats, puis basculer en vue liste (`?vue=liste`)
  pour vérifier les pastilles.
- `/marketplace` : barre + bloc sur les annonces des autres joueurs, avec le risque réel de l'occasion.
- Comparer côte à côte avec `public/mockups/comparateur-achat.html` (espacements, tailles, couleurs).
- Recharger la page après avoir désactivé l'interrupteur : l'état doit être conservé.

## 10. Critères d'acceptation

- [ ] Boutique et Marché affichent la barre « Comparé à votre config » avec l'interrupteur.
- [ ] Le bloc de carte correspond à la maquette : chiffre principal, référence, 2-3 chips colorés.
- [ ] La vue liste affiche une pastille compacte alignée à droite.
- [ ] Les pneus sont comparés météo par météo, les occasions avec leur risque actuel.
- [ ] Désactiver l'interrupteur masque immédiatement toutes les comparaisons, sans navigation.
- [ ] Aucune comparaison pour les bonus, les pièces identiques ou l'absence de deck.
- [ ] Aucune requête client, migration ou dépendance ajoutée ; calcul serveur uniquement.
- [ ] `typecheck`, `eslint` et les tests unitaires passent.
- [ ] Aucun fichier de `public/mockups/` modifié.

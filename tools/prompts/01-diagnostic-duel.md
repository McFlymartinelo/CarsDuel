# Prompt — Point 1 : diagnostic de fin de duel

Tu travailles dans le dépôt **CarsDuel** (Next.js 16, React 19, Tailwind v4, TypeScript, PostgreSQL).
Objectif : ajouter, sous le verdict de l'écran de résultat, un bloc **« diagnostic »** identique à la maquette
`public/mockups/duel-diagnostic.html` (styles dans `public/mockups/duel-diagnostic.css`).

Contraintes absolues :
- **Ne modifie pas** les fichiers de maquette (`public/mockups/*`).
- **Aucune migration, aucune requête supplémentaire, aucune dépendance npm.**
- Le diagnostic est calculé **uniquement** à partir du `DuelReport` déjà chargé.
- Tout le texte est en français, avec virgule décimale, signe moins `−` (U+2212) et unités `ch`, `kg`, `ms`, `%`, `pts`.

---

## 0. À lire avant d'écrire du code

1. `public/mockups/duel-diagnostic.html` et `public/mockups/duel-diagnostic.css` : référence visuelle officielle
   (3 écrans : défaite pneus, victoire mécanique, casse moteur). Ouvre-la dans le navigateur si besoin :
   `http://localhost:3000/mockups/duel-diagnostic.html`.
2. `src/components/DuelResult.tsx` : écran cible (verdict lignes 71-76, actions lignes 78-105).
3. `src/lib/types.ts` : `DuelReport` (lignes 171-209).
4. `src/app/(game)/duel/actions.ts` (lignes 100-160) : construction du `DuelReport`. Points importants :
   - `engineProb` / `gearboxProb` sont des **pourcentages 0-100** (`null` = non testée).
   - Côté défenseur, `tireMalus` vaut `0` et la gomme est normalisée à 100 ; `ghostTireMalus` / `ghostGum`
     décrivent alors l'adversaire.
5. `src/lib/game.ts` : `tireMalus`, `tireModifier`, `scoreMecaRaw` (pour comprendre les échelles, sans les rejouer).
6. `src/lib/format.ts` : `WEATHER_LABEL`, `TIRE_LABEL`, `TIRE_THEME`.
7. `tests/unit/card-groups.test.mjs` : style des tests unitaires (`node:test`, import direct du `.ts`).

---

## 1. Créer `src/lib/duel-diagnosis.ts`

Fichier **pur** : pas de React, pas de `server-only`, pas d'accès base. Il exporte :

```ts
export type DiagnosisTone = "good" | "bad" | "warn";

export type DiagnosisIcon = "wrench" | "gauge" | "tire" | "alert" | "flag";

export interface DiagnosisDelta {
  label: string;
  tone: DiagnosisTone;
}

export interface DiagnosisHint {
  label: string;
  href: string;
  icon: "wrench" | "tire" | "gauge";
}

export interface DuelDiagnosis {
  tone: DiagnosisTone;
  icon: DiagnosisIcon;
  eyebrow: string;
  title: string;
  reason: string;
  deltas: DiagnosisDelta[];
  hint?: DiagnosisHint;
}

export function diagnoseDuel(r: DuelReport): DuelDiagnosis;
```

### 1.1 Écarts calculés (en points de score, signe positif = votre avantage)

```ts
const mecaEdge = r.scoreMeca - r.ghostScoreMeca;

// Modificateur « pur météo », sans l'usure : tireMod = 1 + (bonus − malus) / 100
const fitEdge =
  (r.tireMod - r.ghostTireMod + (r.tireMalus - r.ghostTireMalus) / 100) * r.scoreMeca;

// Part de l'usure seule (le malus est en points de %)
const gumEdge = ((r.ghostTireMalus - r.tireMalus) * r.scoreMeca) / 100;
```

Seuil de significativité : **2,5 points**. En dessous, aucun facteur ne domine.

### 1.2 Arbre de décision (ordre strict)

1. **Casse** : `r.brokenPart !== null`.
   - `tone = "warn"`, `icon = "wrench"`.
   - `eyebrow = "Le point de bascule"`.
   - Titre : `"Casse moteur"` ou `"Casse boîte"`.
   - Si `r.partSaved` : titre `"Casse évitée par la garantie"`, `tone = "good"`,
     raison « Le risque était de X % : la garantie constructeur a pris en charge la réparation. ».
   - Sinon raison : « Le risque était de **X %** au départ : la casse a mis fin à la course avant le calcul final. »
     (`prob = brokenPart === "moteur" ? r.engineProb : r.gearboxProb`). Si `prob == null`, phrase de repli :
     « La casse a mis fin à la course avant le calcul final. »
   - Chips : `Risque X %` (tone `bad`), `Boîte non testée` (tone `warn`) si `r.gearboxProb === null`,
     `Pièce sauvée` (tone `good`) si `r.partSaved`.
   - `hint = { label: "Aller à l'atelier", href: "/garage", icon: "wrench" }` (sauf si `partSaved`).
2. **Victoire ou défaite sans casse** : calculer les trois « déficits » (positifs = préjudiciables) :
   `mecaDeficit = -mecaEdge`, `fitDeficit = -fitEdge`, `gumDeficit = -gumEdge`.
   - **Défaite** : retenir le plus grand des trois. Priorité en cas d'égalité (à 0,5 pt près) :
     **pneus/météo > mécanique > gomme**. Ne retenir un facteur que si son déficit `>= 2.5`,
     sinon → course serrée.
   - **Victoire** : mêmes calculs avec les valeurs signées (`fitEdge`, `mecaEdge`, `gumEdge`).
     Retenir le plus grand avantage `>= 2.5` (priorité pneus > mécanique > gomme),
     sinon → victoire serrée.

### 1.3 Titres et tons

| Cas | Titre défaite | Titre victoire | eyebrow | tone |
|---|---|---|---|---|
| Pneus/météo | `Pneus inadaptés à la pluie` (météo humide) / `Pneus inadaptés au sec` | `Les pneus ont fait la course` | `Le point de bascule` / `Ce qui a fait la différence` | `bad` / `good` |
| Mécanique | `La mécanique a creusé l'écart` | `La mécanique a dominé` | idem | `bad` / `good` |
| Gomme | `Gomme en fin de vie` | `La gomme a tenu` | idem | `warn` / `good` |
| Serrée | `Course serrée` | `Victoire acquise de justesse` | `Analyse de la course` | `warn` / `good` |

Icônes : pneus → `"tire"`, mécanique → `"gauge"`, gomme → `"alert"`, serrée → `"flag"`.

### 1.4 Phrases (gabarits exacts)

Utilise `f(n, d)` = `n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })`
et un helper `signed(n, d)` qui préfixe `+` ou `−` (U+2212) et renvoie `0` sans signe.

- **Pneus, défaite** (exemple de la maquette) :
  - mécanique devant : `Votre mécanique est légèrement devant (+1,7 pt), mais vos Route rendent ×0,91 contre ×1,08 pour ses Pluie. L'écart vient des pneus.`
  - mécanique derrière : `Votre mécanique accuse −8,3 pts et vos Route rendent ×0,91 contre ×1,08 pour ses Pluie : les pneus ont aggravé l'écart.`
  - mécanique équivalente (`|mecaEdge| < 1`) : `Vos Route rendent ×0,91 contre ×1,08 pour ses Pluie, sur une mécanique équivalente : l'écart vient des pneus.`
  - Utiliser `TIRE_LABEL[r.tireType]` / `TIRE_LABEL[r.ghostTireType]`, `r.tireMod` / `r.ghostTireMod` formatés à 2 décimales.
- **Pneus, victoire** : `Vos Pluie rendent ×1,08 contre ×0,91 pour ses Route : les pneus ont fait la course.`
- **Mécanique** :
  - victoire : `Vous aviez +21 ch et −38 ms au passage. Vos pneus étaient un peu moins affûtés (×1,02 contre ×1,05), mais la mécanique a largement compensé.`
  - défaite : `Vous perdiez −21 ch et +38 ms au passage : la mécanique a creusé l'écart.`
  - Écarts : `r.yourPower - r.ghostPower`, `r.yourShift - r.ghostShift`, `-` pour le poids si utile
    (`r.yourEngineWeight + r.yourGearWeight` contre `r.ghostEngineWeight + r.ghostGearWeight`).
  - La clause pneus n'est ajoutée que si `|r.tireMod - r.ghostTireMod| >= 0.02` ; sinon terminer après « compensé. »
- **Gomme** : `Votre gomme est descendue à 42 % (malus −9) contre 78 % chez l'adversaire : l'usure a coûté 3,8 pts.`
  (`r.gumAfter ?? 100`, `r.tireMalus`, `r.ghostGum`, `Math.abs(gumEdge)`).
- **Serrée** : `Aucun facteur ne s'est détaché : 2,1 pts d'écart au score mécanique et un écart de pneus limité.`
  (utiliser `Math.abs(mecaEdge)` et `Math.abs(fitEdge)`).

### 1.5 Chips (`deltas`)

Toujours 2 ou 3 chips, jamais plus. Exemples :
- Pneus : `Pneus ×0,91 vs ×1,08` (`bad`), `Mécanique +1,7 pt` (`good` si positif, `bad` sinon).
- Mécanique : `+21 ch` (`good`), `−38 ms` (`good`), `Pneus ×1,02 vs ×1,05` (`bad`).
- Gomme : `Gomme 42 % vs 78 %` (`bad`), `Malus −9 vs 0` (`bad`).
- Serrée : `Écart 2,1 pts` (`neutral` → utiliser `warn`), `Pneus ×0,99 vs ×1,01` (`bad`).
- Casse : voir 1.2.

Libellés au singulier/pluriel : `pt` si `|v| < 2`, `pts` sinon.

### 1.6 Hints

- Pneus / gomme : `{ label: "Changer de pneus", href: "/duel?slot=pneus", icon: "tire" }`.
- Mécanique : `{ label: "Voir la configuration", href: "/duel?slot=moteur", icon: "gauge" }`
  (utiliser `slot=boite` si le delta de temps de passage est le facteur dominant).
- Casse : `{ label: "Aller à l'atelier", href: "/garage", icon: "wrench" }`.
- Course serrée : pas de hint.

---

## 2. Créer `src/components/DuelDiagnosis.tsx`

Composant serveur, sans état. Il appelle `diagnoseDuel(r)` et reproduit la maquette.

```tsx
import Link from "next/link";
import { Flag, Gauge, Lightbulb, TriangleAlert, Wrench } from "lucide-react";
import { diagnoseDuel } from "@/lib/duel-diagnosis";
import type { DuelReport } from "@/lib/types";

const ICONS = { wrench: Wrench, gauge: Gauge, tire: Lightbulb, alert: TriangleAlert, flag: Flag };

export function DuelDiagnosis({ r }: { r: DuelReport }) { /* ... */ }
```

Structure et classes (Tailwind v4, tokens existants `panel`, `line`) :

- Conteneur : `<section className={"duel-rise rounded-xl border p-3 " + box[tone]}>`
  - `bad` : `border-red-400/40 bg-gradient-to-br from-red-500/10 to-transparent`
  - `good` : `border-emerald-400/35 bg-gradient-to-br from-emerald-500/10 to-transparent`
  - `warn` : `border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-transparent`
- En-tête : `flex items-start gap-2.5`.
  - Pastille icône : `grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border` +
    `border-red-400/40 bg-red-500/10 text-red-300` (idem emerald/amber), icône `size={16}`.
  - Eyebrow : `font-display text-[8.5px] font-bold uppercase tracking-[0.16em]` +
    `text-red-300` / `text-emerald-300` / `text-amber-300`.
  - Titre : `mt-0.5 font-display text-lg font-bold uppercase leading-tight text-white`.
- Raison : `mt-1.5 text-[11px] leading-relaxed text-zinc-400`, les valeurs en `<b className="font-semibold text-zinc-100">`.
- Chips : `mt-2 flex flex-wrap gap-1.5` ; chip de base
  `inline-flex items-center rounded-full border px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-wide whitespace-nowrap`
  + `border-red-400/35 bg-red-500/10 text-red-300` / emerald / `border-white/10 bg-white/[0.03] text-zinc-400` (warn = amber).
- Hint : `mt-2.5 inline-flex items-center gap-1 font-display text-[10.5px] font-bold uppercase tracking-wide text-amber-300 hover:text-amber-200`,
  icône `size={13}`.

Rendu attendu (fidèle à la maquette) :

```
[icône]  LE POINT DE BASCULE
         PNEUS INADAPTÉS À LA PLUIE
Votre mécanique est légèrement devant (+1,7 pt), mais vos Route rendent ×0,91
contre ×1,08 pour ses Pluie. L'écart vient des pneus.
[Pneus ×0,91 vs ×1,08] [Mécanique +1,7 pt]
↻ Changer de pneus
```

---

## 3. Intégrer dans `src/components/DuelResult.tsx`

- Importer `DuelDiagnosis`.
- Insérer `<DuelDiagnosis r={r} />` **entre** le bloc verdict (ligne 71-76) et le bloc d'actions (ligne 78),
  sans toucher au reste, sans changer les marges (`space-y-3` du parent suffit).
- Ne pas dupliquer le diagnostic dans les colonnes de score.

---

## 4. Cas limites à couvrir

- `r.brokenPart` avec `partSaved = true`.
- `r.engineProb === null` et/ou `r.gearboxProb === null`.
- `r.gumAfter === null`.
- `r.tireType` absent de `TIRE_LABEL` → repli sur la valeur brute.
- Perspective défenseur (`tireMalus = 0`, `scoreMeca` normalisé) : le diagnostic doit rester cohérent et ne
  jamais afficher « vous » pour les données de l'adversaire.
- Écarts tous sous le seuil : le bloc doit quand même s'afficher (course serrée), jamais `null`.
- Aucune exception si un score est `0` (division : ne jamais diviser par `scoreMeca`).

---

## 5. Tests — `tests/unit/duel-diagnosis.test.mjs`

Style : `node:test` + `node:assert/strict`, import direct `../../src/lib/duel-diagnosis.ts`.
Crée une fonction `report(overrides = {})` qui renvoie un `DuelReport` complet et neutre, puis surcharge.

Cas obligatoires :
1. Casse moteur (`brokenPart: "moteur"`, `engineProb: 4.8`) → `tone === "warn"`, titre `Casse moteur`,
   chip `Risque 4,8 %`, hint `/garage`.
2. Casse évitée (`partSaved: true`) → `tone === "good"`, titre `Casse évitée par la garantie`, pas de hint atelier.
3. Défaite pneus (méca devant de 1,7 pt, `tireMod 0.91` vs `1.08`) → titre `Pneus inadaptés à la pluie`,
   au moins un chip commençant par `Pneus ×0,91`.
4. Victoire mécanique (`scoreMeca 102.7` vs `94.6`, `tireMod 1.02` vs `1.05`) → titre `La mécanique a dominé`,
   chips `+21 ch` et `−38 ms` (adapter aux valeurs du fixture).
5. Course serrée (tous les écarts < 2,5 pts) → titre `Course serrée` / `Victoire acquise de justesse`, `hint` absent.
6. Gomme (`tireMalus 9` vs `0`, `gumAfter 42`, écarts mécaniques faibles) → titre `Gomme en fin de vie`, tone `warn`.
7. Formatage : vérifier la présence de `−` (U+2212) et de la virgule décimale dans `reason` / `deltas`.

Lancement rapide : `node --test tests/unit/duel-diagnosis.test.mjs`.

---

## 6. Validation

```bash
npm run typecheck
npx eslint src/lib/duel-diagnosis.ts src/components/DuelDiagnosis.tsx src/components/DuelResult.tsx
node --test tests/unit/duel-diagnosis.test.mjs
```

Puis vérification visuelle sur `/duel` : provoquer un duel (ou utiliser un compte de test) et comparer
côte à côte avec `public/mockups/duel-diagnostic.html` (espacement, tailles de titre, couleurs, chips).

## 7. Critères d'acceptation

- [ ] Le bloc apparaît exactement sous le verdict, au-dessus des boutons, sans casser la grille des scores.
- [ ] Les 3 états de la maquette sont reproduits (pneus, mécanique, casse) avec les mêmes tons.
- [ ] Une seule phrase + 2 ou 3 chips ; ton factuel, jamais culpabilisant ; aucune recommandation d'achat.
- [ ] Aucune requête, migration ou dépendance ajoutée ; `DuelReport` reste la seule source.
- [ ] `typecheck`, `eslint` et les tests unitaires passent.
- [ ] Aucun fichier de `public/mockups/` modifié.

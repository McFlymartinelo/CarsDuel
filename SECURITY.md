# Suivi sécurité

## 2026-10-29 — `postcss` embarqué par Next.js (point ouvert)

Commande de vérification :

```bash
npm audit --omit=dev
```

État constaté : **2 vulnérabilités** (1 haute, 1 modérée), toutes deux portées par
`postcss` embarqué dans Next.js :

- `GHSA-6g55-p6wh-862q` / `GHSA-r28c-9q8g-f849` : lecture arbitraire de fichiers
  via `sourceMappingURL` (haute) ;
- `GHSA-qx2v-qp2m-jg93` / `GHSA-fxqj-rqcc-2cmp` : XSS / divulgation de fichiers
  `.map` (modérée).

**Version cible : `next@16.4.3`** (première version corrigée), avec
`eslint-config-next@16.4.3`.

### Tentative de montée majeure (2026-10-29)

La mise à jour vers Next 16.4.3 a été tentée :

- `npm audit --omit=dev` → **0 vulnérabilité** ;
- `npm run typecheck` → OK ;
- `npm test` → OK ;
- `npm run build` → OK (Turbopack).

Elle a été annulée dans ce lot car `eslint-config-next@16` active
`eslint-plugin-react-hooks` v7, dont les nouvelles règles
(`react-hooks/set-state-in-effect`, `react-hooks/refs`) remontent **16 erreurs**
dans des composants existants hors périmètre (AccountForms, CardDraw,
DailyPull, DuelForm, MobileFilterUi, Modal, OrganizedDuels…).
Corriger ces effets demanderait un refactor fonctionnel séparé ; désactiver les
règles masquerait des problèmes réels.

### Risque résiduel et mitigation

Les vulnérabilités `postcss` concernent le traitement de CSS à la compilation.
L'application ne compile aucun CSS fourni par un joueur : les styles sont
statiques (Tailwind). Le risque pratique est donc limité, mais l'upgrade reste à
planifier.

### Plan de sortie

1. Lot dédié « Next 16 » : corriger les effets concernés ou ajuster explicitement
   la configuration React Hooks, puis mettre à jour `next` et
   `eslint-config-next` vers `16.4.3+`.
2. Revérifier `npm audit --omit=dev`, `npm run typecheck`, `npm run lint`,
   `npm test` et `npm run build`.
3. Supprimer cette note une fois la montée effectuée.

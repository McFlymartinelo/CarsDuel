# CarsDuel

Jeu de cartes automobile asynchrone. Next.js 15 (App Router) + PostgreSQL **pur** : aucun service tiers, aucun abonnement.

## Prérequis
- Node.js 20+
- Un serveur **PostgreSQL ≥ 14** (la logique de jeu est en PL/pgSQL : MySQL / SQL Server ne conviennent pas sans réécriture).

## Installation
1. **Base de données** — au choix :
   - Docker : `docker compose up -d` (crée la base `carsduel`, utilisateur/mot de passe `carsduel`)
   - ou votre propre serveur : `createdb carsduel` avec un rôle **propriétaire** de la base (il crée tables, rôle `app_user`, fonctions).
2. `cp env.example .env.local` puis ajustez `DATABASE_URL`.
3. `npm install`
4. `npm run db:setup` (migrations + seed minimal : 5 pneus, 6 bonus, vendeur « Magasin de pièces neuves »)
5. *(optionnel, pour tester)* `npm run db:dev-seed` : 6 moteurs, 6 boîtes, pneus en boutique à 20 pièces.
6. `npm run dev` → http://localhost:3000

## Fonctionnement
- **Auth maison** : e-mail + mot de passe (scrypt), session par cookie `httpOnly` (jeton aléatoire, hash SHA-256 stocké dans `sessions`).
- **Sécurité des données** : chaque requête joueur s'exécute dans une transaction `SET LOCAL ROLE app_user` + `app.user_id` ⇒ la RLS PostgreSQL s'applique. Les écritures de jeu passent par des fonctions `SECURITY DEFINER` qui revérifient l'identité.
- **Kit de départ** : à l'inscription, le garage n'a pas de configuration. Le joueur reçoit 1 moteur commun, 1 boîte commune, 5 cartes bonus et 1 pneu de chaque type (si l'e-mail est unique).
- **Tirages gratuits** : 3 bonus par jour calendaire (Europe/Paris), et 1 moteur ou 1 boîte par semaine ISO (reset le lundi, même fuseau).
- Migrations : `db/migrations/*.sql` (appliquées une fois, suivies dans `schema_migrations`, verrou `pg_advisory_lock` pour éviter deux migrate en parallèle).

## Limites
- **Connexion** : 5 échecs par e-mail sur 15 min, et 20 tentatives par IP sur 15 min. **Inscription** : 5 par heure et par IP. L'IP client est résolue depuis `x-forwarded-for` selon `TRUSTED_PROXY_COUNT` (nombre de reverse proxies de confiance) : le premier maillon n'est jamais utilisé, car il est forgeable. Derrière un seul proxy, définir `TRUSTED_PROXY_COUNT=1` (le dernier maillon est retenu). Sans configuration (`0` ou absent), l'en-tête est ignoré et l'IP vaut `unknown` : toutes les requêtes partagent alors le même compteur, donc configurez cette variable en production. Message unique en cas de blocage : « Trop de tentatives, réessayez plus tard. » Un login réussi efface les échecs de cet e-mail. L'inscription ne révèle pas si l'e-mail existe déjà.
- **Duels** : attaques illimitées. Le fantôme est tiré au hasard parmi les configs éligibles. Défense : 5 récompenses par jour (Europe/Paris).
- **Marketplace** : prix minimum 1 pièce (ou offres seules). Taxe `floor(prix × 0,90)`. Au plus 3 ventes entre les deux mêmes comptes sur 24 h glissantes.

## Tests et CI
`npm test` crée la base jetable `carsduel_test` (le rôle doit pouvoir `CREATE DATABASE`), applique les migrations et le seed, puis lance les tests `node:test` dans `tests/unit` et `tests/db`. Ne pas pointer ces tests vers la base de développement.
`npm run lint` exécute ESLint (`eslint` + `eslint-config-next`).
`npm run typecheck` vérifie les types.
Le workflow GitHub Actions (`.github/workflows/ci.yml`) démarre Postgres 16 puis enchaîne `npm ci`, typecheck, lint, `db:setup`, tests et build.

## Aperçu local
`tools/dev-preview/index.html` contient un aperçu iframe de développement. Il est volontairement hors de `public/` et exclu de l'image Docker : l'application de production n'expose jamais cette page et conserve `frame-ancestors 'none'` / `X-Frame-Options: DENY`.

Pour l'utiliser, lancez `npm run dev`, puis dans un autre terminal :

```bash
npx serve tools/dev-preview -l 4173
```

Ouvrez ensuite `http://localhost:4173/?base=http://localhost:3000` (le paramètre `base` cible le serveur Next).

## Production
`npm run build && npm start`, avec `DATABASE_URL` défini, derrière HTTPS (cookie `secure` activé en production) et avec `TRUSTED_PROXY_COUNT` ajusté au nombre de reverse proxies.

## Sécurité des dépendances
`npm audit --omit=dev` signale encore 2 vulnérabilités `postcss` embarquées par Next 15. La montée vers Next 16.4.3 a été tentée mais reportée (règles React Hooks 7 incompatibles avec des composants existants). Détail, mitigation et version cible : [SECURITY.md](SECURITY.md).

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
- **Auth maison** : e-mail + mot de passe (scrypt), puis vérification de l'e-mail par un code OTP à 6 chiffres. La session applicative reste **opaque** : jeton aléatoire de 32 octets dans un cookie `gb_session`, hash SHA-256 stocké dans `sessions`, durée 30 jours et révocation immédiate possible. Un JWT HS256 de 15 minutes porte uniquement le défi OTP entre le mot de passe validé et le code validé : il ne donne aucun accès à l'application.
- **Sécurité des données** : chaque requête joueur s'exécute dans une transaction `SET LOCAL ROLE app_user` + `app.user_id` ⇒ la RLS PostgreSQL s'applique. Les écritures de jeu passent par des fonctions `SECURITY DEFINER` qui revérifient l'identité.
- **Kit de départ** : attribué **après vérification de l'e-mail**, une seule fois. Le garage n'a pas de configuration : le joueur reçoit 1 moteur commun, 1 boîte commune, 5 cartes bonus et 1 pneu de chaque type.
- **Tirages gratuits** : 3 bonus par jour calendaire (Europe/Paris), et 1 moteur ou 1 boîte par semaine ISO (reset le lundi, même fuseau).
- **Garantie constructeur** : moteurs et boîtes sont garantis un nombre de runs (export JSON). Une pièce cassée peut être réparée gratuitement au Musée de la casse tant qu'elle n'a pas dépassé sa garantie ; le risque repart de R0 mais la garantie continue son cours. Prolongation de 2 runs, une seule fois par carte et depuis l'inventaire, contre une carte bonus « Révision complète » + 5 pièces, tant que la garantie n'a pas expiré et que la pièce n'est pas cassée.
- **Centre de recyclage** : depuis le garage, moteurs, boîtes et pneus (neufs, usés ou détruits) se déposent dans une benne. Moteurs et boîtes comptent leur poids réel, les pneus 4 kg par carte ; `floor(poids / 10)` cubes de ferraille sont crédités au profil. 25 cubes permettent d'échanger 1 moteur ou 1 boîte reconditionné (0 run). Les cartes bonus ne peuvent jamais entrer dans la benne.
- Migrations : `db/migrations/*.sql` (appliquées une fois, suivies dans `schema_migrations`, verrou `pg_advisory_lock` pour éviter deux migrate en parallèle).

## Vérification e-mail (OTP)
1. **Inscription** : pseudo, e-mail, mot de passe. Le compte est créé avec `email_verified = false` ; aucune session ni kit de départ à ce stade.
2. Un code à 6 chiffres est envoyé (SMTP). Il est stocké **haché** (HMAC-SHA256 + `AUTH_OTP_PEPPER`), valable 10 minutes, avec au plus 5 tentatives et un seul code actif par `(user_id, purpose)`.
3. La vérification crée la session opaque, marque le compte vérifié **une seule fois** et attribue le kit de départ **une seule fois**. Redirection : `/garage?bienvenue=1`.
4. **Connexion** : e-mail + mot de passe. Un code `login` est envoyé pour un compte vérifié (`register` s'il ne l'est pas encore). Après validation : `/garage`.
5. **Renvoi** : cooldown serveur de 30 secondes. Le JWT OTP est gardé en mémoire côté client, jamais dans le stockage navigateur ni dans l'URL.
6. **Changement de mot de passe** : mot de passe actuel obligatoire, puis toutes les autres sessions sont invalidées (la session courante est conservée).

> **Pause temporaire** : `AUTH_OTP_ENABLED=0` désactive la vérification par code (connexion directe après le mot de passe, comptes marqués vérifiés). Défaut `1` — à rétablir dès que le SMTP est opérationnel.

Limites assumées de ce lot :
- le **changement d'e-mail** ne déclenche pas encore de nouvelle vérification OTP ;
- pas de réinitialisation publique du mot de passe, pas d'OAuth, pas de 2FA TOTP.

## Configuration OTP et SMTP
| Variable | Défaut | Rôle |
|---|---|---|
| `AUTH_OTP_PEPPER` | — | Pepper HMAC des codes OTP, obligatoire en production (32+ caractères) |
| `AUTH_OTP_JWT_SECRET` | — | Secret HS256 des JWT OTP, obligatoire en production (32+ caractères) |
| `AUTH_OTP_RESEND_MS` | `30000` | Cooldown de renvoi |
| `AUTH_OTP_TTL_MS` | `600000` | Durée de vie d'un code (10 minutes) |
| `AUTH_OTP_ECHO` | `0` | `1` pour exposer `devOtp` hors production |
| `AUTH_OTP_ENABLED` | `1` | `0` pour mettre la vérification par code en pause (connexion directe, comptes marqués vérifiés) |
| `AUTH_RATE_LIMIT_MAX` | `20` | Tentatives auth / IP / 15 min |
| `AUTH_LOGIN_FAIL_MAX` | `5` | Échecs de connexion / e-mail / 15 min |
| `AUTH_SIGNUP_RATE_LIMIT_MAX` | `5` | Inscriptions / IP / 1 h |
| `AUTH_OTP_RATE_LIMIT_MAX` | `8` | Envois OTP / IP / 15 min |
| `AUTH_OTP_VERIFY_RATE_LIMIT_MAX` | `20` | Vérifications OTP / IP / 15 min |
| `SMTP_URL` | — | Alternative à host/port/user/pass |
| `SMTP_HOST` / `SMTP_PORT` | — | Serveur SMTP |
| `SMTP_USER` / `SMTP_PASS` | — | Identifiants SMTP |
| `SMTP_SECURE` | auto (`465` → oui) | TLS direct |
| `SMTP_FROM` / `MAIL_FROM` | `CarsDuel <noreply@carsduel.app>` | Expéditeur |
| `TRUSTED_PROXY_COUNT` | `0` | Nombre de reverse proxies de confiance |

- **Production** : `AUTH_OTP_PEPPER` et `AUTH_OTP_JWT_SECRET` sont obligatoires (32+ caractères, valeurs de démonstration refusées). Si SMTP est absent ou échoue, l'action renvoie une erreur claire et **ne journalise jamais le code**.
- **Développement** : sans SMTP, le code est affiché dans la console du serveur. Avec Mailpit (`SMTP_HOST=localhost`, `SMTP_PORT=1025`), les mails sont visibles dans son interface. `AUTH_OTP_ECHO=1` permet aussi d'afficher un bouton « Remplir » dans l'UI. `devOtp` n'est jamais renvoyé en production.

## Limites
- **Connexion** : 20 tentatives par IP sur 15 min, et 5 échecs par e-mail sur 15 min. **Inscription** : 5 par heure et par IP. **OTP** : 8 envois et 20 vérifications par IP sur 15 min, plus un cooldown de 30 s par `(utilisateur, purpose)`. L'IP client est résolue depuis `x-forwarded-for` selon `TRUSTED_PROXY_COUNT` (nombre de reverse proxies de confiance) : le premier maillon n'est jamais utilisé, car il est forgeable. Derrière un seul proxy, définir `TRUSTED_PROXY_COUNT=1` (le dernier maillon est retenu). Sans configuration (`0` ou absent), l'en-tête est ignoré et l'IP vaut `unknown` : toutes les requêtes partagent alors le même compteur, donc configurez cette variable en production. Message unique en cas de blocage : « Trop de tentatives, réessayez plus tard. » Un login réussi efface les échecs de cet e-mail. L'inscription ne révèle pas si l'e-mail existe déjà ; le coût scrypt est constant (hash factice pour un e-mail inconnu).
- **Duels** : attaques illimitées. Le fantôme est tiré au hasard parmi les configs éligibles. Défense : 5 récompenses par jour (Europe/Paris).
- **Marketplace** : prix minimum 10 pièces (ou offres seules, offres à partir de 10 pièces). Taxe `floor(prix × 0,90)`. Au plus 3 ventes entre les deux mêmes comptes sur 24 h glissantes.

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
`npm run build && npm start`, avec `DATABASE_URL`, `AUTH_OTP_PEPPER`, `AUTH_OTP_JWT_SECRET` et un SMTP (`SMTP_URL` ou `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`) définis, derrière HTTPS (cookie `secure` activé en production) et avec `TRUSTED_PROXY_COUNT` ajusté au nombre de reverse proxies. Les secrets OTP doivent faire 32 caractères minimum et ne jamais être committés.

## Sécurité des dépendances
`npm audit --omit=dev` signale encore 2 vulnérabilités `postcss` embarquées par Next 15. La montée vers Next 16.4.3 a été tentée mais reportée (règles React Hooks 7 incompatibles avec des composants existants). Détail, mitigation et version cible : [SECURITY.md](SECURITY.md).

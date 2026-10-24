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
- **Kit de départ** (`STARTER_KIT=1`) : 1 Pneu Route + 1 moteur et 1 boîte communs à l'inscription (sans pneu, impossible de jouer). Mettre `0` pour désactiver.
- Migrations : `db/migrations/*.sql` (appliquées une fois, suivies dans `schema_migrations`).

## Production
`npm run build && npm start`, avec `DATABASE_URL` défini, derrière HTTPS (cookie `secure` activé en production).

# Suivi sécurité

## 2026-10-30 — Authentification OTP (vérification e-mail)

### Modèle retenu

- **Session opaque conservée** : jeton aléatoire de 32 octets dans le cookie
  `gb_session` (`httpOnly`, `sameSite=lax`, `secure` en production, 30 jours),
  hash SHA-256 en base. La révocation est immédiate et le changement de mot de
  passe invalide toutes les autres sessions. Aucun JWT de session.
- **JWT OTP court uniquement** : HS256, 15 minutes, `issuer=carsduel`,
  `audience=carsduel-otp`, payload `{ sub, purpose: "otp", otpPurpose }`.
  Vérification stricte (`algorithms`, `iss`, `aud`, `purpose`, `otpPurpose`,
  expiration). Il ne donne aucun accès à l'application. Côté client il reste en
  mémoire React, jamais dans `localStorage`, `sessionStorage`, l'URL ou un log.
- **Code OTP** : 6 chiffres via `crypto.randomInt`, HMAC-SHA256 avec
  `AUTH_OTP_PEPPER`, stocké en hexadécimal, comparé avec `timingSafeEqual`.
  Durée 10 minutes, 5 tentatives maximum, un seul code actif par
  `(user_id, purpose)`, suppression après succès/expiration/5e échec, cooldown de
  renvoi de 30 s.
- **Base** : `public.email_otps` a la RLS activée et aucun privilège pour
  `public`/`app_user` ; seule la connexion propriétaire (`withAdmin`) y accède.
  La migration `20261030000019_otp_auth.sql` est idempotente : les comptes
  existants sont marqués vérifiés, les nouveaux démarrent à `false`.
- **Secrets** : `AUTH_OTP_PEPPER` et `AUTH_OTP_JWT_SECRET` obligatoires en
  production (32 caractères minimum, valeurs de démonstration refusées). Un
  repli local documenté existe hors production.
- **E-mail** : SMTP via nodemailer ; aucun code OTP journalisé quand SMTP est
  configuré, ni jamais en production. Sans SMTP en développement uniquement, le
  code est affiché dans la console du serveur.
- **`devOtp`** : uniquement si `NODE_ENV !== "production"` et (`NODE_ENV =
  "test"` ou `AUTH_OTP_ECHO=1`). Jamais en production.
- **Rate limiting** : `auth_attempts`, IP résolue par `resolveClientIp` +
  `TRUSTED_PROXY_COUNT` (le premier maillon de `x-forwarded-for` n'est jamais
  utilisé). 20 connexions/IP/15 min, 5 échecs/e-mail/15 min, 5 inscriptions/IP/h,
  8 envois OTP/IP/15 min, 20 vérifications OTP/IP/15 min. Message de blocage
  unique.
- **Énumération** : messages génériques à l'inscription et à la connexion, coût
  scrypt constant via un vrai hash factice quand l'e-mail est inconnu.
- **Erreurs** : aucune erreur PostgreSQL brute renvoyée au client ; les logs ne
  contiennent ni mot de passe, ni jeton, ni hash, ni code OTP.
- **Redirections** : chemins internes fixes calculés côté serveur
  (`/garage?bienvenue=1` ou `/garage`), jamais une URL fournie par le client.

### Limites assumées de ce lot

- Le **changement d'e-mail** ne déclenche pas encore de vérification OTP : le
  mot de passe actuel reste exigé, l'unicité et la normalisation sont conservées.
  Un lot ultérieur devra exiger un OTP sur la nouvelle adresse.
- Pas de réinitialisation publique du mot de passe, pas d'OAuth, pas de 2FA TOTP.
- `middleware.ts` reste un simple garde-fou de présence du cookie ; la session
  est toujours relue en base par `getCurrentUser()` / `requireUser()`.

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

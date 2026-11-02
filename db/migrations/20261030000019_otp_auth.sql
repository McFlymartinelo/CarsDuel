-- =============================================================================
-- 20261030000019 : vérification e-mail par OTP
-- Idempotente, sans perte de données.
-- Les comptes existants sont marqués vérifiés ; les nouveaux démarrent à false.
-- `email_otps` n'est accessible qu'au propriétaire (withAdmin), jamais à app_user.
-- =============================================================================

-- ---------- users.email_verified --------------------------------------------
alter table public.users add column if not exists email_verified boolean;

-- Comptes déjà en base : considérés comme vérifiés (aucune perte d'accès ni de kit).
update public.users set email_verified = true where email_verified is null;

alter table public.users alter column email_verified set default false;
alter table public.users alter column email_verified set not null;

comment on column public.users.email_verified is
  'Adresse e-mail vérifiée par OTP. Les comptes antérieurs à la migration sont marqués true.';

-- ---------- Codes OTP --------------------------------------------------------
create table if not exists public.email_otps (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.users (id) on delete cascade,
  email      text not null,
  purpose    text not null check (purpose in ('register', 'login')),
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, purpose)
);

create index if not exists idx_email_otps_email_purpose
  on public.email_otps (email, purpose);
create index if not exists idx_email_otps_expires_at
  on public.email_otps (expires_at);

alter table public.email_otps enable row level security;
revoke all on public.email_otps from public, app_user;

comment on table public.email_otps is
  'Codes OTP hachés (HMAC-SHA256 + pepper) ; accès réservé à withAdmin. Un seul code actif par (user_id, purpose).';

-- ---------- Documentation des kinds de rate limiting -------------------------
comment on table public.auth_attempts is
  'Tentatives d''authentification pour le rate limiting (purgées après 24 h).';
comment on column public.auth_attempts.kind is
  'login_ip | login_fail_email | signup_ip | otp_send_ip | otp_verify_ip';
comment on column public.auth_attempts.key is
  'IP résolue (x-forwarded-for + TRUSTED_PROXY_COUNT) ou e-mail normalisé en minuscules.';

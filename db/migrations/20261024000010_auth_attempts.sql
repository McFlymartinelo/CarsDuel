-- =============================================================================
-- 010 : tentatives d'authentification (rate limiting, appliqué par l'app)
-- Accès réservé au propriétaire de la base : pas de grant à app_user.
-- kind : login_ip | login_fail_email | signup_ip
-- key  : IP (x-forwarded-for, sinon "unknown") ou e-mail normalisé.
-- =============================================================================

create table public.auth_attempts (
  id         bigint generated always as identity primary key,
  kind       text not null,
  key        text not null,
  created_at timestamptz not null default now()
);

create index idx_auth_attempts_kind_key_created
  on public.auth_attempts (kind, key, created_at);

alter table public.auth_attempts enable row level security;
revoke all on table public.auth_attempts from public, app_user;

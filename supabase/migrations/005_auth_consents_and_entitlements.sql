-- Versioned consent records and server-authoritative account capabilities.
alter table public.profiles
  add column if not exists account_tier text not null default 'free'
    check (account_tier in ('free', 'pro')),
  add column if not exists app_role text not null default 'user'
    check (app_role in ('user', 'admin'));

create table if not exists public.user_consents (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  terms_accepted_at timestamptz not null,
  privacy_accepted_at timestamptz not null,
  age_declaration_at timestamptz not null,
  terms_version text not null,
  privacy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_consents enable row level security;

revoke update on public.profiles from authenticated;
grant update (username, email, display_name, avatar, status, last_seen_at) on public.profiles to authenticated;
grant select on public.user_consents to authenticated;
revoke all on public.user_consents from anon;

create policy "users view own consent records"
on public.user_consents for select
to authenticated
using ((select auth.uid()) = user_id);

-- Inserts are performed by the trusted registration route using service role.
-- Future guardian/age-verification records should live in separate restricted tables.

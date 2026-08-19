-- GrindLobby security hardening, distributed rate limits and age assurance foundation.
-- Safe for a database where migrations 001-005 have already been applied.
-- This migration intentionally stores age bands, never a full birth date or identity document.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.profiles
  add column if not exists account_level integer not null default 1 check (account_level between 1 and 999),
  add column if not exists account_xp bigint not null default 0 check (account_xp >= 0);

alter table public.user_consents
  alter column age_declaration_at drop not null;

create table if not exists public.age_assurance (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  age_band text check (age_band is null or age_band in ('under_13', '13_15', '16_17', '18_plus')),
  age_assurance_status text not null default 'not_started'
    check (age_assurance_status in ('not_started', 'pending', 'verified', 'guardian_required', 'guardian_pending', 'rejected', 'expired')),
  age_verified_at timestamptz,
  age_verification_method text check (age_verification_method is null or char_length(age_verification_method) between 2 and 64),
  age_verification_expires_at timestamptz,
  guardian_link_status text not null default 'not_required'
    check (guardian_link_status in ('not_required', 'required', 'pending', 'verified', 'rejected', 'expired')),
  guardian_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (age_assurance_status <> 'verified' or (age_band is not null and age_verified_at is not null)),
  check (guardian_link_status <> 'verified' or guardian_verified_at is not null)
);

create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  minor_user_id uuid not null references public.profiles(id) on delete cascade,
  guardian_user_id uuid references public.profiles(id) on delete set null,
  invite_token_hash text not null unique check (char_length(invite_token_hash) = 64),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (guardian_user_id is null or guardian_user_id <> minor_user_id),
  check (status <> 'accepted' or (guardian_user_id is not null and verified_at is not null))
);

create unique index if not exists guardian_links_active_minor_uidx
  on public.guardian_links(minor_user_id)
  where status in ('pending', 'accepted');
create index if not exists guardian_links_guardian_idx on public.guardian_links(guardian_user_id);
create index if not exists guardian_links_expiry_idx on public.guardian_links(expires_at);
create index if not exists lobbies_game_idx on public.lobbies(game_id);
create index if not exists user_game_ranks_game_idx on public.user_game_ranks(game_id);
create index if not exists voice_signals_sender_idx on public.voice_signals(sender_id);
create index if not exists voice_signals_target_idx on public.voice_signals(target_id) where target_id is not null;

alter table public.age_assurance enable row level security;
alter table public.guardian_links enable row level security;

drop policy if exists "users view own age assurance" on public.age_assurance;
create policy "users view own age assurance"
on public.age_assurance for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "linked users view guardian relationships" on public.guardian_links;
create policy "linked users view guardian relationships"
on public.guardian_links for select
to authenticated
using ((select auth.uid()) = minor_user_id or (select auth.uid()) = guardian_user_id);

-- Existing SELECT policies from migrations 001 and 005 are intentionally preserved:
-- "open lobbies readable by authenticated users", "members can view memberships"
-- and "users view own consent records".
-- All lobby writes go through authenticated, rate-limited server routes.
drop policy if exists "users create own lobbies" on public.lobbies;
drop policy if exists "owners update lobbies" on public.lobbies;
drop policy if exists "owners delete lobbies" on public.lobbies;
drop policy if exists "users join lobbies as themselves" on public.lobby_members;
drop policy if exists "users leave lobby" on public.lobby_members;

-- Rank mutations must come from trusted game/result processing, never from the player client.
drop policy if exists "users manage own ranks" on public.user_game_ranks;
drop policy if exists "users update own ranks" on public.user_game_ranks;

-- The manual WebRTC signaling table is legacy and inaccessible to browser roles.
drop policy if exists "active lobby members read voice signals" on public.voice_signals;
drop policy if exists "active lobby members create voice signals" on public.voice_signals;
drop policy if exists "signal senders delete own voice signals" on public.voice_signals;

-- Replace permissive default grants with the minimum required Data API surface.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar) on public.profiles to authenticated;

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;

revoke all on public.games from anon, authenticated;
grant select on public.games to anon, authenticated;

revoke all on public.user_game_ranks from anon, authenticated;
grant select on public.user_game_ranks to authenticated;

revoke all on public.lobbies from anon, authenticated;
grant select on public.lobbies to authenticated;

revoke all on public.lobby_members from anon, authenticated;
grant select on public.lobby_members to authenticated;

revoke all on public.voice_signals from anon, authenticated;

revoke all on public.user_consents from anon, authenticated;
grant select on public.user_consents to authenticated;

revoke all on public.age_assurance from anon, authenticated;
grant select on public.age_assurance to authenticated;

revoke all on public.guardian_links from anon, authenticated;
grant select on public.guardian_links to authenticated;

-- Explicit trusted-server grants avoid depending on Supabase default privileges.
grant select, insert, update on public.age_assurance to service_role;
grant select, insert, update, delete on public.guardian_links to service_role;

-- Existing and future accounts receive a non-verified assurance row.
insert into public.age_assurance(user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, email, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username', 'Player')
  );
  insert into public.age_assurance(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Distributed fixed-window limiter. Only the service role may call its RPC.
create table if not exists private.rate_limits (
  rate_key text primary key check (char_length(rate_key) between 16 and 160),
  request_count integer not null check (request_count > 0),
  window_started_at timestamptz not null,
  expires_at timestamptz not null
);
create index if not exists rate_limits_expiry_idx on private.rate_limits(expires_at);
alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public, anon, authenticated;

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_record private.rate_limits%rowtype;
  current_time timestamptz := clock_timestamp();
begin
  if char_length(p_key) < 16 or char_length(p_key) > 160
    or p_limit < 1 or p_limit > 10000
    or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into private.rate_limits(rate_key, request_count, window_started_at, expires_at)
  values (p_key, 1, current_time, current_time + make_interval(secs => p_window_seconds))
  on conflict (rate_key) do update
  set request_count = case
        when private.rate_limits.expires_at <= current_time then 1
        else private.rate_limits.request_count + 1
      end,
      window_started_at = case
        when private.rate_limits.expires_at <= current_time then current_time
        else private.rate_limits.window_started_at
      end,
      expires_at = case
        when private.rate_limits.expires_at <= current_time then current_time + make_interval(secs => p_window_seconds)
        else private.rate_limits.expires_at
      end
  returning * into current_record;

  delete from private.rate_limits
  where rate_key in (
    select rate_key from private.rate_limits
    where expires_at < current_time - interval '1 day'
    limit 100
  );

  return query select
    current_record.request_count <= p_limit,
    greatest(0, p_limit - current_record.request_count),
    current_record.expires_at;
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- Serializes capacity checks so two joins cannot overfill the same lobby.
create or replace function public.join_lobby_member(p_lobby_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  lobby_record public.lobbies%rowtype;
  active_count integer;
begin
  select * into lobby_record
  from public.lobbies
  where id = p_lobby_id
  for update;

  if lobby_record.id is null or lobby_record.status <> 'open' then
    return 'unavailable';
  end if;

  if exists (
    select 1 from public.lobby_members
    where lobby_id = p_lobby_id
      and user_id = p_user_id
      and last_seen_at > now() - interval '30 seconds'
  ) then
    update public.lobby_members set last_seen_at = now()
    where lobby_id = p_lobby_id and user_id = p_user_id;
    return 'joined';
  end if;

  select count(*) into active_count
  from public.lobby_members
  where lobby_id = p_lobby_id
    and last_seen_at > now() - interval '30 seconds';

  if active_count >= lobby_record.max_members then
    return 'full';
  end if;

  insert into public.lobby_members(lobby_id, user_id, role, last_seen_at)
  values (p_lobby_id, p_user_id, 'member', now())
  on conflict (lobby_id, user_id) do update
  set last_seen_at = excluded.last_seen_at;

  return 'joined';
end;
$$;

revoke execute on function public.join_lobby_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_lobby_member(uuid, uuid) to service_role;

comment on table public.age_assurance is 'Minimal age-band and assurance state. Never store full birth dates or verification documents here.';
comment on table public.guardian_links is 'Hashed, expiring relationship workflow between a minor account and a guardian account.';
comment on function public.consume_rate_limit(text, integer, integer) is 'Atomic distributed rate limit for trusted server routes only.';
comment on function public.join_lobby_member(uuid, uuid) is 'Server-only serialized lobby join preserving role and max capacity.';

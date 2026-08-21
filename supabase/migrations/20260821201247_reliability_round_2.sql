create table if not exists public.lobby_invites (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  max_uses integer not null default 25 check (max_uses between 1 and 100),
  uses integer not null default 0 check (uses >= 0),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists lobby_invites_lobby_idx on public.lobby_invites(lobby_id,created_at desc);
alter table public.lobby_invites enable row level security;
revoke all on table public.lobby_invites from public, anon, authenticated;
grant all on table public.lobby_invites to service_role;

create or replace function public.redeem_lobby_invite(p_token_hash text,p_user_id uuid)
returns table(result text,lobby_id uuid)
language plpgsql security definer set search_path=''
as $$
declare v_invite public.lobby_invites%rowtype; v_join text;
begin
  select * into v_invite from public.lobby_invites where token_hash=p_token_hash for update;
  if v_invite.id is null or v_invite.revoked or v_invite.expires_at <= now() then return query select 'invalid'::text,null::uuid; return; end if;
  if exists(select 1 from public.lobby_members where lobby_members.lobby_id=v_invite.lobby_id and user_id=p_user_id) then
    v_join := public.join_lobby_member(v_invite.lobby_id,p_user_id);
    return query select v_join,v_invite.lobby_id; return;
  end if;
  if v_invite.uses >= v_invite.max_uses then return query select 'exhausted'::text,v_invite.lobby_id; return; end if;
  v_join := public.join_lobby_member(v_invite.lobby_id,p_user_id);
  if v_join='joined' then update public.lobby_invites set uses=uses+1 where id=v_invite.id; end if;
  return query select v_join,v_invite.lobby_id;
end;$$;
revoke execute on function public.redeem_lobby_invite(text,uuid) from public,anon,authenticated;
grant execute on function public.redeem_lobby_invite(text,uuid) to service_role;

create or replace function public.join_community_event_atomic(p_event_id uuid,p_community_id uuid,p_user_id uuid)
returns text language plpgsql security definer set search_path=''
as $$
declare v_event public.community_events%rowtype; v_count integer;
begin
  select * into v_event from public.community_events where id=p_event_id and community_id=p_community_id for update;
  if v_event.id is null or v_event.status <> 'scheduled' then return 'unavailable'; end if;
  if not exists(select 1 from public.community_members where community_id=p_community_id and user_id=p_user_id) then return 'forbidden'; end if;
  if exists(select 1 from public.community_event_members where event_id=p_event_id and user_id=p_user_id) then return 'joined'; end if;
  if v_event.capacity is not null then
    select count(*) into v_count from public.community_event_members where event_id=p_event_id;
    if v_count >= v_event.capacity then return 'full'; end if;
  end if;
  insert into public.community_event_members(event_id,user_id) values(p_event_id,p_user_id);
  return 'joined';
end;$$;
revoke execute on function public.join_community_event_atomic(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.join_community_event_atomic(uuid,uuid,uuid) to service_role;

create table if not exists public.voice_quality_samples (
  id bigint generated always as identity primary key,
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_state text not null check (connection_state in ('connected','reconnecting','disconnected')),
  rtt_ms integer check (rtt_ms is null or rtt_ms between 0 and 60000),
  jitter_ms numeric(10,3) check (jitter_ms is null or jitter_ms between 0 and 60000),
  packets_lost integer check (packets_lost is null or packets_lost >= 0),
  packets_received integer check (packets_received is null or packets_received >= 0),
  bitrate_kbps integer check (bitrate_kbps is null or bitrate_kbps >= 0),
  participant_count integer not null default 1 check (participant_count between 0 and 200),
  created_at timestamptz not null default now()
);
create index if not exists voice_quality_samples_lobby_time_idx on public.voice_quality_samples(lobby_id,created_at desc);
create index if not exists voice_quality_samples_user_time_idx on public.voice_quality_samples(user_id,created_at desc);
alter table public.voice_quality_samples enable row level security;
revoke all on table public.voice_quality_samples from public,anon,authenticated;
grant all on table public.voice_quality_samples to service_role;

do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('grindlobby-voice-metrics-retention','17 4 * * *',$job$delete from public.voice_quality_samples where created_at < now()-interval '14 days'$job$);
  end if;
exception when others then null;
end $$;

notify pgrst,'reload schema';
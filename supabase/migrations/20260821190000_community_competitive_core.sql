-- GrindLobby Community + Valorant Competitive + Automatic Team Rooms/Grind Board
-- Incremental schema: reuses profiles, lobbies, lobby_members, games and existing auth.
create extension if not exists pgcrypto;

-- -----------------------------
-- COMMUNITY
-- -----------------------------
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 500),
  logo_url text,
  banner_url text,
  privacy text not null default 'private' check (privacy in ('private','invite_only')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists communities_owner_idx on public.communities(owner_id);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','moderator','member')),
  joined_at timestamptz not null default now(),
  primary key (community_id,user_id)
);
create index if not exists community_members_user_idx on public.community_members(user_id);

create table if not exists public.community_environments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 50),
  description text not null default '' check (char_length(description) <= 180),
  type text not null default 'social' check (type in ('voice','game','strategy','clips','training','social','custom')),
  capacity integer not null default 10 check (capacity between 2 and 100),
  lobby_id uuid references public.lobbies(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_environments_community_idx on public.community_environments(community_id,sort_order);

create table if not exists public.community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists community_invites_community_idx on public.community_invites(community_id);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'activity' check (type in ('announcement','highlight','event','activity','role')),
  title text not null check (char_length(title) between 1 and 100),
  body text not null default '' check (char_length(body) <= 2000),
  media_url text,
  created_at timestamptz not null default now()
);
create index if not exists community_posts_community_idx on public.community_posts(community_id,created_at desc);

create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  environment_id uuid references public.community_environments(id) on delete set null,
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  type text not null default 'training' check (type in ('training','scrim','tournament','social','custom')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer check (capacity is null or capacity between 1 and 500),
  status text not null default 'scheduled' check (status in ('scheduled','live','finished','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists community_events_community_idx on public.community_events(community_id,starts_at);

create table if not exists public.community_event_members (
  event_id uuid not null references public.community_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (event_id,user_id)
);

-- -----------------------------
-- VALORANT COMPETITIVE
-- -----------------------------
create table if not exists public.valorant_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'active' check (status in ('planned','active','finished')),
  created_at timestamptz not null default now()
);
insert into public.valorant_seasons(name,starts_at,status)
select 'Valorant Season 1', date_trunc('day',now()), 'active'
where not exists (select 1 from public.valorant_seasons where status='active');

create table if not exists public.valorant_player_ratings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.valorant_seasons(id) on delete cascade,
  rating integer not null default 1000,
  peak_rating integer not null default 1000,
  placements_played integer not null default 0 check (placements_played between 0 and 5),
  wins integer not null default 0,
  losses integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id,season_id)
);

create table if not exists public.valorant_squads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  captain_id uuid not null references public.profiles(id) on delete cascade,
  region text not null default 'BR-SAO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists valorant_squads_captain_idx on public.valorant_squads(captain_id);

create table if not exists public.valorant_squad_members (
  squad_id uuid not null references public.valorant_squads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (squad_id,user_id)
);
create unique index if not exists valorant_one_squad_per_user_idx on public.valorant_squad_members(user_id);

create table if not exists public.valorant_squad_ratings (
  squad_id uuid not null references public.valorant_squads(id) on delete cascade,
  season_id uuid not null references public.valorant_seasons(id) on delete cascade,
  rating integer not null default 1000,
  peak_rating integer not null default 1000,
  placements_played integer not null default 0 check (placements_played between 0 and 5),
  wins integer not null default 0,
  losses integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (squad_id,season_id)
);

create table if not exists public.valorant_queue_entries (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null unique references public.valorant_squads(id) on delete cascade,
  captain_id uuid not null references public.profiles(id) on delete cascade,
  region text not null,
  average_gr integer not null,
  status text not null default 'searching' check (status in ('searching','matched','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists valorant_queue_search_idx on public.valorant_queue_entries(status,region,created_at);

create table if not exists public.valorant_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('GL-VAL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  season_id uuid not null references public.valorant_seasons(id) on delete restrict,
  squad_a_id uuid not null references public.valorant_squads(id) on delete restrict,
  squad_b_id uuid not null references public.valorant_squads(id) on delete restrict,
  state text not null default 'MATCH_FOUND' check (state in ('MATCH_FOUND','ACCEPTING','VETO','MAP_SELECTED','LOBBY_READY','PLAYING','RESULT_PENDING','DISPUTED','FINISHED','CANCELLED')),
  region text not null,
  average_gr_a integer not null default 1000,
  average_gr_b integer not null default 1000,
  selected_map_slug text,
  accept_deadline timestamptz,
  veto_deadline timestamptz,
  winner_squad_id uuid references public.valorant_squads(id) on delete set null,
  score_a integer,
  score_b integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  check (squad_a_id <> squad_b_id)
);
create index if not exists valorant_matches_state_idx on public.valorant_matches(state,created_at desc);

create table if not exists public.valorant_match_players (
  match_id uuid not null references public.valorant_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  squad_id uuid not null references public.valorant_squads(id) on delete restrict,
  accepted boolean,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (match_id,user_id)
);
create index if not exists valorant_match_players_user_idx on public.valorant_match_players(user_id,match_id);

create table if not exists public.valorant_map_pool (
  slug text primary key,
  name text not null,
  thumbnail_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.valorant_map_pool(slug,name,sort_order) values
 ('ascent','Ascent',10),('bind','Bind',20),('haven','Haven',30),('split','Split',40),('lotus','Lotus',50),('icebox','Icebox',60),('sunset','Sunset',70)
on conflict(slug) do nothing;

create table if not exists public.valorant_veto_actions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.valorant_matches(id) on delete cascade,
  step integer not null,
  squad_id uuid not null references public.valorant_squads(id) on delete restrict,
  captain_id uuid not null references public.profiles(id) on delete restrict,
  map_slug text not null references public.valorant_map_pool(slug) on delete restrict,
  action text not null default 'ban' check (action in ('ban','select')),
  created_at timestamptz not null default now(),
  unique(match_id,step),
  unique(match_id,map_slug)
);

create table if not exists public.valorant_result_submissions (
  match_id uuid not null references public.valorant_matches(id) on delete cascade,
  captain_id uuid not null references public.profiles(id) on delete restrict,
  squad_id uuid not null references public.valorant_squads(id) on delete restrict,
  score_a integer not null check (score_a between 0 and 99),
  score_b integer not null check (score_b between 0 and 99),
  submitted_at timestamptz not null default now(),
  primary key(match_id,captain_id)
);

create table if not exists public.valorant_rating_history (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.valorant_matches(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  squad_id uuid references public.valorant_squads(id) on delete cascade,
  rating_type text not null check (rating_type in ('GR','SR')),
  before_rating integer not null,
  after_rating integer not null,
  delta integer not null,
  created_at timestamptz not null default now(),
  check ((user_id is not null) <> (squad_id is not null))
);
create unique index if not exists valorant_rating_history_unique_player on public.valorant_rating_history(match_id,user_id,rating_type) where user_id is not null;
create unique index if not exists valorant_rating_history_unique_squad on public.valorant_rating_history(match_id,squad_id,rating_type) where squad_id is not null;

-- -----------------------------
-- AUTOMATIC TEAM ROOMS + GRIND BOARD
-- -----------------------------
create table if not exists public.match_team_rooms (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.valorant_matches(id) on delete cascade,
  squad_id uuid not null references public.valorant_squads(id) on delete cascade,
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  expires_at timestamptz,
  status text not null default 'PRE_MATCH' check (status in ('PRE_MATCH','PLAYING','POST_MATCH','CLOSED')),
  created_at timestamptz not null default now(),
  unique(match_id,squad_id)
);

create table if not exists public.strategy_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.valorant_matches(id) on delete cascade,
  squad_id uuid not null references public.valorant_squads(id) on delete cascade,
  map_slug text not null,
  edit_mode text not null default 'captain' check (edit_mode in ('captain','everyone')),
  igl_user_id uuid references public.profiles(id) on delete set null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(match_id,squad_id)
);

create table if not exists public.strategy_objects (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.strategy_sessions(id) on delete cascade,
  type text not null check (type in ('draw','arrow','circle','marker','text','player')),
  data jsonb not null default '{}'::jsonb,
  author_id uuid not null references public.profiles(id) on delete cascade,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists strategy_objects_session_idx on public.strategy_objects(session_id,updated_at);

-- -----------------------------
-- Helper views/functions
-- -----------------------------
create or replace function public.is_community_member(p_community uuid,p_user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.community_members where community_id=p_community and user_id=p_user)
$$;

create or replace function public.community_role(p_community uuid,p_user uuid)
returns text language sql stable security definer set search_path=public as $$
  select role from public.community_members where community_id=p_community and user_id=p_user
$$;

create or replace function public.is_match_member(p_match uuid,p_user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.valorant_match_players where match_id=p_match and user_id=p_user)
$$;

create or replace function public.is_valorant_squad_member(p_squad uuid,p_user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.valorant_squad_members where squad_id=p_squad and user_id=p_user)
$$;

-- Atomic queue + matching. Service route still performs eligibility checks before calling.
create or replace function public.valorant_enqueue_and_match(
  p_squad_id uuid,
  p_captain_id uuid,
  p_region text,
  p_average_gr integer
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_opponent public.valorant_queue_entries%rowtype;
  v_match_id uuid;
  v_season uuid;
  v_wait_seconds integer;
  v_window integer;
begin
  if not exists(select 1 from public.valorant_squads where id=p_squad_id and captain_id=p_captain_id) then
    raise exception 'not_captain';
  end if;
  if (select count(*) from public.valorant_squad_members where squad_id=p_squad_id) <> 5 then
    raise exception 'squad_incomplete';
  end if;

  select id into v_season from public.valorant_seasons where status='active' order by starts_at desc limit 1;
  if v_season is null then raise exception 'no_active_season'; end if;

  insert into public.valorant_queue_entries(squad_id,captain_id,region,average_gr,status)
  values(p_squad_id,p_captain_id,p_region,p_average_gr,'searching')
  on conflict(squad_id) do update set captain_id=excluded.captain_id,region=excluded.region,average_gr=excluded.average_gr,status='searching',created_at=now();

  select q.* into v_opponent
  from public.valorant_queue_entries q
  where q.status='searching' and q.squad_id<>p_squad_id and q.region=p_region
  and not exists(
    select 1 from public.valorant_squad_members mine
    join public.valorant_squad_members theirs on mine.user_id=theirs.user_id
    where mine.squad_id=p_squad_id and theirs.squad_id=q.squad_id
  )
  order by q.created_at asc
  for update skip locked
  limit 1;

  if v_opponent.id is null then return null; end if;
  v_wait_seconds := greatest(0,extract(epoch from (now()-v_opponent.created_at))::integer);
  v_window := case when v_wait_seconds < 30 then 75 when v_wait_seconds < 60 then 125 when v_wait_seconds < 90 then 175 else 300 end;
  if abs(v_opponent.average_gr-p_average_gr) > v_window then return null; end if;

  insert into public.valorant_matches(season_id,squad_a_id,squad_b_id,state,region,average_gr_a,average_gr_b,accept_deadline)
  values(v_season,v_opponent.squad_id,p_squad_id,'ACCEPTING',p_region,v_opponent.average_gr,p_average_gr,now()+interval '20 seconds')
  returning id into v_match_id;

  insert into public.valorant_match_players(match_id,user_id,squad_id)
  select v_match_id,user_id,v_opponent.squad_id from public.valorant_squad_members where squad_id=v_opponent.squad_id
  union all
  select v_match_id,user_id,p_squad_id from public.valorant_squad_members where squad_id=p_squad_id;

  update public.valorant_queue_entries set status='matched' where squad_id in (v_opponent.squad_id,p_squad_id);
  delete from public.valorant_queue_entries where squad_id in (v_opponent.squad_id,p_squad_id);
  return v_match_id;
end;
$$;

-- RLS: data is private by membership. Server-side service routes do additional authorization.
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_environments enable row level security;
alter table public.community_invites enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_events enable row level security;
alter table public.community_event_members enable row level security;
alter table public.valorant_seasons enable row level security;
alter table public.valorant_player_ratings enable row level security;
alter table public.valorant_squads enable row level security;
alter table public.valorant_squad_members enable row level security;
alter table public.valorant_squad_ratings enable row level security;
alter table public.valorant_queue_entries enable row level security;
alter table public.valorant_matches enable row level security;
alter table public.valorant_match_players enable row level security;
alter table public.valorant_map_pool enable row level security;
alter table public.valorant_veto_actions enable row level security;
alter table public.valorant_result_submissions enable row level security;
alter table public.valorant_rating_history enable row level security;
alter table public.match_team_rooms enable row level security;
alter table public.strategy_sessions enable row level security;
alter table public.strategy_objects enable row level security;

-- Community policies
DROP POLICY IF EXISTS "community members read community" ON public.communities;
CREATE POLICY "community members read community" ON public.communities FOR SELECT TO authenticated
USING (public.is_community_member(id,(select auth.uid())));
DROP POLICY IF EXISTS "owners create community" ON public.communities;
CREATE POLICY "owners create community" ON public.communities FOR INSERT TO authenticated WITH CHECK (owner_id=(select auth.uid()));
DROP POLICY IF EXISTS "community managers update" ON public.communities;
CREATE POLICY "community managers update" ON public.communities FOR UPDATE TO authenticated
USING (public.community_role(id,(select auth.uid())) in ('owner','admin'))
WITH CHECK (public.community_role(id,(select auth.uid())) in ('owner','admin'));
DROP POLICY IF EXISTS "members read memberships" ON public.community_members;
CREATE POLICY "members read memberships" ON public.community_members FOR SELECT TO authenticated
USING (public.is_community_member(community_id,(select auth.uid())));
DROP POLICY IF EXISTS "members read environments" ON public.community_environments;
CREATE POLICY "members read environments" ON public.community_environments FOR SELECT TO authenticated
USING (public.is_community_member(community_id,(select auth.uid())));
DROP POLICY IF EXISTS "members read posts" ON public.community_posts;
CREATE POLICY "members read posts" ON public.community_posts FOR SELECT TO authenticated
USING (public.is_community_member(community_id,(select auth.uid())));
DROP POLICY IF EXISTS "members read events" ON public.community_events;
CREATE POLICY "members read events" ON public.community_events FOR SELECT TO authenticated
USING (public.is_community_member(community_id,(select auth.uid())));

-- Competitive read policies
DROP POLICY IF EXISTS "season readable" ON public.valorant_seasons;
CREATE POLICY "season readable" ON public.valorant_seasons FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "map pool readable" ON public.valorant_map_pool;
CREATE POLICY "map pool readable" ON public.valorant_map_pool FOR SELECT TO authenticated USING (active=true);
DROP POLICY IF EXISTS "own rating readable" ON public.valorant_player_ratings;
CREATE POLICY "own rating readable" ON public.valorant_player_ratings FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
DROP POLICY IF EXISTS "squad members read squad" ON public.valorant_squads;
CREATE POLICY "squad members read squad" ON public.valorant_squads FOR SELECT TO authenticated USING (public.is_valorant_squad_member(id,(select auth.uid())));
DROP POLICY IF EXISTS "squad members read members" ON public.valorant_squad_members;
CREATE POLICY "squad members read members" ON public.valorant_squad_members FOR SELECT TO authenticated USING (public.is_valorant_squad_member(squad_id,(select auth.uid())));
DROP POLICY IF EXISTS "match members read matches" ON public.valorant_matches;
CREATE POLICY "match members read matches" ON public.valorant_matches FOR SELECT TO authenticated USING (public.is_match_member(id,(select auth.uid())));
DROP POLICY IF EXISTS "match members read players" ON public.valorant_match_players;
CREATE POLICY "match members read players" ON public.valorant_match_players FOR SELECT TO authenticated USING (public.is_match_member(match_id,(select auth.uid())));
DROP POLICY IF EXISTS "match members read veto" ON public.valorant_veto_actions;
CREATE POLICY "match members read veto" ON public.valorant_veto_actions FOR SELECT TO authenticated USING (public.is_match_member(match_id,(select auth.uid())));
DROP POLICY IF EXISTS "match members read team room" ON public.match_team_rooms;
CREATE POLICY "match members read team room" ON public.match_team_rooms FOR SELECT TO authenticated USING (exists(select 1 from public.valorant_match_players mp where mp.match_id=match_team_rooms.match_id and mp.squad_id=match_team_rooms.squad_id and mp.user_id=(select auth.uid())));
DROP POLICY IF EXISTS "match members read strategy session" ON public.strategy_sessions;
CREATE POLICY "match members read strategy session" ON public.strategy_sessions FOR SELECT TO authenticated USING (exists(select 1 from public.valorant_match_players mp where mp.match_id=strategy_sessions.match_id and mp.squad_id=strategy_sessions.squad_id and mp.user_id=(select auth.uid())));
DROP POLICY IF EXISTS "team reads strategy objects" ON public.strategy_objects;
CREATE POLICY "team reads strategy objects" ON public.strategy_objects FOR SELECT TO authenticated USING (exists(select 1 from public.strategy_sessions s join public.valorant_match_players mp on mp.match_id=s.match_id and mp.squad_id=s.squad_id where s.id=strategy_objects.session_id and mp.user_id=(select auth.uid())));

-- Realtime publication where useful.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_posts') then alter publication supabase_realtime add table public.community_posts; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_events') then alter publication supabase_realtime add table public.community_events; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='valorant_matches') then alter publication supabase_realtime add table public.valorant_matches; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='valorant_match_players') then alter publication supabase_realtime add table public.valorant_match_players; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='valorant_veto_actions') then alter publication supabase_realtime add table public.valorant_veto_actions; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='strategy_objects') then alter publication supabase_realtime add table public.strategy_objects; end if;
end $$;

notify pgrst, 'reload schema';

create or replace function public.finalize_valorant_match(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  m public.valorant_matches%rowtype;
  s1 public.valorant_result_submissions%rowtype;
  s2 public.valorant_result_submissions%rowtype;
  winner uuid;
  p record;
  r public.valorant_player_ratings%rowtype;
  opp_avg integer;
  expected numeric;
  k integer;
  delta integer;
  result_value integer;
  sr_a public.valorant_squad_ratings%rowtype;
  sr_b public.valorant_squad_ratings%rowtype;
  sr_delta_a integer;
  sr_delta_b integer;
begin
  select * into m from public.valorant_matches where id=p_match_id for update;
  if m.id is null then raise exception 'match_not_found'; end if;
  if m.state='FINISHED' then return true; end if;

  select * into s1 from public.valorant_result_submissions where match_id=p_match_id order by submitted_at asc limit 1;
  select * into s2 from public.valorant_result_submissions where match_id=p_match_id order by submitted_at asc offset 1 limit 1;
  if s1.captain_id is null or s2.captain_id is null then return false; end if;
  if s1.score_a<>s2.score_a or s1.score_b<>s2.score_b then
    update public.valorant_matches set state='DISPUTED',updated_at=now() where id=p_match_id;
    return false;
  end if;
  if s1.score_a=s1.score_b then raise exception 'draw_not_allowed'; end if;
  winner := case when s1.score_a>s1.score_b then m.squad_a_id else m.squad_b_id end;

  for p in select * from public.valorant_match_players where match_id=p_match_id loop
    insert into public.valorant_player_ratings(user_id,season_id) values(p.user_id,m.season_id)
    on conflict(user_id,season_id) do nothing;
    select * into r from public.valorant_player_ratings where user_id=p.user_id and season_id=m.season_id for update;
    result_value := case when p.squad_id=winner then 1 else 0 end;
    opp_avg := case when p.squad_id=m.squad_a_id then m.average_gr_b else m.average_gr_a end;
    expected := 1.0/(1.0+power(10.0,(opp_avg-r.rating)/400.0));
    k := case when r.placements_played<5 then 48 else 24 end;
    delta := round(k*(result_value-expected));
    insert into public.valorant_rating_history(match_id,user_id,rating_type,before_rating,after_rating,delta)
    values(p_match_id,p.user_id,'GR',r.rating,greatest(0,r.rating+delta),delta)
    on conflict do nothing;
    update public.valorant_player_ratings set
      rating=greatest(0,r.rating+delta),
      peak_rating=greatest(r.peak_rating,greatest(0,r.rating+delta)),
      placements_played=least(5,r.placements_played+1),
      wins=r.wins+case when result_value=1 then 1 else 0 end,
      losses=r.losses+case when result_value=0 then 1 else 0 end,
      updated_at=now()
    where user_id=p.user_id and season_id=m.season_id;
  end loop;

  insert into public.valorant_squad_ratings(squad_id,season_id) values(m.squad_a_id,m.season_id) on conflict(squad_id,season_id) do nothing;
  insert into public.valorant_squad_ratings(squad_id,season_id) values(m.squad_b_id,m.season_id) on conflict(squad_id,season_id) do nothing;
  select * into sr_a from public.valorant_squad_ratings where squad_id=m.squad_a_id and season_id=m.season_id for update;
  select * into sr_b from public.valorant_squad_ratings where squad_id=m.squad_b_id and season_id=m.season_id for update;
  expected := 1.0/(1.0+power(10.0,(sr_b.rating-sr_a.rating)/400.0));
  k := case when sr_a.placements_played<5 then 40 else 20 end;
  sr_delta_a := round(k*((case when winner=m.squad_a_id then 1 else 0 end)-expected));
  expected := 1.0/(1.0+power(10.0,(sr_a.rating-sr_b.rating)/400.0));
  k := case when sr_b.placements_played<5 then 40 else 20 end;
  sr_delta_b := round(k*((case when winner=m.squad_b_id then 1 else 0 end)-expected));

  insert into public.valorant_rating_history(match_id,squad_id,rating_type,before_rating,after_rating,delta)
  values(p_match_id,m.squad_a_id,'SR',sr_a.rating,greatest(0,sr_a.rating+sr_delta_a),sr_delta_a) on conflict do nothing;
  insert into public.valorant_rating_history(match_id,squad_id,rating_type,before_rating,after_rating,delta)
  values(p_match_id,m.squad_b_id,'SR',sr_b.rating,greatest(0,sr_b.rating+sr_delta_b),sr_delta_b) on conflict do nothing;

  update public.valorant_squad_ratings set rating=greatest(0,sr_a.rating+sr_delta_a),peak_rating=greatest(sr_a.peak_rating,greatest(0,sr_a.rating+sr_delta_a)),placements_played=least(5,sr_a.placements_played+1),wins=sr_a.wins+case when winner=m.squad_a_id then 1 else 0 end,losses=sr_a.losses+case when winner=m.squad_a_id then 0 else 1 end,updated_at=now() where squad_id=m.squad_a_id and season_id=m.season_id;
  update public.valorant_squad_ratings set rating=greatest(0,sr_b.rating+sr_delta_b),peak_rating=greatest(sr_b.peak_rating,greatest(0,sr_b.rating+sr_delta_b)),placements_played=least(5,sr_b.placements_played+1),wins=sr_b.wins+case when winner=m.squad_b_id then 1 else 0 end,losses=sr_b.losses+case when winner=m.squad_b_id then 0 else 1 end,updated_at=now() where squad_id=m.squad_b_id and season_id=m.season_id;

  update public.valorant_matches set state='FINISHED',winner_squad_id=winner,score_a=s1.score_a,score_b=s1.score_b,finished_at=now(),updated_at=now() where id=p_match_id;
  update public.match_team_rooms set status='POST_MATCH',expires_at=now()+interval '10 minutes' where match_id=p_match_id;
  return true;
end;
$$;

notify pgrst, 'reload schema';

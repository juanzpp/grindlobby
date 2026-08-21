-- Harden Community + Valorant helper/RPC functions after core schema rollout.
create schema if not exists private;

create or replace function private.is_community_member(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path=public,private
as $$
  select exists(
    select 1 from public.community_members
    where community_id = p_community and user_id = auth.uid()
  )
$$;

create or replace function private.community_role(p_community uuid)
returns text
language sql
stable
security definer
set search_path=public,private
as $$
  select role from public.community_members
  where community_id = p_community and user_id = auth.uid()
$$;

create or replace function private.is_match_member(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path=public,private
as $$
  select exists(
    select 1 from public.valorant_match_players
    where match_id = p_match and user_id = auth.uid()
  )
$$;

create or replace function private.is_valorant_squad_member(p_squad uuid)
returns boolean
language sql
stable
security definer
set search_path=public,private
as $$
  select exists(
    select 1 from public.valorant_squad_members
    where squad_id = p_squad and user_id = auth.uid()
  )
$$;

revoke all on function private.is_community_member(uuid) from public, anon;
revoke all on function private.community_role(uuid) from public, anon;
revoke all on function private.is_match_member(uuid) from public, anon;
revoke all on function private.is_valorant_squad_member(uuid) from public, anon;
grant execute on function private.is_community_member(uuid) to authenticated, service_role;
grant execute on function private.community_role(uuid) to authenticated, service_role;
grant execute on function private.is_match_member(uuid) to authenticated, service_role;
grant execute on function private.is_valorant_squad_member(uuid) to authenticated, service_role;

-- Rebind RLS policies to non-exposed helper functions.
drop policy if exists "community members read community" on public.communities;
create policy "community members read community" on public.communities for select to authenticated
using (private.is_community_member(id));

drop policy if exists "community managers update" on public.communities;
create policy "community managers update" on public.communities for update to authenticated
using (private.community_role(id) in ('owner','admin'))
with check (private.community_role(id) in ('owner','admin'));

drop policy if exists "members read memberships" on public.community_members;
create policy "members read memberships" on public.community_members for select to authenticated
using (private.is_community_member(community_id));

drop policy if exists "members read environments" on public.community_environments;
create policy "members read environments" on public.community_environments for select to authenticated
using (private.is_community_member(community_id));

drop policy if exists "members read posts" on public.community_posts;
create policy "members read posts" on public.community_posts for select to authenticated
using (private.is_community_member(community_id));

drop policy if exists "members read events" on public.community_events;
create policy "members read events" on public.community_events for select to authenticated
using (private.is_community_member(community_id));

drop policy if exists "squad members read squad" on public.valorant_squads;
create policy "squad members read squad" on public.valorant_squads for select to authenticated
using (private.is_valorant_squad_member(id));

drop policy if exists "squad members read members" on public.valorant_squad_members;
create policy "squad members read members" on public.valorant_squad_members for select to authenticated
using (private.is_valorant_squad_member(squad_id));

drop policy if exists "match members read matches" on public.valorant_matches;
create policy "match members read matches" on public.valorant_matches for select to authenticated
using (private.is_match_member(id));

drop policy if exists "match members read players" on public.valorant_match_players;
create policy "match members read players" on public.valorant_match_players for select to authenticated
using (private.is_match_member(match_id));

drop policy if exists "match members read veto" on public.valorant_veto_actions;
create policy "match members read veto" on public.valorant_veto_actions for select to authenticated
using (private.is_match_member(match_id));

-- These mutation RPCs are server-only. Never expose them to browser roles.
revoke execute on function public.valorant_enqueue_and_match(uuid,uuid,text,integer) from public, anon, authenticated;
revoke execute on function public.finalize_valorant_match(uuid) from public, anon, authenticated;
grant execute on function public.valorant_enqueue_and_match(uuid,uuid,text,integer) to service_role;
grant execute on function public.finalize_valorant_match(uuid) to service_role;

-- Old public helper functions are no longer needed by RLS and should not be callable through PostgREST.
revoke execute on function public.is_community_member(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.community_role(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.is_match_member(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.is_valorant_squad_member(uuid,uuid) from public, anon, authenticated;
grant execute on function public.is_community_member(uuid,uuid) to service_role;
grant execute on function public.community_role(uuid,uuid) to service_role;
grant execute on function public.is_match_member(uuid,uuid) to service_role;
grant execute on function public.is_valorant_squad_member(uuid,uuid) to service_role;

notify pgrst, 'reload schema';

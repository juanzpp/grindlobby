-- Keep a newly-created lobby alive long enough for its owner to register the
-- first heartbeat. The previous function closed brand-new rooms immediately.
create or replace function public.cleanup_stale_lobbies()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.lobby_members
  where last_seen_at < now() - interval '90 seconds';

  update public.lobbies as lobby
  set status = 'closed', updated_at = now()
  where lobby.status <> 'closed'
    and lobby.created_at < now() - interval '2 minutes'
    and not exists (
      select 1
      from public.lobby_members as member
      where member.lobby_id = lobby.id
    );
end;
$$;

revoke all on function public.cleanup_stale_lobbies() from public;
revoke all on function public.cleanup_stale_lobbies() from anon;
grant execute on function public.cleanup_stale_lobbies() to authenticated;
grant execute on function public.cleanup_stale_lobbies() to service_role;

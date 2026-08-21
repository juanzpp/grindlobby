alter table public.valorant_queue_entries add column if not exists last_seen_at timestamptz not null default now();
create index if not exists valorant_queue_presence_idx on public.valorant_queue_entries(status,last_seen_at);

create or replace function private.run_grind_maintenance()
returns void language plpgsql security definer set search_path=''
as $$
begin
  delete from public.lobby_invites where (expires_at is not null and expires_at < now()-interval '1 day') or (revoked=true and created_at < now()-interval '30 days');
  delete from public.community_invites where (expires_at is not null and expires_at < now()-interval '1 day') or (revoked=true and created_at < now()-interval '30 days');
  delete from public.valorant_queue_entries where status='searching' and last_seen_at < now()-interval '5 minutes';
  update public.valorant_matches set state='CANCELLED',updated_at=now()
    where state='ACCEPTING' and accept_deadline is not null and accept_deadline < now();
  update public.match_team_rooms set status='CLOSED'
    where status='POST_MATCH' and expires_at is not null and expires_at < now();
  update public.lobbies l set status='closed',updated_at=now()
    where l.status='open' and exists(
      select 1 from public.match_team_rooms r where r.lobby_id=l.id and r.status='CLOSED'
    );
end;$$;

update public.app_schema_state set version='20260821_queue_presence_hardening',updated_at=now() where id=1;
notify pgrst,'reload schema';

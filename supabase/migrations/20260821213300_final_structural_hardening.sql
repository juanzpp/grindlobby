create table if not exists public.app_schema_state (
  id smallint primary key default 1 check (id=1),
  version text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_schema_state enable row level security;
revoke all on public.app_schema_state from public,anon,authenticated;
grant select on public.app_schema_state to service_role;
insert into public.app_schema_state(id,version,updated_at) values(1,'20260821_final_structural_hardening',now())
on conflict(id) do update set version=excluded.version,updated_at=excluded.updated_at;

create or replace function private.run_grind_maintenance()
returns void language plpgsql security definer set search_path=''
as $$
begin
  delete from public.lobby_invites where (expires_at is not null and expires_at < now()-interval '1 day') or (revoked=true and created_at < now()-interval '30 days');
  delete from public.community_invites where (expires_at is not null and expires_at < now()-interval '1 day') or (revoked=true and created_at < now()-interval '30 days');
  delete from public.valorant_queue_entries where status='searching' and created_at < now()-interval '30 minutes';
  update public.valorant_matches set state='CANCELLED',updated_at=now()
    where state='ACCEPTING' and accept_deadline is not null and accept_deadline < now();
  update public.match_team_rooms set status='CLOSED'
    where status='POST_MATCH' and expires_at is not null and expires_at < now();
  update public.lobbies l set status='closed',updated_at=now()
    where l.status='open' and exists(
      select 1 from public.match_team_rooms r where r.lobby_id=l.id and r.status='CLOSED'
    );
end;$$;
revoke all on function private.run_grind_maintenance() from public,anon,authenticated;
grant execute on function private.run_grind_maintenance() to service_role;

select cron.schedule('grindlobby-structural-maintenance','*/5 * * * *','select private.run_grind_maintenance();')
where not exists(select 1 from cron.job where jobname='grindlobby-structural-maintenance');

notify pgrst,'reload schema';

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'grindlobby-close-abandoned-lobbies',
  '*/2 * * * *',
  $$
    update public.lobbies l
    set status='closed', updated_at=now()
    where l.status='open'
      and not exists (
        select 1 from public.match_team_rooms mr
        where mr.lobby_id=l.id and mr.status <> 'CLOSED'
      )
      and not exists (
        select 1 from public.lobby_members m
        where m.lobby_id=l.id
          and m.user_id=l.owner_id
          and m.last_seen_at > now()-interval '5 minutes'
      );
  $$
);

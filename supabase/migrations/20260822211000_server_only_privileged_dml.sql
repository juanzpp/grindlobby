-- Server-controlled modules must not accept direct Data API mutations.
-- Reads continue to be governed by RLS; writes flow through authenticated
-- Next.js API routes which validate intent and call service-role RPCs/queries.

revoke insert, update, delete on table public.communities from anon, authenticated;
revoke insert, update, delete on table public.community_members from anon, authenticated;
revoke insert, update, delete on table public.community_environments from anon, authenticated;
revoke insert, update, delete on table public.community_invites from anon, authenticated;
revoke insert, update, delete on table public.community_posts from anon, authenticated;
revoke insert, update, delete on table public.community_events from anon, authenticated;
revoke insert, update, delete on table public.community_event_members from anon, authenticated;

revoke insert, update, delete on table public.valorant_seasons from anon, authenticated;
revoke insert, update, delete on table public.valorant_player_ratings from anon, authenticated;
revoke insert, update, delete on table public.valorant_squads from anon, authenticated;
revoke insert, update, delete on table public.valorant_squad_members from anon, authenticated;
revoke insert, update, delete on table public.valorant_squad_ratings from anon, authenticated;
revoke insert, update, delete on table public.valorant_queue_entries from anon, authenticated;
revoke insert, update, delete on table public.valorant_matches from anon, authenticated;
revoke insert, update, delete on table public.valorant_match_players from anon, authenticated;
revoke insert, update, delete on table public.valorant_map_pool from anon, authenticated;
revoke insert, update, delete on table public.valorant_veto_actions from anon, authenticated;
revoke insert, update, delete on table public.valorant_result_submissions from anon, authenticated;
revoke insert, update, delete on table public.valorant_rating_history from anon, authenticated;
revoke insert, update, delete on table public.match_team_rooms from anon, authenticated;
revoke insert, update, delete on table public.strategy_sessions from anon, authenticated;
revoke insert, update, delete on table public.strategy_objects from anon, authenticated;

revoke insert, update, delete on table public.lobby_invites from anon, authenticated;
revoke insert, update, delete on table public.voice_quality_samples from anon, authenticated;

insert into public.app_schema_state(id,version,updated_at)
values(1,'20260822_server_only_privileged_dml',now())
on conflict(id) do update set version=excluded.version,updated_at=excluded.updated_at;

notify pgrst,'reload schema';

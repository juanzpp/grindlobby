-- Restrict internal/service-managed tables from browser roles.
revoke all on table public.community_event_members from anon, authenticated;
revoke all on table public.community_invites from anon, authenticated;
revoke all on table public.valorant_queue_entries from anon, authenticated;
revoke all on table public.valorant_rating_history from anon, authenticated;
revoke all on table public.valorant_result_submissions from anon, authenticated;
revoke all on table public.valorant_squad_ratings from anon, authenticated;

-- Cover foreign keys used by Community and competitive flows.
create index if not exists community_environments_created_by_idx on public.community_environments(created_by);
create index if not exists community_environments_lobby_idx on public.community_environments(lobby_id) where lobby_id is not null;
create index if not exists community_event_members_user_idx on public.community_event_members(user_id);
create index if not exists community_events_creator_idx on public.community_events(creator_id);
create index if not exists community_events_environment_idx on public.community_events(environment_id) where environment_id is not null;
create index if not exists community_invites_created_by_idx on public.community_invites(created_by);
create index if not exists community_posts_author_idx on public.community_posts(author_id);
create index if not exists match_team_rooms_lobby_idx on public.match_team_rooms(lobby_id);
create index if not exists match_team_rooms_squad_idx on public.match_team_rooms(squad_id);
create index if not exists strategy_objects_author_idx on public.strategy_objects(author_id);
create index if not exists strategy_sessions_igl_idx on public.strategy_sessions(igl_user_id) where igl_user_id is not null;
create index if not exists strategy_sessions_squad_idx on public.strategy_sessions(squad_id);
create index if not exists valorant_match_players_squad_idx on public.valorant_match_players(squad_id);
create index if not exists valorant_matches_season_idx on public.valorant_matches(season_id);
create index if not exists valorant_matches_squad_a_idx on public.valorant_matches(squad_a_id);
create index if not exists valorant_matches_squad_b_idx on public.valorant_matches(squad_b_id);
create index if not exists valorant_matches_winner_idx on public.valorant_matches(winner_squad_id) where winner_squad_id is not null;
create index if not exists valorant_player_ratings_season_idx on public.valorant_player_ratings(season_id);
create index if not exists valorant_queue_entries_captain_idx on public.valorant_queue_entries(captain_id);
create index if not exists valorant_rating_history_squad_idx on public.valorant_rating_history(squad_id) where squad_id is not null;
create index if not exists valorant_rating_history_user_idx on public.valorant_rating_history(user_id) where user_id is not null;
create index if not exists valorant_result_submissions_captain_idx on public.valorant_result_submissions(captain_id);
create index if not exists valorant_result_submissions_squad_idx on public.valorant_result_submissions(squad_id);
create index if not exists valorant_squad_ratings_season_idx on public.valorant_squad_ratings(season_id);
create index if not exists valorant_veto_actions_captain_idx on public.valorant_veto_actions(captain_id);
create index if not exists valorant_veto_actions_map_slug_idx on public.valorant_veto_actions(map_slug);
create index if not exists valorant_veto_actions_squad_idx on public.valorant_veto_actions(squad_id);

notify pgrst, 'reload schema';

create unique index if not exists friendships_unordered_pair_uidx
on public.friendships ((least(requester_id,addressee_id)),(greatest(requester_id,addressee_id)));

revoke insert, update, delete on table public.friendships from authenticated;
revoke insert, update, delete on table public.direct_messages from authenticated;

drop policy if exists "friendships requester creates" on public.friendships;
drop policy if exists "friendships participants update" on public.friendships;
drop policy if exists "friendships participants delete" on public.friendships;
drop policy if exists "direct messages sender creates" on public.direct_messages;
drop policy if exists "direct messages recipient marks read" on public.direct_messages;

update public.app_schema_state
set version='20260823_social_server_only_dml',updated_at=now()
where id=1;

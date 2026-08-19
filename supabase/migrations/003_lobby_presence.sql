alter table public.lobby_members
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists lobby_members_presence_idx
  on public.lobby_members(lobby_id, last_seen_at);
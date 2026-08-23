create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create index if not exists friendships_requester_idx on public.friendships(requester_id,status);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id,status);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists direct_messages_pair_created_idx on public.direct_messages(sender_id,recipient_id,created_at desc);
create index if not exists direct_messages_recipient_unread_idx on public.direct_messages(recipient_id,created_at desc) where read_at is null;

alter table public.friendships enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "friendships participants read" on public.friendships;
create policy "friendships participants read" on public.friendships for select to authenticated using ((select auth.uid()) in (requester_id,addressee_id));
drop policy if exists "friendships requester creates" on public.friendships;
create policy "friendships requester creates" on public.friendships for insert to authenticated with check ((select auth.uid())=requester_id and status='pending');
drop policy if exists "friendships participants update" on public.friendships;
create policy "friendships participants update" on public.friendships for update to authenticated using ((select auth.uid()) in (requester_id,addressee_id)) with check ((select auth.uid()) in (requester_id,addressee_id));
drop policy if exists "friendships participants delete" on public.friendships;
create policy "friendships participants delete" on public.friendships for delete to authenticated using ((select auth.uid()) in (requester_id,addressee_id));

drop policy if exists "direct messages participants read" on public.direct_messages;
create policy "direct messages participants read" on public.direct_messages for select to authenticated using ((select auth.uid()) in (sender_id,recipient_id));
drop policy if exists "direct messages sender creates" on public.direct_messages;
create policy "direct messages sender creates" on public.direct_messages for insert to authenticated with check ((select auth.uid())=sender_id);
drop policy if exists "direct messages recipient marks read" on public.direct_messages;
create policy "direct messages recipient marks read" on public.direct_messages for update to authenticated using ((select auth.uid())=recipient_id) with check ((select auth.uid())=recipient_id);

update public.app_schema_state set version='20260823_friends_direct_messages',updated_at=now() where id=1;

alter table public.profiles
  add column if not exists bio text default ''::text,
  add column if not exists favorite_game text default ''::text,
  add column if not exists region text default ''::text,
  add column if not exists social_discord text default ''::text,
  add column if not exists social_instagram text default ''::text,
  add column if not exists social_twitch text default ''::text,
  add column if not exists profile_banner text default ''::text,
  add column if not exists avatar_frame text not null default 'prism',
  add column if not exists profile_effect text not null default 'none',
  add column if not exists profile_badge text not null default 'none',
  add column if not exists profile_card_style text not null default 'violet',
  add column if not exists cosmetic_owned jsonb not null default '[]'::jsonb,
  add column if not exists cosmetic_equipped jsonb not null default '{"banner":"void-rift","frame":"prism","effect":"none","badge":"none","cardStyle":"violet","bundle":""}'::jsonb;

revoke update on public.profiles from authenticated;
grant update (
  username,
  email,
  display_name,
  avatar,
  status,
  last_seen_at,
  bio,
  favorite_game,
  region,
  social_discord,
  social_instagram,
  social_twitch,
  profile_banner,
  avatar_frame,
  profile_effect,
  profile_badge,
  profile_card_style,
  cosmetic_owned,
  cosmetic_equipped
) on public.profiles to authenticated;

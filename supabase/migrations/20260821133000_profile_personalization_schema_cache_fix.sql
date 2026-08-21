-- Ensures profile personalization columns exist in production and refreshes PostgREST schema cache.
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

notify pgrst, 'reload schema';

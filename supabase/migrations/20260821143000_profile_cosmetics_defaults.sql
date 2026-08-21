-- Keep database defaults aligned with the application defaults.
-- A new account must start without a paid/equipped avatar frame or aura.
alter table public.profiles
  alter column avatar_frame set default 'none',
  alter column profile_effect set default 'none',
  alter column profile_badge set default 'none',
  alter column profile_card_style set default 'violet',
  alter column cosmetic_owned set default '["void-rift","none","violet"]'::jsonb,
  alter column cosmetic_equipped set default '{"banner":"void-rift","frame":"none","effect":"none","badge":"none","cardStyle":"violet","bundle":""}'::jsonb;

-- Repair only the legacy impossible state produced by the old defaults:
-- prism was equipped while the account did not own prism. Legitimate owners
-- keep their selected frame untouched.
update public.profiles
set
  avatar_frame = 'none',
  cosmetic_equipped = jsonb_set(
    coalesce(cosmetic_equipped, '{}'::jsonb),
    '{frame}',
    '"none"'::jsonb,
    true
  )
where coalesce(avatar_frame, 'prism') = 'prism'
  and not (coalesce(cosmetic_owned, '[]'::jsonb) ? 'prism');

notify pgrst, 'reload schema';

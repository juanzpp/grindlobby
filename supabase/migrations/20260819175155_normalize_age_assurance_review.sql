-- Normalize age assurance around a provider result and a separate guardian flow.
-- This migration preserves all guardian_links rows and removes only duplicated,
-- derived guardian state from age_assurance.

alter table public.age_assurance
  drop constraint if exists age_assurance_age_assurance_status_check;

alter table public.age_assurance
  add constraint age_assurance_age_assurance_status_check
  check (age_assurance_status in (
    'not_started',
    'pending',
    'verified',
    'review_requested',
    'rejected',
    'expired'
  )) not valid;

alter table public.age_assurance
  validate constraint age_assurance_age_assurance_status_check;

alter table public.age_assurance
  drop constraint if exists age_assurance_check,
  drop constraint if exists age_assurance_verified_result_check;

alter table public.age_assurance
  add constraint age_assurance_verified_result_check
  check (
    age_assurance_status <> 'verified'
    or (
      age_band is not null
      and age_verified_at is not null
      and age_verification_method is not null
      and age_verification_method not like 'onboarding_fallback%'
    )
  ) not valid;

alter table public.age_assurance
  validate constraint age_assurance_verified_result_check;

alter table public.age_assurance
  drop constraint if exists age_assurance_check1,
  drop constraint if exists age_assurance_guardian_link_status_check,
  drop column if exists guardian_link_status,
  drop column if exists guardian_verified_at;

comment on table public.age_assurance is
  'Minimal age-assurance result: band, status, method and timestamps only. Never store full birth dates or raw verification evidence here.';

comment on table public.guardian_links is
  'Separate hashed and expiring guardian relationship workflow; age-assurance evidence is never stored here.';

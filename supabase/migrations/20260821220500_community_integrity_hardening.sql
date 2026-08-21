create or replace function public.create_community_atomic(
  p_owner_id uuid,
  p_name text,
  p_description text,
  p_tags text[],
  p_logo_url text default null,
  p_banner_url text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
begin
  insert into public.communities(owner_id,name,description,tags,logo_url,banner_url,privacy)
  values(p_owner_id,p_name,p_description,coalesce(p_tags,'{}'::text[]),p_logo_url,p_banner_url,'private')
  returning id into v_id;

  insert into public.community_members(community_id,user_id,role)
  values(v_id,p_owner_id,'owner');

  insert into public.community_environments(community_id,created_by,name,type,description,capacity,sort_order)
  values
    (v_id,p_owner_id,'Call Principal','voice','Call principal da Community',10,10),
    (v_id,p_owner_id,'Sala Ranked','game','Partidas competitivas e ranked',10,20),
    (v_id,p_owner_id,'Táticas & Estratégias','strategy','Planos, mapas e preparação',10,30),
    (v_id,p_owner_id,'Clips & Highlights','clips','Melhores momentos da Community',50,40);

  insert into public.community_posts(community_id,author_id,type,title,body)
  values(v_id,p_owner_id,'activity','Community criada','');

  return v_id;
end;
$$;
revoke all on function public.create_community_atomic(uuid,text,text,text[],text,text) from public,anon,authenticated;
grant execute on function public.create_community_atomic(uuid,text,text,text[],text,text) to service_role;

create or replace function public.enforce_community_event_environment()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.environment_id is not null and not exists (
    select 1 from public.community_environments e
    where e.id=new.environment_id and e.community_id=new.community_id
  ) then
    raise exception 'environment_not_in_community' using errcode='23514';
  end if;
  if new.ends_at is not null and new.ends_at <= new.starts_at then
    raise exception 'event_end_must_be_after_start' using errcode='23514';
  end if;
  return new;
end;
$$;
drop trigger if exists community_event_environment_guard on public.community_events;
create trigger community_event_environment_guard
before insert or update of community_id,environment_id,starts_at,ends_at on public.community_events
for each row execute function public.enforce_community_event_environment();

insert into public.app_schema_state(id,version,updated_at)
values(1,'20260821_community_integrity_hardening',now())
on conflict(id) do update set version=excluded.version,updated_at=excluded.updated_at;

notify pgrst,'reload schema';
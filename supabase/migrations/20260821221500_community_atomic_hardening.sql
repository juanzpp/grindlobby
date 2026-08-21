create or replace function public.create_community_atomic(
  p_owner_id uuid,
  p_name text,
  p_description text,
  p_tags text[],
  p_logo_url text default null,
  p_banner_url text default null,
  p_actor_label text default 'Usuário'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_community_id uuid;
begin
  insert into public.communities(owner_id,name,description,tags,logo_url,banner_url,privacy)
  values(p_owner_id,p_name,p_description,coalesce(p_tags,'{}'::text[]),p_logo_url,p_banner_url,'private')
  returning id into v_community_id;

  insert into public.community_members(community_id,user_id,role)
  values(v_community_id,p_owner_id,'owner');

  insert into public.community_environments(community_id,created_by,name,description,type,capacity,sort_order)
  values
    (v_community_id,p_owner_id,'Call Principal','Call principal da Community','voice',10,10),
    (v_community_id,p_owner_id,'Sala Ranked','Partidas competitivas e ranked','game',10,20),
    (v_community_id,p_owner_id,'Táticas & Estratégias','Planos, mapas e preparação','strategy',10,30),
    (v_community_id,p_owner_id,'Clips & Highlights','Melhores momentos da Community','clips',50,40);

  insert into public.community_posts(community_id,author_id,type,title,body)
  values(v_community_id,p_owner_id,'activity','Community criada',coalesce(nullif(p_actor_label,''),'Usuário') || ' criou a Community.');

  return v_community_id;
end;
$$;

revoke all on function public.create_community_atomic(uuid,text,text,text[],text,text,text) from public, anon, authenticated;
grant execute on function public.create_community_atomic(uuid,text,text,text[],text,text,text) to service_role;

create or replace function public.accept_community_invite_atomic(
  p_token_hash text,
  p_user_id uuid,
  p_actor_label text default 'Usuário'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.community_invites%rowtype;
begin
  select * into v_invite
  from public.community_invites
  where token_hash=p_token_hash
  for update;

  if v_invite.id is null
     or v_invite.revoked
     or (v_invite.expires_at is not null and v_invite.expires_at < now())
     or (v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses) then
    return jsonb_build_object('status','unavailable');
  end if;

  if exists(
    select 1 from public.community_members
    where community_id=v_invite.community_id and user_id=p_user_id
  ) then
    return jsonb_build_object('status','already_member','communityId',v_invite.community_id);
  end if;

  insert into public.community_members(community_id,user_id,role)
  values(v_invite.community_id,p_user_id,'member');

  update public.community_invites
  set uses=uses+1
  where id=v_invite.id;

  insert into public.community_posts(community_id,author_id,type,title,body)
  values(v_invite.community_id,p_user_id,'activity',coalesce(nullif(p_actor_label,''),'Usuário') || ' entrou para a Community','');

  return jsonb_build_object('status','joined','communityId',v_invite.community_id);
end;
$$;

revoke all on function public.accept_community_invite_atomic(text,uuid,text) from public, anon, authenticated;
grant execute on function public.accept_community_invite_atomic(text,uuid,text) to service_role;

update public.app_schema_state
set version='20260821_community_atomic_hardening', updated_at=now()
where id=1;

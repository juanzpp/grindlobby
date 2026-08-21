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

  update public.community_invites set uses=uses+1 where id=v_invite.id;

  insert into public.community_posts(community_id,author_id,type,title,body)
  values(v_invite.community_id,p_user_id,'activity',coalesce(nullif(p_actor_label,''),'Usuário') || ' entrou para a Community','');

  return jsonb_build_object('status','joined','communityId',v_invite.community_id);
end;
$$;

revoke all on function public.accept_community_invite_atomic(text,uuid,text) from public, anon, authenticated;
grant execute on function public.accept_community_invite_atomic(text,uuid,text) to service_role;

update public.app_schema_state
set version='20260821_community_invite_atomic', updated_at=now()
where id=1;

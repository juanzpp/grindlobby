create or replace function public.valorant_accept_match_atomic(p_match_id uuid,p_user_id uuid,p_accepted boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare m public.valorant_matches%rowtype; v_count integer;
begin
  select * into m from public.valorant_matches where id=p_match_id for update;
  if m.id is null then return jsonb_build_object('result','not_found'); end if;
  if m.state <> 'ACCEPTING' then return jsonb_build_object('result','invalid_state','state',m.state); end if;
  if m.accept_deadline is not null and m.accept_deadline <= now() then
    update public.valorant_matches set state='CANCELLED',updated_at=now() where id=p_match_id;
    return jsonb_build_object('result','expired','state','CANCELLED');
  end if;
  if not exists(select 1 from public.valorant_match_players where match_id=p_match_id and user_id=p_user_id) then return jsonb_build_object('result','forbidden'); end if;
  update public.valorant_match_players set accepted=p_accepted,accepted_at=now() where match_id=p_match_id and user_id=p_user_id;
  if not p_accepted then
    update public.valorant_matches set state='CANCELLED',updated_at=now() where id=p_match_id;
    return jsonb_build_object('result','ok','state','CANCELLED','accepted',0);
  end if;
  select count(*) into v_count from public.valorant_match_players where match_id=p_match_id and accepted=true;
  if v_count=10 then
    update public.valorant_matches set state='VETO',veto_deadline=now()+interval '24 seconds',updated_at=now() where id=p_match_id;
    return jsonb_build_object('result','ok','state','VETO','accepted',10);
  end if;
  return jsonb_build_object('result','ok','state','ACCEPTING','accepted',v_count);
end;$$;
revoke execute on function public.valorant_accept_match_atomic(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.valorant_accept_match_atomic(uuid,uuid,boolean) to service_role;

create or replace function public.valorant_veto_map_atomic(p_match_id uuid,p_user_id uuid,p_map_slug text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare m public.valorant_matches%rowtype; v_step integer; v_squad uuid; v_captain uuid; v_remaining integer; v_selected text;
begin
  select * into m from public.valorant_matches where id=p_match_id for update;
  if m.id is null then return jsonb_build_object('result','not_found'); end if;
  if m.state <> 'VETO' then return jsonb_build_object('result','invalid_state','state',m.state); end if;
  if m.veto_deadline is not null and m.veto_deadline <= now() then return jsonb_build_object('result','expired'); end if;
  select coalesce(max(step),0)+1 into v_step from public.valorant_veto_actions where match_id=p_match_id;
  v_squad := case when mod(v_step,2)=1 then m.squad_a_id else m.squad_b_id end;
  select captain_id into v_captain from public.valorant_squads where id=v_squad;
  if v_captain is distinct from p_user_id then return jsonb_build_object('result','not_turn'); end if;
  if not exists(select 1 from public.valorant_map_pool where slug=p_map_slug and active=true) then return jsonb_build_object('result','invalid_map'); end if;
  if exists(select 1 from public.valorant_veto_actions where match_id=p_match_id and map_slug=p_map_slug) then return jsonb_build_object('result','already_used'); end if;
  insert into public.valorant_veto_actions(match_id,step,squad_id,captain_id,map_slug,action) values(p_match_id,v_step,v_squad,p_user_id,p_map_slug,'ban');
  select count(*) into v_remaining from public.valorant_map_pool p where p.active=true and not exists(select 1 from public.valorant_veto_actions a where a.match_id=p_match_id and a.map_slug=p.slug);
  if v_remaining=1 then
    select p.slug into v_selected from public.valorant_map_pool p where p.active=true and not exists(select 1 from public.valorant_veto_actions a where a.match_id=p_match_id and a.map_slug=p.slug) order by p.sort_order limit 1;
    update public.valorant_matches set state='MAP_SELECTED',selected_map_slug=v_selected,veto_deadline=null,updated_at=now() where id=p_match_id;
    return jsonb_build_object('result','ok','state','MAP_SELECTED','selectedMapSlug',v_selected,'remaining',1);
  end if;
  update public.valorant_matches set veto_deadline=now()+interval '24 seconds',updated_at=now() where id=p_match_id;
  return jsonb_build_object('result','ok','state','VETO','remaining',v_remaining);
end;$$;
revoke execute on function public.valorant_veto_map_atomic(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.valorant_veto_map_atomic(uuid,uuid,text) to service_role;

create or replace function public.submit_valorant_result_atomic(p_match_id uuid,p_captain_id uuid,p_score_a integer,p_score_b integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare m public.valorant_matches%rowtype; v_squad uuid; v_count integer; s1 public.valorant_result_submissions%rowtype; s2 public.valorant_result_submissions%rowtype; v_done boolean;
begin
  if p_score_a<0 or p_score_a>99 or p_score_b<0 or p_score_b>99 or p_score_a=p_score_b then return jsonb_build_object('result','invalid_score'); end if;
  select * into m from public.valorant_matches where id=p_match_id for update;
  if m.id is null then return jsonb_build_object('result','not_found'); end if;
  if m.state not in ('LOBBY_READY','PLAYING','RESULT_PENDING','DISPUTED') then return jsonb_build_object('result','invalid_state','state',m.state); end if;
  select id into v_squad from public.valorant_squads where id in (m.squad_a_id,m.squad_b_id) and captain_id=p_captain_id limit 1;
  if v_squad is null then return jsonb_build_object('result','forbidden'); end if;
  insert into public.valorant_result_submissions(match_id,captain_id,squad_id,score_a,score_b,submitted_at)
  values(p_match_id,p_captain_id,v_squad,p_score_a,p_score_b,now())
  on conflict(match_id,captain_id) do update set squad_id=excluded.squad_id,score_a=excluded.score_a,score_b=excluded.score_b,submitted_at=excluded.submitted_at;
  select count(*) into v_count from public.valorant_result_submissions where match_id=p_match_id;
  if v_count<2 then
    update public.valorant_matches set state='RESULT_PENDING',updated_at=now() where id=p_match_id;
    return jsonb_build_object('result','ok','state','RESULT_PENDING','waitingForOpponent',true);
  end if;
  select * into s1 from public.valorant_result_submissions where match_id=p_match_id order by submitted_at asc limit 1;
  select * into s2 from public.valorant_result_submissions where match_id=p_match_id order by submitted_at asc offset 1 limit 1;
  if s1.score_a<>s2.score_a or s1.score_b<>s2.score_b then
    update public.valorant_matches set state='DISPUTED',updated_at=now() where id=p_match_id;
    return jsonb_build_object('result','ok','state','DISPUTED');
  end if;
  select public.finalize_valorant_match(p_match_id) into v_done;
  return jsonb_build_object('result','ok','state',case when v_done then 'FINISHED' else 'RESULT_PENDING' end);
end;$$;
revoke execute on function public.submit_valorant_result_atomic(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.submit_valorant_result_atomic(uuid,uuid,integer,integer) to service_role;

create or replace function public.valorant_enqueue_and_match(p_squad_id uuid,p_captain_id uuid,p_region text,p_average_gr integer) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_opponent public.valorant_queue_entries%rowtype; v_match_id uuid; v_season uuid; v_wait_seconds integer; v_window integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_squad_id::text,0));
  if not exists(select 1 from public.valorant_squads where id=p_squad_id and captain_id=p_captain_id) then raise exception 'not_captain'; end if;
  if (select count(*) from public.valorant_squad_members where squad_id=p_squad_id) <> 5 then raise exception 'squad_incomplete'; end if;
  if exists(select 1 from public.valorant_matches where (squad_a_id=p_squad_id or squad_b_id=p_squad_id) and state not in ('FINISHED','CANCELLED')) then raise exception 'squad_already_in_match'; end if;
  select id into v_season from public.valorant_seasons where status='active' order by starts_at desc limit 1;
  if v_season is null then raise exception 'no_active_season'; end if;
  insert into public.valorant_queue_entries(squad_id,captain_id,region,average_gr,status) values(p_squad_id,p_captain_id,p_region,p_average_gr,'searching') on conflict(squad_id) do update set captain_id=excluded.captain_id,region=excluded.region,average_gr=excluded.average_gr,status='searching',created_at=now();
  select q.* into v_opponent from public.valorant_queue_entries q where q.status='searching' and q.squad_id<>p_squad_id and q.region=p_region and not exists(select 1 from public.valorant_squad_members mine join public.valorant_squad_members theirs on mine.user_id=theirs.user_id where mine.squad_id=p_squad_id and theirs.squad_id=q.squad_id) and not exists(select 1 from public.valorant_matches m where (m.squad_a_id=q.squad_id or m.squad_b_id=q.squad_id) and m.state not in ('FINISHED','CANCELLED')) order by q.created_at asc for update skip locked limit 1;
  if v_opponent.id is null then return null; end if;
  v_wait_seconds := greatest(0,extract(epoch from (now()-v_opponent.created_at))::integer);
  v_window := case when v_wait_seconds < 30 then 75 when v_wait_seconds < 60 then 125 when v_wait_seconds < 90 then 175 else 300 end;
  if abs(v_opponent.average_gr-p_average_gr) > v_window then return null; end if;
  insert into public.valorant_matches(season_id,squad_a_id,squad_b_id,state,region,average_gr_a,average_gr_b,accept_deadline) values(v_season,v_opponent.squad_id,p_squad_id,'ACCEPTING',p_region,v_opponent.average_gr,p_average_gr,now()+interval '20 seconds') returning id into v_match_id;
  insert into public.valorant_match_players(match_id,user_id,squad_id) select v_match_id,user_id,v_opponent.squad_id from public.valorant_squad_members where squad_id=v_opponent.squad_id union all select v_match_id,user_id,p_squad_id from public.valorant_squad_members where squad_id=p_squad_id;
  delete from public.valorant_queue_entries where squad_id in (v_opponent.squad_id,p_squad_id);
  return v_match_id;
end;$$;
revoke execute on function public.valorant_enqueue_and_match(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.valorant_enqueue_and_match(uuid,uuid,text,integer) to service_role;
notify pgrst,'reload schema';
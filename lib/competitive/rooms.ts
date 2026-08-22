import {createAdminClient} from '@/lib/supabase/admin';

type TeamSquad={id:string;name:string;captain_id:string};

type ExistingRoom={id:string;lobby_id:string};

async function closeLobby(admin:ReturnType<typeof createAdminClient>,lobbyId:string){
  await admin.from('lobbies').update({status:'closed',updated_at:new Date().toISOString()}).eq('id',lobbyId);
}

export async function ensureValorantTeamRooms(matchId:string,mapSlug:string){
  const admin=createAdminClient();
  const {data:match,error}=await admin.from('valorant_matches').select('id,code,squad_a_id,squad_b_id').eq('id',matchId).single();
  if(error)throw error;

  const {data:squads,error:squadError}=await admin.from('valorant_squads').select('id,name,captain_id').in('id',[match.squad_a_id,match.squad_b_id]);
  if(squadError)throw squadError;
  const squadMap=new Map<string,TeamSquad>(((squads??[]) as TeamSquad[]).map(squad=>[squad.id,squad]));
  const {data:game,error:gameError}=await admin.from('games').select('id').eq('slug','valorant').maybeSingle();
  if(gameError)throw gameError;

  for(const squadId of [match.squad_a_id,match.squad_b_id]){
    const squad=squadMap.get(squadId);if(!squad)throw new Error('Squad ausente.');
    const {data:members,error:memberError}=await admin.from('valorant_squad_members').select('user_id').eq('squad_id',squadId);
    if(memberError)throw memberError;
    if(!members?.length)throw new Error('Squad sem membros.');

    const {data:existing,error:existingError}=await admin.from('match_team_rooms').select('id,lobby_id').eq('match_id',matchId).eq('squad_id',squadId).maybeSingle();
    if(existingError)throw existingError;

    if(existing){
      const current=existing as ExistingRoom;
      const {data:lobby,error:lobbyError}=await admin.from('lobbies').select('id,status').eq('id',current.lobby_id).maybeSingle();
      if(lobbyError)throw lobbyError;
      if(lobby?.status==='open'){
        const {error:memberSyncError}=await admin.from('lobby_members').upsert(members.map(member=>({lobby_id:current.lobby_id,user_id:member.user_id,role:member.user_id===squad.captain_id?'owner':'member',last_seen_at:new Date().toISOString()})),{onConflict:'lobby_id,user_id'});
        if(memberSyncError)throw memberSyncError;
        const {error:strategyError}=await admin.from('strategy_sessions').upsert({match_id:matchId,squad_id:squadId,map_slug:mapSlug,edit_mode:'captain'},{onConflict:'match_id,squad_id'});
        if(strategyError)throw strategyError;
        continue;
      }
    }

    const {data:lobby,error:lobbyError}=await admin.from('lobbies').insert({owner_id:squad.captain_id,game_id:game?.id??null,name:`${match.code} · ${squad.name}`,description:`Sala privada da partida ${match.code} · mapa ${mapSlug}`,visibility:'private',max_members:5,status:'open'}).select('id').single();
    if(lobbyError)throw lobbyError;
    let committed=false;
    try{
      const {error:insertError}=await admin.from('lobby_members').upsert(members.map(member=>({lobby_id:lobby.id,user_id:member.user_id,role:member.user_id===squad.captain_id?'owner':'member',last_seen_at:new Date().toISOString()})),{onConflict:'lobby_id,user_id'});
      if(insertError)throw insertError;

      const roomPayload={match_id:matchId,squad_id:squadId,lobby_id:lobby.id,status:'PRE_MATCH'};
      const roomResult=existing
        ? await admin.from('match_team_rooms').update({lobby_id:lobby.id,status:'PRE_MATCH'}).eq('id',(existing as ExistingRoom).id)
        : await admin.from('match_team_rooms').insert(roomPayload);
      if(roomResult.error)throw roomResult.error;

      const {error:strategyError}=await admin.from('strategy_sessions').upsert({match_id:matchId,squad_id:squadId,map_slug:mapSlug,edit_mode:'captain'},{onConflict:'match_id,squad_id'});
      if(strategyError)throw strategyError;
      committed=true;
      if(existing&&(existing as ExistingRoom).lobby_id!==lobby.id)await closeLobby(admin,(existing as ExistingRoom).lobby_id);
    }finally{
      if(!committed)await closeLobby(admin,lobby.id);
    }
  }
}

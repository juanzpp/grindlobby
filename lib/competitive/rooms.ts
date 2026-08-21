import {createAdminClient} from '@/lib/supabase/admin';

export async function ensureValorantTeamRooms(matchId:string,mapSlug:string){
  const admin=createAdminClient();
  const {data:match,error}=await admin.from('valorant_matches').select('id,code,squad_a_id,squad_b_id').eq('id',matchId).single();
  if(error)throw error;
  const {data:squads,error:squadError}=await admin.from('valorant_squads').select('id,name,captain_id').in('id',[match.squad_a_id,match.squad_b_id]);
  if(squadError)throw squadError;
  type TeamSquad={id:string;name:string;captain_id:string};
  const squadMap=new Map<string,TeamSquad>(((squads??[]) as TeamSquad[]).map(squad=>[squad.id,squad]));
  const {data:game}=await admin.from('games').select('id').eq('slug','valorant').maybeSingle();
  for(const squadId of [match.squad_a_id,match.squad_b_id]){
    const {data:existing}=await admin.from('match_team_rooms').select('id,lobby_id').eq('match_id',matchId).eq('squad_id',squadId).maybeSingle();
    if(existing)continue;
    const squad=squadMap.get(squadId);if(!squad)throw new Error('Squad ausente.');
    const {data:lobby,error:lobbyError}=await admin.from('lobbies').insert({owner_id:squad.captain_id,game_id:game?.id??null,name:`${match.code} · ${squad.name}`,description:`Sala privada da partida ${match.code} · mapa ${mapSlug}`,visibility:'private',max_members:5,status:'open'}).select('id').single();
    if(lobbyError)throw lobbyError;
    const {data:members,error:memberError}=await admin.from('valorant_squad_members').select('user_id').eq('squad_id',squadId);if(memberError)throw memberError;
    if(members?.length){const {error:insertError}=await admin.from('lobby_members').upsert(members.map(m=>({lobby_id:lobby.id,user_id:m.user_id,role:m.user_id===squad.captain_id?'owner':'member',last_seen_at:new Date().toISOString()})),{onConflict:'lobby_id,user_id'});if(insertError)throw insertError;}
    const {error:roomError}=await admin.from('match_team_rooms').insert({match_id:matchId,squad_id:squadId,lobby_id:lobby.id,status:'PRE_MATCH'});if(roomError)throw roomError;
    const {error:strategyError}=await admin.from('strategy_sessions').upsert({match_id:matchId,squad_id:squadId,map_slug:mapSlug,edit_mode:'captain'},{onConflict:'match_id,squad_id'});if(strategyError)throw strategyError;
  }
}

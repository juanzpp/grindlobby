import {createAdminClient} from '@/lib/supabase/admin';
import {ensureValorantTeamRooms} from '@/lib/competitive/rooms';

type VetoMatch={id:string;state:string;squad_a_id:string;squad_b_id:string;veto_deadline:string|null};
type VetoSquad={id:string;captain_id:string};
type VetoAction={step:number;map_slug:string};
type PoolMap={slug:string;name:string;sort_order:number};

/**
 * Server-authoritative opportunistic veto timeout.
 * Any authenticated match read can advance an expired turn; unique DB constraints make
 * duplicate concurrent readers harmless. This avoids relying on a browser timer.
 */
export async function advanceExpiredValorantVeto(matchId:string){
  const admin=createAdminClient();
  const {data,error}=await admin.from('valorant_matches').select('id,state,squad_a_id,squad_b_id,veto_deadline').eq('id',matchId).maybeSingle();
  if(error)throw error;
  const match=data as VetoMatch|null;
  if(!match||match.state!=='VETO'||!match.veto_deadline||new Date(match.veto_deadline).getTime()>Date.now())return false;

  const [{data:squadRows,error:squadError},{data:actionRows,error:actionError},{data:poolRows,error:poolError}]=await Promise.all([
    admin.from('valorant_squads').select('id,captain_id').in('id',[match.squad_a_id,match.squad_b_id]),
    admin.from('valorant_veto_actions').select('step,map_slug').eq('match_id',matchId).order('step'),
    admin.from('valorant_map_pool').select('slug,name,sort_order').eq('active',true).order('sort_order'),
  ]);
  if(squadError)throw squadError;if(actionError)throw actionError;if(poolError)throw poolError;
  const squads=(squadRows??[]) as VetoSquad[],actions=(actionRows??[]) as VetoAction[],pool=(poolRows??[]) as PoolMap[];
  const nextStep=actions.length+1;
  const expectedSquadId=nextStep%2===1?match.squad_a_id:match.squad_b_id;
  const captain=squads.find(item=>item.id===expectedSquadId)?.captain_id;
  if(!captain)return false;
  const banned=new Set(actions.map(item=>item.map_slug));
  const remaining=pool.filter(item=>!banned.has(item.slug));
  if(remaining.length<=1){
    if(remaining[0]){
      await admin.from('valorant_matches').update({state:'MAP_SELECTED',selected_map_slug:remaining[0].slug,veto_deadline:null,updated_at:new Date().toISOString()}).eq('id',matchId).eq('state','VETO');
      await ensureValorantTeamRooms(matchId,remaining[0].slug);
      await admin.from('valorant_matches').update({state:'LOBBY_READY',updated_at:new Date().toISOString()}).eq('id',matchId).eq('state','MAP_SELECTED');
    }
    return true;
  }

  // Deterministic auto-ban: first remaining map by configured pool order.
  const auto=remaining[0];
  const {error:insertError}=await admin.from('valorant_veto_actions').insert({match_id:matchId,step:nextStep,squad_id:expectedSquadId,captain_id:captain,map_slug:auto.slug,action:'ban'});
  if(insertError){
    // A concurrent request may have advanced the same step. Unique constraints protect state.
    if((insertError as {code?:string}).code==='23505')return false;
    throw insertError;
  }
  const after=remaining.slice(1);
  if(after.length===1){
    await admin.from('valorant_matches').update({state:'MAP_SELECTED',selected_map_slug:after[0].slug,veto_deadline:null,updated_at:new Date().toISOString()}).eq('id',matchId).eq('state','VETO');
    await ensureValorantTeamRooms(matchId,after[0].slug);
    await admin.from('valorant_matches').update({state:'LOBBY_READY',updated_at:new Date().toISOString()}).eq('id',matchId).eq('state','MAP_SELECTED');
  }else{
    await admin.from('valorant_matches').update({veto_deadline:new Date(Date.now()+24000).toISOString(),updated_at:new Date().toISOString()}).eq('id',matchId).eq('state','VETO');
  }
  return true;
}

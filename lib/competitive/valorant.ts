import {createAdminClient} from '@/lib/supabase/admin';

export const VALORANT_ACTIVE_STATES=['MATCH_FOUND','ACCEPTING','VETO','MAP_SELECTED','LOBBY_READY','PLAYING','RESULT_PENDING','DISPUTED'] as const;
export type ValorantMatchState=typeof VALORANT_ACTIVE_STATES[number]|'FINISHED'|'CANCELLED';

export async function activeValorantSeason(){
  const admin=createAdminClient();
  const {data,error}=await admin.from('valorant_seasons').select('id,name,starts_at,ends_at,status').eq('status','active').order('starts_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw error;
  return data;
}

export async function userSquad(userId:string){
  const admin=createAdminClient();
  const {data:membership,error}=await admin.from('valorant_squad_members').select('squad_id').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  if(!membership)return null;
  const [{data:squad,error:squadError},{data:members,error:membersError}]=await Promise.all([
    admin.from('valorant_squads').select('id,name,captain_id,region,created_at').eq('id',membership.squad_id).single(),
    admin.from('valorant_squad_members').select('user_id,joined_at').eq('squad_id',membership.squad_id).order('joined_at'),
  ]);
  if(squadError)throw squadError;if(membersError)throw membersError;
  const ids=(members??[]).map(m=>m.user_id);
  const {data:profiles,error:profileError}=ids.length?await admin.from('profiles').select('id,username,display_name,avatar,status').in('id',ids):{data:[],error:null};
  if(profileError)throw profileError;
  return {...squad,members:(members??[]).map(member=>({...member,profile:(profiles??[]).find(p=>p.id===member.user_id)??null}))};
}

export async function ensurePlayerRatings(userIds:string[]){
  if(!userIds.length)return;
  const admin=createAdminClient();
  const season=await activeValorantSeason();
  if(!season)throw new Error('Nenhuma temporada ativa.');
  const rows=userIds.map(user_id=>({user_id,season_id:season.id,rating:1000,peak_rating:1000,placements_played:0,wins:0,losses:0}));
  const {error}=await admin.from('valorant_player_ratings').upsert(rows,{onConflict:'user_id,season_id',ignoreDuplicates:true});
  if(error)throw error;
}

export async function squadAverageGr(squadId:string){
  const admin=createAdminClient();
  const season=await activeValorantSeason();if(!season)return 1000;
  const {data:members,error}=await admin.from('valorant_squad_members').select('user_id').eq('squad_id',squadId);if(error)throw error;
  const ids=(members??[]).map(m=>m.user_id);await ensurePlayerRatings(ids);
  const {data:ratings,error:ratingError}=ids.length?await admin.from('valorant_player_ratings').select('user_id,rating').eq('season_id',season.id).in('user_id',ids):{data:[],error:null};
  if(ratingError)throw ratingError;
  if(!(ratings??[]).length)return 1000;
  return Math.round((ratings??[]).reduce((sum,row)=>sum+Number(row.rating||1000),0)/(ratings??[]).length);
}

export async function activeMatchForUser(userId:string){
  const admin=createAdminClient();
  const {data:players,error}=await admin.from('valorant_match_players').select('match_id').eq('user_id',userId).order('created_at',{ascending:false}).limit(20);if(error)throw error;
  const ids=(players??[]).map(p=>p.match_id);if(!ids.length)return null;
  const {data,error:matchError}=await admin.from('valorant_matches').select('*').in('id',ids).in('state',[...VALORANT_ACTIVE_STATES]).order('created_at',{ascending:false}).limit(1).maybeSingle();if(matchError)throw matchError;
  return data;
}

export function expectedScore(rating:number,opponent:number){return 1/(1+10**((opponent-rating)/400))}
export function ratingDelta(rating:number,opponent:number,result:0|1,placementsPlayed:number){
  const k=placementsPlayed<5?48:24;
  return Math.round(k*(result-expectedScore(rating,opponent)));
}

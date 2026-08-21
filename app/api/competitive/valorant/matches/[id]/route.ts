import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {noStoreJson} from '@/lib/security/request';
import {advanceExpiredValorantVeto} from '@/lib/competitive/veto';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await getCurrentUser();if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});const {id}=await params;const admin=createAdminClient();
  const {data:myPlayer}=await admin.from('valorant_match_players').select('match_id,squad_id,accepted').eq('match_id',id).eq('user_id',user.id).maybeSingle();if(!myPlayer)return noStoreJson({error:'Partida não encontrada.'},{status:404});
  let {data:match,error}=await admin.from('valorant_matches').select('*').eq('id',id).single();if(error)throw error;
  if(match.state==='VETO'&&match.veto_deadline&&new Date(match.veto_deadline).getTime()<=Date.now()){await advanceExpiredValorantVeto(id);const refreshed=await admin.from('valorant_matches').select('*').eq('id',id).single();if(refreshed.error)throw refreshed.error;match=refreshed.data;}
  if(match.state==='ACCEPTING'&&match.accept_deadline&&new Date(match.accept_deadline).getTime()<Date.now()){
    const {count}=await admin.from('valorant_match_players').select('*',{count:'exact',head:true}).eq('match_id',id).eq('accepted',true);
    if((count??0)<10){await admin.from('valorant_matches').update({state:'CANCELLED',updated_at:new Date().toISOString()}).eq('id',id).eq('state','ACCEPTING');match={...match,state:'CANCELLED'};}
  }
  const [{data:squads},{data:players},{data:veto},{data:maps},{data:rooms},{data:sessions},{data:history}]=await Promise.all([
    admin.from('valorant_squads').select('id,name,captain_id,region').in('id',[match.squad_a_id,match.squad_b_id]),
    admin.from('valorant_match_players').select('user_id,squad_id,accepted,accepted_at').eq('match_id',id),
    admin.from('valorant_veto_actions').select('id,step,squad_id,captain_id,map_slug,action,created_at').eq('match_id',id).order('step'),
    admin.from('valorant_map_pool').select('slug,name,thumbnail_url,active,sort_order').eq('active',true).order('sort_order'),
    admin.from('match_team_rooms').select('id,squad_id,lobby_id,status,expires_at').eq('match_id',id),
    admin.from('strategy_sessions').select('id,squad_id,map_slug,edit_mode,igl_user_id,version,updated_at').eq('match_id',id),
    admin.from('valorant_rating_history').select('user_id,squad_id,rating_type,before_rating,after_rating,delta').eq('match_id',id),
  ]);
  const ids=(players??[]).map(p=>p.user_id);const {data:profiles}=ids.length?await admin.from('profiles').select('id,username,display_name,avatar,status').in('id',ids):{data:[]};
  const seasonId=match.season_id;const {data:ratings}=ids.length?await admin.from('valorant_player_ratings').select('user_id,rating,peak_rating,placements_played,wins,losses').eq('season_id',seasonId).in('user_id',ids):{data:[]};
  const profileMap=new Map((profiles??[]).map(p=>[p.id,p]));const ratingMap=new Map((ratings??[]).map(r=>[r.user_id,r]));
  return noStoreJson({match,mySquadId:myPlayer.squad_id,squads:squads??[],players:(players??[]).map(p=>({...p,profile:profileMap.get(p.user_id)??null,rating:ratingMap.get(p.user_id)??null})),veto:veto??[],maps:maps??[],teamRoom:(rooms??[]).find(r=>r.squad_id===myPlayer.squad_id)??null,strategy:(sessions??[]).find(s=>s.squad_id===myPlayer.squad_id)??null,ratingHistory:history??[]});
 }catch{return noStoreJson({error:'Não foi possível carregar a partida.'},{status:500});}
}

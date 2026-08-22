import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {activeMatchForUser,activeValorantSeason,userSquad} from '@/lib/competitive/valorant';
import {noStoreJson} from '@/lib/security/request';

export async function GET(request:Request){
  try{
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    const admin=createAdminClient();const season=await activeValorantSeason();const squad=await userSquad(user.id);const match=await activeMatchForUser(user.id);
    let rating=null,queue=null;
    if(season){const {data}=await admin.from('valorant_player_ratings').select('rating,peak_rating,placements_played,wins,losses').eq('user_id',user.id).eq('season_id',season.id).maybeSingle();rating=data??{rating:1000,peak_rating:1000,placements_played:0,wins:0,losses:0};}
    if(squad){
      const {data}=await admin.from('valorant_queue_entries').select('id,status,average_gr,region,created_at,last_seen_at').eq('squad_id',squad.id).maybeSingle();
      queue=data;
      if(data?.status==='searching')await admin.from('valorant_queue_entries').update({last_seen_at:new Date().toISOString()}).eq('id',data.id).eq('status','searching');
    }
    return noStoreJson({season,squad,rating,queue,activeMatch:match});
  }catch{return noStoreJson({error:'Não foi possível carregar o competitivo.'},{status:500});}
}

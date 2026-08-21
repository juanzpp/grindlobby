import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {noStoreJson} from '@/lib/security/request';

export async function GET(){
  try{
    const user=await getCurrentUser();if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    const admin=createAdminClient();
    const {data:playerRows,error}=await admin.from('valorant_match_players').select('match_id,squad_id').eq('user_id',user.id).order('created_at',{ascending:false}).limit(60);if(error)throw error;
    const ids=(playerRows??[]).map(row=>row.match_id);if(!ids.length)return noStoreJson({matches:[]});
    const [{data:matches},{data:history}]=await Promise.all([
      admin.from('valorant_matches').select('id,code,squad_a_id,squad_b_id,state,selected_map_slug,score_a,score_b,winner_squad_id,created_at,finished_at').in('id',ids).order('created_at',{ascending:false}),
      admin.from('valorant_rating_history').select('match_id,before_rating,after_rating,delta').in('match_id',ids).eq('user_id',user.id).eq('rating_type','GR'),
    ]);
    const matchList=matches??[];const squadIds=Array.from(new Set(matchList.flatMap(m=>[m.squad_a_id,m.squad_b_id])));const {data:squadRows}=squadIds.length?await admin.from('valorant_squads').select('id,name').in('id',squadIds):{data:[]};
    const squadMap=new Map((squadRows??[]).map(s=>[s.id,s.name]));const mySquadMap=new Map((playerRows??[]).map(p=>[p.match_id,p.squad_id]));const historyMap=new Map((history??[]).map(h=>[h.match_id,h]));
    return noStoreJson({matches:matchList.map(match=>{const mySquad=mySquadMap.get(match.id);const opponentId=mySquad===match.squad_a_id?match.squad_b_id:match.squad_a_id;return{...match,mySquadId:mySquad,opponent:squadMap.get(opponentId)||'Squad',result:match.state==='FINISHED'?(match.winner_squad_id===mySquad?'WIN':'LOSS'):match.state,rating:historyMap.get(match.id)??null};})});
  }catch{return noStoreJson({error:'Não foi possível carregar o histórico.'},{status:500});}
}

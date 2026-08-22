import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {ensureValorantTeamRooms} from '@/lib/competitive/rooms';
import {advanceExpiredValorantVeto} from '@/lib/competitive/veto';
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

const schema=z.object({mapSlug:z.string().trim().min(2).max(40)}).strict();
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'valorant-veto',limit:30,windowSeconds:300,subject:user.id});
    const {id}=await params,body=schema.parse(await readJsonBody(request)),admin=createAdminClient();
    const {data,error}=await admin.rpc('valorant_veto_map_atomic',{p_match_id:id,p_user_id:user.id,p_map_slug:body.mapSlug});
    if(error)throw error;
    const result=data as {result?:string;state?:string;selectedMapSlug?:string;remaining?:number}|null;
    if(result?.result==='not_found')return noStoreJson({error:'Partida não encontrada.'},{status:404});
    if(result?.result==='not_turn')return noStoreJson({error:'Não é o seu turno de veto.'},{status:403});
    if(result?.result==='invalid_map')return noStoreJson({error:'Mapa inválido.'},{status:400});
    if(result?.result==='already_used')return noStoreJson({error:'Este mapa já foi vetado.'},{status:409});
    if(result?.result==='invalid_state')return noStoreJson({error:'O veto não está ativo.',state:result.state},{status:409});
    if(result?.result==='expired'){
      await advanceExpiredValorantVeto(id);
      const {data:refreshed}=await admin.from('valorant_matches').select('state,selected_map_slug').eq('id',id).maybeSingle();
      return noStoreJson({error:'O tempo deste veto acabou; o sistema avançou automaticamente.',state:refreshed?.state,selectedMapSlug:refreshed?.selected_map_slug},{status:409});
    }
    if(result?.result!=='ok')throw new Error('unexpected_veto_result');
    if(result.state==='MAP_SELECTED'&&result.selectedMapSlug){
      await ensureValorantTeamRooms(id,result.selectedMapSlug);
      await admin.from('valorant_matches').update({state:'LOBBY_READY',updated_at:new Date().toISOString()}).eq('id',id).eq('state','MAP_SELECTED');
      const {data:selected}=await admin.from('valorant_map_pool').select('slug,name').eq('slug',result.selectedMapSlug).maybeSingle();
      return noStoreJson({state:'LOBBY_READY',selectedMap:selected??{slug:result.selectedMapSlug,name:result.selectedMapSlug}});
    }
    return noStoreJson({state:'VETO',remaining:result.remaining??0});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:'Mapa inválido.'},{status:400});
    return noStoreJson({error:'Não foi possível registrar o veto.'},{status:500});
  }
}

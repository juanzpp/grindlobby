import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {assertTrustedMutation,InvalidRequestError,noStoreJson} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

export async function POST(request:Request,{params}:{params:Promise<{id:string;eventId:string}>}){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'community-event-join',limit:30,windowSeconds:300,subject:user.id});
    const {id,eventId}=await params,admin=createAdminClient();
    const {data,error}=await admin.rpc('join_community_event_atomic',{p_event_id:eventId,p_community_id:id,p_user_id:user.id});
    if(error)throw error;
    if(data==='full')return noStoreJson({error:'Evento lotado.'},{status:409});
    if(data==='unavailable')return noStoreJson({error:'Evento indisponível.'},{status:409});
    if(data==='forbidden')return noStoreJson({error:'Community não encontrada.'},{status:404});
    if(data!=='joined')throw new Error('unexpected_join_result');
    return noStoreJson({ok:true});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});
    return noStoreJson({error:'Não foi possível participar do evento.'},{status:500});
  }
}

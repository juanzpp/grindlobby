import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

const schema=z.object({accepted:z.boolean()}).strict();
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser();if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'valorant-accept',limit:20,windowSeconds:60,subject:user.id});
    const {id}=await params,body=schema.parse(await readJsonBody(request)),admin=createAdminClient();
    const {data,error}=await admin.rpc('valorant_accept_match_atomic',{p_match_id:id,p_user_id:user.id,p_accepted:body.accepted});
    if(error)throw error;
    const result=data as {result?:string;state?:string;accepted?:number}|null;
    if(result?.result==='not_found')return noStoreJson({error:'Partida não encontrada.'},{status:404});
    if(result?.result==='forbidden')return noStoreJson({error:'Você não participa desta partida.'},{status:403});
    if(result?.result==='expired')return noStoreJson({error:'O tempo para aceitar acabou.',state:'CANCELLED'},{status:409});
    if(result?.result==='invalid_state')return noStoreJson({error:'A partida não está aceitando confirmações.',state:result.state},{status:409});
    if(result?.result!=='ok')throw new Error('unexpected_accept_result');
    return noStoreJson({state:result.state,accepted:result.accepted??0});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:'Resposta inválida.'},{status:400});
    return noStoreJson({error:'Não foi possível registrar o aceite.'},{status:500});
  }
}

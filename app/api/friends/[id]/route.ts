import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

const actionSchema=z.object({action:z.enum(['accept','decline','remove','block'])});

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'friends-update',limit:80,windowSeconds:3600,subject:user.id});
    const {id}=await params;const {action}=actionSchema.parse(await readJsonBody(request,5000));
    const admin=createAdminClient();
    const {data:row,error}=await admin.from('friendships').select('id,requester_id,addressee_id,status').eq('id',id).maybeSingle();
    if(error)throw error;if(!row||![row.requester_id,row.addressee_id].includes(user.id))return noStoreJson({error:'Solicitação não encontrada.'},{status:404});
    if(action==='accept'){
      if(row.status!=='pending'||row.addressee_id!==user.id)return noStoreJson({error:'Esta solicitação não pode ser aceita.'},{status:409});
      const {data,error:updateError}=await admin.from('friendships').update({status:'accepted',updated_at:new Date().toISOString()}).eq('id',id).select('id,status').single();if(updateError)throw updateError;return noStoreJson({friendship:data});
    }
    if(action==='block'){
      const {data,error:updateError}=await admin.from('friendships').update({status:'blocked',requester_id:user.id,addressee_id:row.requester_id===user.id?row.addressee_id:row.requester_id,updated_at:new Date().toISOString()}).eq('id',id).select('id,status').single();if(updateError)throw updateError;return noStoreJson({friendship:data});
    }
    const {error:deleteError}=await admin.from('friendships').delete().eq('id',id);if(deleteError)throw deleteError;
    return noStoreJson({ok:true});
  }catch(error){
    if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});
    if(error instanceof z.ZodError)return noStoreJson({error:'Ação inválida.'},{status:400});
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    return noStoreJson({error:'Não foi possível atualizar a amizade.'},{status:500});
  }
}

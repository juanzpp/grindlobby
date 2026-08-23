import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

const createSchema=z.object({userId:z.string().uuid()});
const profileSelect='id,username,display_name,avatar,status,last_seen_at';

export async function GET(request:Request){
  try{
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'friends-read',limit:180,windowSeconds:600,subject:user.id});
    const admin=createAdminClient();
    const {data:rows,error}=await admin.from('friendships').select('id,requester_id,addressee_id,status,created_at,updated_at').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).order('updated_at',{ascending:false});
    if(error)throw error;
    const ids=[...new Set((rows??[]).map(r=>r.requester_id===user.id?r.addressee_id:r.requester_id))];
    const {data:profiles,error:profileError}=ids.length?await admin.from('profiles').select(profileSelect).in('id',ids):{data:[],error:null};
    if(profileError)throw profileError;
    const byId=new Map((profiles??[]).map(p=>[p.id,p]));
    const mapped=(rows??[]).map(r=>({...r,direction:r.requester_id===user.id?'outgoing':'incoming',profile:byId.get(r.requester_id===user.id?r.addressee_id:r.requester_id)??null}));
    return noStoreJson({friends:mapped.filter(r=>r.status==='accepted'),incoming:mapped.filter(r=>r.status==='pending'&&r.direction==='incoming'),outgoing:mapped.filter(r=>r.status==='pending'&&r.direction==='outgoing')});
  }catch(error){if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);return noStoreJson({error:'Não foi possível carregar amigos.'},{status:500});}
}

export async function POST(request:Request){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'friends-create',limit:40,windowSeconds:3600,subject:user.id});
    const {userId}=createSchema.parse(await readJsonBody(request,5000));
    if(userId===user.id)return noStoreJson({error:'Você não pode adicionar a si mesmo.'},{status:400});
    const admin=createAdminClient();
    const {data:target}=await admin.from('profiles').select('id').eq('id',userId).maybeSingle();
    if(!target)return noStoreJson({error:'Usuário não encontrado.'},{status:404});
    const {data:existing,error:existingError}=await admin.from('friendships').select('id,requester_id,addressee_id,status').or(`and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`).maybeSingle();
    if(existingError)throw existingError;
    if(existing?.status==='accepted')return noStoreJson({error:'Vocês já são amigos.'},{status:409});
    if(existing?.status==='blocked')return noStoreJson({error:'Não foi possível enviar a solicitação.'},{status:409});
    if(existing?.status==='pending'){
      if(existing.addressee_id===user.id){const {data,error}=await admin.from('friendships').update({status:'accepted',updated_at:new Date().toISOString()}).eq('id',existing.id).select('id,status').single();if(error)throw error;return noStoreJson({friendship:data,accepted:true});}
      return noStoreJson({error:'Solicitação já enviada.'},{status:409});
    }
    const {data,error}=await admin.from('friendships').insert({requester_id:user.id,addressee_id:userId,status:'pending'}).select('id,status,created_at').single();
    if(error)throw error;
    return noStoreJson({friendship:data},{status:201});
  }catch(error){
    if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});
    if(error instanceof z.ZodError)return noStoreJson({error:'Usuário inválido.'},{status:400});
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    return noStoreJson({error:'Não foi possível enviar a solicitação.'},{status:500});
  }
}

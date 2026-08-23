import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {noStoreJson} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

export async function GET(request:Request){
  try{
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'friends-search',limit:120,windowSeconds:600,subject:user.id});
    const q=new URL(request.url).searchParams.get('q')?.trim()??'';
    if(q.length<2)return noStoreJson({users:[]});
    const safe=q.replace(/[%_(),]/g,'').slice(0,40);
    if(safe.length<2)return noStoreJson({users:[]});
    const admin=createAdminClient();
    const [{data:profiles,error},{data:relations,error:relationError}]=await Promise.all([
      admin.from('profiles').select('id,username,display_name,avatar,status,last_seen_at').neq('id',user.id).or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`).limit(20),
      admin.from('friendships').select('id,requester_id,addressee_id,status').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    ]);
    if(error)throw error;if(relationError)throw relationError;
    const relByUser=new Map((relations??[]).map(r=>[r.requester_id===user.id?r.addressee_id:r.requester_id,{id:r.id,status:r.status,direction:r.requester_id===user.id?'outgoing':'incoming'}]));
    return noStoreJson({users:(profiles??[]).map(p=>({...p,relationship:relByUser.get(p.id)??null}))});
  }catch(error){if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);return noStoreJson({error:'Não foi possível buscar jogadores.'},{status:500});}
}

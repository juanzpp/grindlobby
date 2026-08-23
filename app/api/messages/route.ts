import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

const sendSchema=z.object({recipientId:z.string().uuid(),body:z.string().trim().min(1).max(4000)});

async function acceptedFriendship(admin:ReturnType<typeof createAdminClient>,a:string,b:string){
  const {data,error}=await admin.from('friendships').select('id').eq('status','accepted').or(`and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`).maybeSingle();
  if(error)throw error;return Boolean(data);
}

export async function GET(request:Request){
  try{
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'messages-read',limit:240,windowSeconds:600,subject:user.id});
    const admin=createAdminClient();const url=new URL(request.url);const withId=url.searchParams.get('with');
    if(withId){
      if(!z.string().uuid().safeParse(withId).success)return noStoreJson({error:'Conversa inválida.'},{status:400});
      if(!(await acceptedFriendship(admin,user.id,withId)))return noStoreJson({error:'Mensagens diretas exigem amizade aceita.'},{status:403});
      const limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit'))||50));
      const {data,error}=await admin.from('direct_messages').select('id,sender_id,recipient_id,body,created_at,read_at').or(`and(sender_id.eq.${user.id},recipient_id.eq.${withId}),and(sender_id.eq.${withId},recipient_id.eq.${user.id})`).order('created_at',{ascending:false}).limit(limit);
      if(error)throw error;
      await admin.from('direct_messages').update({read_at:new Date().toISOString()}).eq('sender_id',withId).eq('recipient_id',user.id).is('read_at',null);
      return noStoreJson({messages:[...(data??[])].reverse()});
    }
    const {data,error}=await admin.from('direct_messages').select('id,sender_id,recipient_id,body,created_at,read_at').or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).order('created_at',{ascending:false}).limit(300);
    if(error)throw error;
    const latest=new Map<string,{id:string;sender_id:string;recipient_id:string;body:string;created_at:string;read_at:string|null}>();const unread=new Map<string,number>();
    for(const row of data??[]){const peer=row.sender_id===user.id?row.recipient_id:row.sender_id;if(!latest.has(peer))latest.set(peer,row);if(row.recipient_id===user.id&&!row.read_at)unread.set(peer,(unread.get(peer)??0)+1);}
    const ids=[...latest.keys()];const {data:profiles,error:profileError}=ids.length?await admin.from('profiles').select('id,username,display_name,avatar,status,last_seen_at').in('id',ids):{data:[],error:null};if(profileError)throw profileError;
    const byId=new Map((profiles??[]).map(p=>[p.id,p]));
    return noStoreJson({conversations:ids.map(id=>({user:byId.get(id)??null,lastMessage:latest.get(id),unread:unread.get(id)??0})).filter(x=>x.user)});
  }catch(error){if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);return noStoreJson({error:'Não foi possível carregar mensagens.'},{status:500});}
}

export async function POST(request:Request){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'messages-send',limit:120,windowSeconds:60,subject:user.id});
    const body=sendSchema.parse(await readJsonBody(request,10_000));
    if(body.recipientId===user.id)return noStoreJson({error:'Destinatário inválido.'},{status:400});
    const admin=createAdminClient();if(!(await acceptedFriendship(admin,user.id,body.recipientId)))return noStoreJson({error:'Mensagens diretas exigem amizade aceita.'},{status:403});
    const {data,error}=await admin.from('direct_messages').insert({sender_id:user.id,recipient_id:body.recipientId,body:body.body}).select('id,sender_id,recipient_id,body,created_at,read_at').single();if(error)throw error;
    return noStoreJson({message:data},{status:201});
  }catch(error){
    if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});
    if(error instanceof z.ZodError)return noStoreJson({error:'Mensagem inválida.'},{status:400});
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    return noStoreJson({error:'Não foi possível enviar a mensagem.'},{status:500});
  }
}

import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

const createSchema=z.object({
  name:z.string().trim().min(2).max(60),
  description:z.string().trim().max(500).default(''),
  tags:z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  logoUrl:z.string().url().max(1000).nullable().optional(),
  bannerUrl:z.string().url().max(1000).nullable().optional(),
});

export async function GET(request:Request){
  try{
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'communities-read',limit:120,windowSeconds:600,subject:user.id});
    const admin=createAdminClient();
    const {data:memberships,error}=await admin.from('community_members').select('community_id,role,joined_at').eq('user_id',user.id).order('joined_at',{ascending:false});
    if(error)throw error;
    const ids=(memberships??[]).map(row=>row.community_id);
    if(!ids.length)return noStoreJson({communities:[]});
    const [{data:communities,error:communityError},{data:counts,error:countError}]=await Promise.all([
      admin.from('communities').select('id,owner_id,name,description,logo_url,banner_url,privacy,tags,created_at,updated_at').in('id',ids),
      admin.from('community_members').select('community_id,user_id').in('community_id',ids),
    ]);
    if(communityError)throw communityError;if(countError)throw countError;
    const countMap=new Map<string,number>();for(const row of counts??[])countMap.set(row.community_id,(countMap.get(row.community_id)??0)+1);
    const roleMap=new Map((memberships??[]).map(row=>[row.community_id,row.role]));
    return noStoreJson({communities:(communities??[]).map(item=>({...item,role:roleMap.get(item.id)??'member',memberCount:countMap.get(item.id)??1}))});
  }catch(error){if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);return noStoreJson({error:'Não foi possível carregar suas Communities.'},{status:500});}
}

export async function POST(request:Request){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'communities-create',limit:10,windowSeconds:3600,subject:user.id});
    const body=createSchema.parse(await readJsonBody(request,20_000));
    const admin=createAdminClient();
    const {data:communityId,error:createError}=await admin.rpc('create_community_atomic',{
      p_owner_id:user.id,
      p_name:body.name,
      p_description:body.description,
      p_tags:body.tags,
      p_logo_url:body.logoUrl??null,
      p_banner_url:body.bannerUrl??null,
      p_actor_label:user.display_name||user.username||'Usuário',
    });
    if(createError||!communityId)throw createError??new Error('community_create_failed');
    const {data:community,error}=await admin.from('communities').select('id,owner_id,name,description,logo_url,banner_url,privacy,tags,created_at').eq('id',communityId).single();
    if(error)throw error;
    return noStoreJson({community},{status:201});
  }catch(error){
    if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});
    if(error instanceof z.ZodError)return noStoreJson({error:error.issues[0]?.message||'Dados inválidos.'},{status:400});
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    return noStoreJson({error:'Não foi possível criar a Community.'},{status:500});
  }
}

import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {canManageCommunity,communityInviteHash,communityInviteToken,getCommunityMembership} from '@/lib/community';
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';
const schema=z.object({expiresInHours:z.number().int().min(1).max(720).nullable().optional(),maxUses:z.number().int().min(1).max(1000).nullable().optional()});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  assertTrustedMutation(request);
  const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
  const {id}=await params;
  await enforceRateLimit(request,{scope:'community-invite-create',limit:30,windowSeconds:3600,subject:`${user.id}:${id}`});
  const membership=await getCommunityMembership(id,user.id);if(!canManageCommunity(membership?.role))return noStoreJson({error:'Sem permissão.'},{status:403});
  const body=schema.parse(await readJsonBody(request));const token=communityInviteToken(),tokenHash=communityInviteHash(token);const admin=createAdminClient();const expiresAt=body.expiresInHours?new Date(Date.now()+body.expiresInHours*3600000).toISOString():null;const {error}=await admin.from('community_invites').insert({community_id:id,token_hash:tokenHash,created_by:user.id,expires_at:expiresAt,max_uses:body.maxUses??null});if(error)throw error;return noStoreJson({token,url:`/invite/community/${token}`,expiresAt});
 }
 catch(error){if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});if(error instanceof z.ZodError)return noStoreJson({error:'Configuração inválida.'},{status:400});return noStoreJson({error:'Não foi possível criar o convite.'},{status:500});}
}

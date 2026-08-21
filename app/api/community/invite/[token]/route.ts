import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {communityInviteHash} from '@/lib/community';
import {assertTrustedMutation,InvalidRequestError,noStoreJson} from '@/lib/security/request';

async function inviteByToken(token:string){
  const admin=createAdminClient();
  const hash=communityInviteHash(token);
  const {data,error}=await admin.from('community_invites').select('id,community_id,expires_at,max_uses,uses,revoked,created_by').eq('token_hash',hash).maybeSingle();
  if(error)throw error;
  if(!data||data.revoked||(data.expires_at&&new Date(data.expires_at).getTime()<Date.now())||(data.max_uses!=null&&data.uses>=data.max_uses))return null;
  return data;
}

export async function GET(_:Request,{params}:{params:Promise<{token:string}>}){
  try{
    const {token}=await params;const invite=await inviteByToken(token);if(!invite)return noStoreJson({error:'Este convite não está mais disponível.'},{status:404});
    const admin=createAdminClient();
    const {data:community,error:communityError}=await admin.from('communities').select('id,name,description,logo_url,banner_url,privacy').eq('id',invite.community_id).single();if(communityError)throw communityError;
    const {count,error:countError}=await admin.from('community_members').select('*',{count:'exact',head:true}).eq('community_id',invite.community_id);if(countError)throw countError;
    return noStoreJson({community:{...community,memberCount:count??0}});
  }catch{return noStoreJson({error:'Convite inválido.'},{status:404});}
}

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Faça login para aceitar o convite.'},{status:401});
    const {token}=await params;const admin=createAdminClient();
    const {data,error}=await admin.rpc('accept_community_invite_atomic',{
      p_token_hash:communityInviteHash(token),
      p_user_id:user.id,
      p_actor_label:user.display_name||user.username||'Usuário',
    });
    if(error)throw error;
    const result=(data??{}) as {status?:string;communityId?:string};
    if(result.status==='unavailable'||!result.communityId)return noStoreJson({error:'Este convite não está mais disponível.'},{status:404});
    if(result.status==='already_member')return noStoreJson({communityId:result.communityId,alreadyMember:true});
    if(result.status!=='joined')throw new Error('unexpected_invite_result');
    return noStoreJson({communityId:result.communityId,alreadyMember:false});
  }catch(error){if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});return noStoreJson({error:'Não foi possível entrar na Community.'},{status:500});}
}

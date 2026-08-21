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
    const {token}=await params;const invite=await inviteByToken(token);if(!invite)return noStoreJson({error:'Este convite não está mais disponível.'},{status:404});
    const admin=createAdminClient();
    const {data:existing,error:existingError}=await admin.from('community_members').select('community_id').eq('community_id',invite.community_id).eq('user_id',user.id).maybeSingle();if(existingError)throw existingError;
    if(existing)return noStoreJson({communityId:invite.community_id,alreadyMember:true});
    const {data:reservation,error:reserveError}=await admin.from('community_invites').update({uses:invite.uses+1}).eq('id',invite.id).eq('uses',invite.uses).eq('revoked',false).select('id').maybeSingle();
    if(reserveError)throw reserveError;if(!reservation)return noStoreJson({error:'Este convite foi usado por outra pessoa. Tente novamente.'},{status:409});
    const {error:memberError}=await admin.from('community_members').insert({community_id:invite.community_id,user_id:user.id,role:'member'});
    if(memberError){await admin.from('community_invites').update({uses:invite.uses}).eq('id',invite.id).eq('uses',invite.uses+1);throw memberError;}
    await admin.from('community_posts').insert({community_id:invite.community_id,author_id:user.id,type:'activity',title:`${user.display_name||user.username} entrou para a Community`,body:''});
    return noStoreJson({communityId:invite.community_id,alreadyMember:false});
  }catch(error){if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});return noStoreJson({error:'Não foi possível entrar na Community.'},{status:500});}
}

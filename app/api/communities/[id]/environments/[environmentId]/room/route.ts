import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {getCommunityMembership} from '@/lib/community';
import {assertTrustedMutation,InvalidRequestError,noStoreJson} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

export async function POST(request:Request,{params}:{params:Promise<{id:string;environmentId:string}>}){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'community-environment-room',limit:30,windowSeconds:300,subject:user.id});
    const {id,environmentId}=await params;const membership=await getCommunityMembership(id,user.id);if(!membership)return noStoreJson({error:'Community não encontrada.'},{status:404});
    const admin=createAdminClient();
    const [{data:community,error:communityError},{data:environment,error:environmentError}]=await Promise.all([
      admin.from('communities').select('id,owner_id,name').eq('id',id).maybeSingle(),
      admin.from('community_environments').select('id,community_id,name,description,type,capacity,lobby_id').eq('id',environmentId).eq('community_id',id).maybeSingle(),
    ]);
    if(communityError)throw communityError;if(environmentError)throw environmentError;
    if(!community||!environment)return noStoreJson({error:'Ambiente não encontrado.'},{status:404});
    let lobbyId=environment.lobby_id as string|null;
    if(lobbyId){const {data:existing,error:existingError}=await admin.from('lobbies').select('id,status').eq('id',lobbyId).maybeSingle();if(existingError)throw existingError;if(!existing||existing.status!=='open'){lobbyId=null;await admin.from('community_environments').update({lobby_id:null,updated_at:new Date().toISOString()}).eq('id',environmentId);}}
    if(!lobbyId){
      const {data:lobby,error}=await admin.from('lobbies').insert({owner_id:community.owner_id,game_id:null,name:`${community.name} · ${environment.name}`,description:environment.description||`Ambiente ${environment.name}`,visibility:'private',max_members:Math.min(100,Math.max(2,environment.capacity||10)),status:'open'}).select('id').single();if(error)throw error;lobbyId=lobby.id;
      const {error:updateError}=await admin.from('community_environments').update({lobby_id:lobbyId,updated_at:new Date().toISOString()}).eq('id',environmentId).is('lobby_id',null);if(updateError)throw updateError;
      const {data:authoritative,error:authoritativeError}=await admin.from('community_environments').select('lobby_id').eq('id',environmentId).single();if(authoritativeError)throw authoritativeError;
      if(authoritative?.lobby_id&&authoritative.lobby_id!==lobbyId){await admin.from('lobbies').update({status:'closed'}).eq('id',lobbyId);lobbyId=authoritative.lobby_id;}
    }
    const role=user.id===community.owner_id?'owner':'member';
    const {error:memberError}=await admin.from('lobby_members').upsert({lobby_id:lobbyId,user_id:user.id,role,last_seen_at:new Date().toISOString()},{onConflict:'lobby_id,user_id'});if(memberError)throw memberError;
    return noStoreJson({lobbyId});
  }catch(error){if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);return noStoreJson({error:'Não foi possível abrir este Ambiente.'},{status:500});}
}

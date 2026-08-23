import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {squadAverageGr,userSquad} from '@/lib/competitive/valorant';
import {assertTrustedMutation,InvalidRequestError,noStoreJson} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

export async function POST(request:Request){
 try{
  assertTrustedMutation(request);const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});await enforceRateLimit(request,{scope:'valorant-queue',limit:30,windowSeconds:600,subject:user.id});
  const squad=await userSquad(user.id);if(!squad)return noStoreJson({error:'Crie um squad 5v5 primeiro.'},{status:409});if(squad.captain_id!==user.id)return noStoreJson({error:'Somente o capitão pode iniciar a fila.'},{status:403});if(squad.members.length!==5)return noStoreJson({error:'O squad precisa ter exatamente 5 jogadores.'},{status:409});if(squad.members.some(member=>member.profile?.status!=='online'))return noStoreJson({error:'Todos os jogadores precisam estar online.'},{status:409});
  const average=await squadAverageGr(squad.id),admin=createAdminClient();const {data,error}=await admin.rpc('valorant_enqueue_and_match',{p_squad_id:squad.id,p_captain_id:user.id,p_region:squad.region,p_average_gr:average});if(error)throw error;
  return noStoreJson({queued:!data,matchId:data??null,averageGr:average});
 }catch(error){if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);return noStoreJson({error:'Não foi possível entrar na fila.'},{status:500});}
}

export async function DELETE(request:Request){
 try{
  assertTrustedMutation(request);
  const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
  await enforceRateLimit(request,{scope:'valorant-queue-leave',limit:30,windowSeconds:600,subject:user.id});
  const squad=await userSquad(user.id);if(!squad||squad.captain_id!==user.id)return noStoreJson({error:'Sem permissão.'},{status:403});
  const admin=createAdminClient();const {error}=await admin.from('valorant_queue_entries').delete().eq('squad_id',squad.id);if(error)throw error;
  return noStoreJson({ok:true});
 }catch(error){
  if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});
  if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
  return noStoreJson({error:'Não foi possível sair da fila.'},{status:500});
 }
}

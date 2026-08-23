import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

const schema=z.object({scoreA:z.number().int().min(0).max(99),scoreB:z.number().int().min(0).max(99)}).strict().refine(v=>v.scoreA!==v.scoreB,{message:'Empate não é permitido.'});

async function closeFinishedMatchRooms(admin:ReturnType<typeof createAdminClient>,matchId:string){
  const {data:rooms,error}=await admin.from('match_team_rooms').select('id,lobby_id').eq('match_id',matchId);
  if(error)throw error;
  const lobbyIds=(rooms??[]).map(room=>room.lobby_id).filter(Boolean);
  if(rooms?.length){const {error:roomError}=await admin.from('match_team_rooms').update({status:'CLOSED',expires_at:new Date().toISOString()}).eq('match_id',matchId);if(roomError)throw roomError;}
  if(lobbyIds.length){
    const {error:lobbyError}=await admin.from('lobbies').update({status:'closed',updated_at:new Date().toISOString()}).in('id',lobbyIds);if(lobbyError)throw lobbyError;
    const {error:memberError}=await admin.from('lobby_members').delete().in('lobby_id',lobbyIds);if(memberError)throw memberError;
  }
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'valorant-result',limit:20,windowSeconds:300,subject:user.id});
    const {id}=await params,body=schema.parse(await readJsonBody(request)),admin=createAdminClient();
    const {data,error}=await admin.rpc('submit_valorant_result_atomic',{p_match_id:id,p_captain_id:user.id,p_score_a:body.scoreA,p_score_b:body.scoreB});
    if(error)throw error;
    const result=data as {result?:string;state?:string;waitingForOpponent?:boolean}|null;
    if(result?.result==='not_found')return noStoreJson({error:'Partida não encontrada.'},{status:404});
    if(result?.result==='forbidden')return noStoreJson({error:'Somente capitães podem enviar resultado.'},{status:403});
    if(result?.result==='invalid_score')return noStoreJson({error:'Resultado inválido.'},{status:400});
    if(result?.result==='invalid_state')return noStoreJson({error:'Resultado não pode ser enviado neste estado.',state:result.state},{status:409});
    if(result?.result!=='ok')throw new Error('unexpected_result_submission');
    if(result.state==='FINISHED')await closeFinishedMatchRooms(admin,id);
    return noStoreJson({state:result.state,waitingForOpponent:Boolean(result.waitingForOpponent)});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:error instanceof z.ZodError?(error.issues[0]?.message||'Resultado inválido.'):error.message},{status:400});
    return noStoreJson({error:'Não foi possível registrar o resultado.'},{status:500});
  }
}

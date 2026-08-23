import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {activeValorantSeason,ensurePlayerRatings,userSquad} from '@/lib/competitive/valorant';
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

const schema=z.object({name:z.string().trim().min(2).max(40),region:z.string().trim().min(2).max(30).default('BR-SAO'),members:z.array(z.string().trim().min(3).max(80)).length(4)}).strict();

export async function GET(request:Request){
 try{
  const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
  await enforceRateLimit(request,{scope:'valorant-squad-read',limit:180,windowSeconds:600,subject:user.id});
  return noStoreJson({squad:await userSquad(user.id)});
 }catch(error){if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);return noStoreJson({error:'Não foi possível carregar o squad.'},{status:500});}
}

export async function POST(request:Request){
 try{
  assertTrustedMutation(request);const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
  await enforceRateLimit(request,{scope:'valorant-squad-create',limit:10,windowSeconds:3600,subject:user.id});
  if(await userSquad(user.id))return noStoreJson({error:'Você já pertence a um squad competitivo.'},{status:409});
  const body=schema.parse(await readJsonBody(request));const admin=createAdminClient();
  const handles=[...new Set(body.members.map(value=>value.replace(/^@/,'').toLowerCase()))];if(handles.length!==4)return noStoreJson({error:'Informe quatro jogadores diferentes.'},{status:400});
  const profileResults=await Promise.all(handles.map(handle=>admin.from('profiles').select('id,username,display_name,status').ilike('username',handle).limit(1).maybeSingle()));
  const failed=profileResults.find(result=>result.error);if(failed?.error)throw failed.error;
  const resolved=profileResults.map(result=>result.data).filter(Boolean) as Array<{id:string;username:string;display_name:string;status:string}>;
  if(resolved.length!==4)return noStoreJson({error:'Um ou mais usernames não foram encontrados.'},{status:400});
  if(resolved.some(p=>p.id===user.id))return noStoreJson({error:'Não inclua seu próprio username na lista.'},{status:400});
  if(resolved.some(p=>p.status!=='online'))return noStoreJson({error:'Todos os cinco jogadores precisam estar online.'},{status:409});
  const memberIds=[user.id,...resolved.map(p=>p.id)];
  const {data:existing,error:existingError}=await admin.from('valorant_squad_members').select('user_id').in('user_id',memberIds);if(existingError)throw existingError;if((existing??[]).length)return noStoreJson({error:'Um dos jogadores já pertence a outro squad.'},{status:409});
  const {data:squad,error:squadError}=await admin.from('valorant_squads').insert({name:body.name,captain_id:user.id,region:body.region}).select('id,name,captain_id,region').single();if(squadError)throw squadError;
  try{
    const {error:memberError}=await admin.from('valorant_squad_members').insert(memberIds.map(user_id=>({squad_id:squad.id,user_id})));if(memberError)throw memberError;
    const season=await activeValorantSeason();await ensurePlayerRatings(memberIds);
    if(season){const {error:ratingError}=await admin.from('valorant_squad_ratings').upsert({squad_id:squad.id,season_id:season.id,rating:1000,peak_rating:1000,placements_played:0,wins:0,losses:0},{onConflict:'squad_id,season_id',ignoreDuplicates:true});if(ratingError)throw ratingError;}
  }catch(error){
    const {error:rollbackError}=await admin.from('valorant_squads').delete().eq('id',squad.id);
    if(rollbackError)throw new Error('valorant_squad_rollback_failed',{cause:error});
    throw error;
  }
  return noStoreJson({squad:await userSquad(user.id)},{status:201});
 }catch(error){
  if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
  if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});
  if(error instanceof z.ZodError)return noStoreJson({error:error.issues[0]?.message||'Dados inválidos.'},{status:400});
  return noStoreJson({error:'Não foi possível criar o squad.'},{status:500});
 }
}

import {z} from "zod";
import {getCurrentUser} from "@/lib/auth";
import {AGE_BANDS} from "@/lib/age-assurance-types";
import {ageVerificationProvider,getAgeAssurance,getAgeCapabilities} from "@/lib/age-assurance";
import {createAdminClient} from "@/lib/supabase/admin";
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";
import {logSecurityEvent} from "@/lib/security/logging";

const schema=z.object({ageBand:z.enum(AGE_BANDS)}).strict();

export async function GET(){
  const user=await getCurrentUser();
  if(!user)return noStoreJson({error:"Não autorizado."},{status:401});
  const assurance=await getAgeAssurance(user.id);
  return noStoreJson({assurance,capabilities:getAgeCapabilities(assurance)});
}

export async function POST(request:Request){
  let actorId:string|null=null;
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser();
    if(!user)return noStoreJson({error:"Não autorizado."},{status:401});
    actorId=user.id;
    await enforceRateLimit(request,{scope:"age-assurance",limit:8,windowSeconds:3600,subject:user.id});
    const {ageBand}=schema.parse(await readJsonBody(request,2048));
    const decision=await ageVerificationProvider.begin({userId:user.id,ageBand});
    const admin=createAdminClient();
    const {error}=await admin.from("age_assurance").upsert({
      user_id:user.id,
      age_band:ageBand,
      age_assurance_status:decision.status,
      age_verified_at:decision.verifiedAt,
      age_verification_method:decision.method,
      age_verification_expires_at:decision.expiresAt,
      guardian_link_status:decision.guardianLinkStatus,
      guardian_verified_at:null,
      updated_at:new Date().toISOString(),
    },{onConflict:"user_id"});
    if(error)throw new Error("age_assurance_write_failed");
    const assurance=await getAgeAssurance(user.id);
    logSecurityEvent({event:"age_assurance_started",outcome:"allowed",actorId:user.id,route:"/api/me/age-assurance"});
    return noStoreJson({assurance,capabilities:getAgeCapabilities(assurance)});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:"Selecione uma faixa etária válida."},{status:400});
    logSecurityEvent({event:"age_assurance_started",outcome:"failed",actorId,reason:"write_failed",route:"/api/me/age-assurance"});
    return noStoreJson({error:"Não foi possível iniciar a aferição etária."},{status:500});
  }
}

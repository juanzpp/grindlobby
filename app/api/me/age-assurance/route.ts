import {z} from "zod";
import {getCurrentUser} from "@/lib/auth";
import {ageBandPostSchema} from "@/lib/age-band-validation";
import {beginAgeVerification,getAgeAssurance,getAgeCapabilities,requestAgeVerificationReview} from "@/lib/age-assurance";
import type {AgeVerificationDecision} from "@/lib/age-verification-provider";
import {createAdminClient} from "@/lib/supabase/admin";
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";
import {logSecurityEvent} from "@/lib/security/logging";

const reviewSchema=z.object({action:z.literal("request_review")}).strict();

async function persistDecision(userId:string,decision:AgeVerificationDecision){
  const admin=createAdminClient();
  const {error}=await admin.from("age_assurance").upsert({
    user_id:userId,
    age_band:decision.ageBand,
    age_assurance_status:decision.status,
    age_verified_at:decision.verifiedAt,
    age_verification_method:decision.method,
    age_verification_expires_at:decision.expiresAt,
    updated_at:new Date().toISOString(),
  },{onConflict:"user_id"});
  if(error)throw new Error("age_assurance_write_failed");
}

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
    const {ageBand}=ageBandPostSchema.parse(await readJsonBody(request,2048));
    const current=await getAgeAssurance(user.id);
    if(current.ageBand||current.status!=="not_started"){
      return noStoreJson({error:"A faixa existente deve ser alterada pelo fluxo de revisão."},{status:409});
    }
    const decision=await beginAgeVerification(user.id,ageBand);
    await persistDecision(user.id,decision);
    const assurance=await getAgeAssurance(user.id);
    logSecurityEvent({event:"age_assurance_started",outcome:"allowed",actorId:user.id,route:"/api/me/age-assurance"});
    return noStoreJson({assurance,capabilities:getAgeCapabilities(assurance)});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError)return noStoreJson({error:"Selecione uma faixa etária válida."},{status:400});
    if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});
    logSecurityEvent({event:"age_assurance_started",outcome:"failed",actorId,reason:"write_failed",route:"/api/me/age-assurance"});
    return noStoreJson({error:"Não foi possível iniciar a aferição etária."},{status:500});
  }
}

export async function PATCH(request:Request){
  let actorId:string|null=null;
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser();
    if(!user)return noStoreJson({error:"Não autorizado."},{status:401});
    actorId=user.id;
    await enforceRateLimit(request,{scope:"age-assurance-review",limit:3,windowSeconds:86400,subject:user.id});
    reviewSchema.parse(await readJsonBody(request,1024));
    const current=await getAgeAssurance(user.id);
    if(!current.ageBand)return noStoreJson({error:"Conclua a etapa inicial antes de solicitar revisão."},{status:409});
    if(current.status!=="review_requested"){
      const decision=await requestAgeVerificationReview(user.id,current.ageBand);
      await persistDecision(user.id,decision);
      logSecurityEvent({event:"age_assurance_review_requested",outcome:"allowed",actorId:user.id,route:"/api/me/age-assurance"});
    }
    const assurance=await getAgeAssurance(user.id);
    return noStoreJson({assurance,capabilities:getAgeCapabilities(assurance)});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:"Solicitação de revisão inválida."},{status:400});
    logSecurityEvent({event:"age_assurance_review_requested",outcome:"failed",actorId,reason:"write_failed",route:"/api/me/age-assurance"});
    return noStoreJson({error:"Não foi possível solicitar a revisão agora."},{status:500});
  }
}

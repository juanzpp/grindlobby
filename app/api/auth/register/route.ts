import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {requireEmailConfirmation} from "@/lib/auth-config";
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";
import {logSecurityEvent} from "@/lib/security/logging";

const schema=z.object({
  username:z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_]+$/),
  email:z.string().trim().email().max(160),
  password:z.string().min(10).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
  displayName:z.string().trim().min(2).max(40),
  termsAccepted:z.literal(true),
  privacyAccepted:z.literal(true),
}).strict();

export async function POST(request:Request){
  let actorId:string|null=null;
  try{
    assertTrustedMutation(request);
    await enforceRateLimit(request,{scope:"register-ip",limit:8,windowSeconds:3600});
    const body=schema.parse(await readJsonBody(request,8192));
    await enforceRateLimit(request,{scope:"register-identity",limit:4,windowSeconds:3600,subject:`${body.username}|${body.email}`});
    const admin=createAdminClient();
    const {data:existingUsername}=await admin.from("profiles").select("id").ilike("username",body.username).maybeSingle();
    if(existingUsername)return noStoreJson({error:"Não foi possível criar a conta com esses dados."},{status:409});
    const supabase=await createClient();
    const origin=new URL(request.url).origin;
    const {data,error}=await supabase.auth.signUp({
      email:body.email,
      password:body.password,
      options:{data:{username:body.username,display_name:body.displayName},emailRedirectTo:`${origin}/auth/callback?next=/login?status=confirmed`},
    });
    if(error)return noStoreJson({error:"Não foi possível criar a conta com esses dados."},{status:error.message.toLowerCase().includes("registered")?409:400});
    if(data.user){
      actorId=data.user.id;
      const acceptedAt=new Date().toISOString();
      const {error:consentError}=await admin.from("user_consents").upsert({
        user_id:data.user.id,
        terms_accepted_at:acceptedAt,
        privacy_accepted_at:acceptedAt,
        age_declaration_at:null,
        terms_version:"2026-08-01",
        privacy_version:"2026-08-01",
      },{onConflict:"user_id"});
      if(consentError)throw new Error("consent_write_failed");
      await admin.from("age_assurance").upsert({user_id:data.user.id,age_assurance_status:"not_started",guardian_link_status:"not_required"},{onConflict:"user_id"});
      if(data.session)await admin.from("profiles").update({status:"online"}).eq("id",data.user.id);
      logSecurityEvent({event:"register",outcome:"allowed",actorId:data.user.id,route:"/api/auth/register"});
    }
    return noStoreJson({ok:true,requiresEmailVerification:!data.session,confirmationPolicyEnabled:requireEmailConfirmation()});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:"Revise os campos, os consentimentos e use uma senha forte."},{status:400});
    logSecurityEvent({event:"register",outcome:"failed",actorId,reason:"internal_error",route:"/api/auth/register"});
    return noStoreJson({error:"Não foi possível criar a conta."},{status:500});
  }
}

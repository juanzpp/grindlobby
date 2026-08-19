import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {requireEmailConfirmation} from "@/lib/auth-config";
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";
import {logSecurityEvent} from "@/lib/security/logging";

const schema=z.object({
  identifier:z.string().trim().min(3).max(160).superRefine((value,context)=>{
    if(value.includes("@")){
      if(!z.string().email().safeParse(value).success)context.addIssue({code:z.ZodIssueCode.custom,message:"invalid_identifier"});
    }else if(!/^[A-Za-z0-9_]{3,24}$/.test(value))context.addIssue({code:z.ZodIssueCode.custom,message:"invalid_identifier"});
  }),
  password:z.string().min(1).max(128),
  remember:z.boolean().default(true),
}).strict();

export async function POST(request:Request){
  let actorId:string|null=null;
  try{
    assertTrustedMutation(request);
    await enforceRateLimit(request,{scope:"login-ip",limit:30,windowSeconds:900});
    const body=schema.parse(await readJsonBody(request,4096));
    await enforceRateLimit(request,{scope:"login-identity",limit:10,windowSeconds:900,subject:body.identifier});
    let email=body.identifier;
    if(!email.includes("@")){
      const admin=createAdminClient();
      const {data:profile}=await admin.from("profiles").select("email").ilike("username",email).maybeSingle();
      if(!profile?.email){
        logSecurityEvent({event:"login",outcome:"blocked",reason:"invalid_credentials",route:"/api/auth/login"});
        return noStoreJson({error:"Credenciais inválidas."},{status:401});
      }
      email=profile.email;
    }
    const supabase=await createClient({persistent:body.remember});
    const {data,error}=await supabase.auth.signInWithPassword({email,password:body.password});
    if(error||!data.user){
      if(requireEmailConfirmation()&&error?.message.toLowerCase().includes("email not confirmed"))return noStoreJson({error:"Confirme seu e-mail antes de entrar.",code:"email_unconfirmed"},{status:403});
      if(!requireEmailConfirmation()&&error?.message.toLowerCase().includes("email not confirmed"))return noStoreJson({error:"A confirmação ainda está ativa no provedor de autenticação.",code:"provider_confirmation_enabled"},{status:409});
      if(/banned|disabled|blocked/i.test(error?.message??""))return noStoreJson({error:"Esta conta está temporariamente bloqueada.",code:"account_blocked"},{status:403});
      logSecurityEvent({event:"login",outcome:"blocked",reason:"invalid_credentials",route:"/api/auth/login"});
      return noStoreJson({error:"Credenciais inválidas."},{status:401});
    }
    actorId=data.user.id;
    if(requireEmailConfirmation()&&!data.user.email_confirmed_at){
      await supabase.auth.signOut();
      return noStoreJson({error:"Confirme seu e-mail antes de entrar.",code:"email_unconfirmed"},{status:403});
    }
    const admin=createAdminClient();
    await admin.from("profiles").update({status:"online",last_seen_at:new Date().toISOString()}).eq("id",data.user.id);
    logSecurityEvent({event:"login",outcome:"allowed",actorId:data.user.id,route:"/api/auth/login"});
    return noStoreJson({ok:true});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:"Dados inválidos."},{status:400});
    logSecurityEvent({event:"login",outcome:"failed",actorId,reason:"internal_error",route:"/api/auth/login"});
    return noStoreJson({error:"Não foi possível entrar."},{status:500});
  }
}

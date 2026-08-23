import {getCurrentUser} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {assertTrustedMutation,InvalidRequestError,noStoreJson} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";

const STALE_AFTER_MS=75_000;

export async function POST(request:Request){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);
    if(!user)return noStoreJson({error:"Não autorizado."},{status:401});
    await enforceRateLimit(request,{scope:"session-presence",limit:12,windowSeconds:60,subject:user.id});

    const admin=createAdminClient();
    const now=new Date();
    const cutoff=new Date(now.getTime()-STALE_AFTER_MS).toISOString();

    const {error:updateError}=await admin.from("profiles")
      .update({status:"online",last_seen_at:now.toISOString()})
      .eq("id",user.id);
    if(updateError)throw new Error("presence_update_failed");

    // Best-effort cleanup prevents crashed clients from remaining online forever.
    await admin.from("profiles")
      .update({status:"offline"})
      .eq("status","online")
      .lt("last_seen_at",cutoff)
      .neq("id",user.id);

    return noStoreJson({ok:true,expiresInSeconds:Math.floor(STALE_AFTER_MS/1000)});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof InvalidRequestError)return noStoreJson({error:"Requisição inválida."},{status:400});
    return noStoreJson({error:"Não foi possível atualizar presença."},{status:500});
  }
}

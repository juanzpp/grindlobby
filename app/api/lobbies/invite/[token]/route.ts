import {z} from "zod";
import {getCurrentUser} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {assertTrustedMutation,InvalidRequestError,noStoreJson} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";
import {lobbyInviteHash} from "@/lib/lobby-invites";

const tokenSchema=z.string().min(20).max(128).regex(/^[A-Za-z0-9_-]+$/);

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:"Faça login para aceitar o convite."},{status:401});
    await enforceRateLimit(request,{scope:"redeem-lobby-invite",limit:30,windowSeconds:300,subject:user.id});
    const token=tokenSchema.parse((await params).token),admin=createAdminClient();
    const {data,error}=await admin.rpc("redeem_lobby_invite",{p_token_hash:lobbyInviteHash(token),p_user_id:user.id});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data as {result?:string;lobby_id?:string}|null;
    if(!row||row.result==="invalid"||row.result==="exhausted")return noStoreJson({error:"Este convite expirou ou atingiu o limite de usos."},{status:410});
    if(row.result==="full")return noStoreJson({error:"Lobby cheio."},{status:409});
    if(row.result!=="joined"||!row.lobby_id)return noStoreJson({error:"Lobby indisponível."},{status:404});
    return noStoreJson({ok:true,lobbyId:row.lobby_id});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:"Convite inválido."},{status:400});
    return noStoreJson({error:"Não foi possível aceitar o convite."},{status:500});
  }
}

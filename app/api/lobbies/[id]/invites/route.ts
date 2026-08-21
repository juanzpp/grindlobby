import {z} from "zod";
import {getCurrentUser} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";
import {createLobbyInviteToken,lobbyInviteHash} from "@/lib/lobby-invites";

const idSchema=z.string().uuid();
const bodySchema=z.object({maxUses:z.coerce.number().int().min(1).max(100).optional().default(25),hours:z.coerce.number().int().min(1).max(168).optional().default(24)}).strict();

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser();if(!user)return noStoreJson({error:"Não autorizado."},{status:401});
    await enforceRateLimit(request,{scope:"create-lobby-invite",limit:20,windowSeconds:3600,subject:user.id});
    const id=idSchema.parse((await params).id),body=bodySchema.parse(await readJsonBody(request,2048).catch(()=>({}))),admin=createAdminClient();
    const {data:lobby}=await admin.from("lobbies").select("id,owner_id,status").eq("id",id).maybeSingle();
    if(!lobby||lobby.status!=="open"||lobby.owner_id!==user.id)return noStoreJson({error:"Lobby não encontrado."},{status:404});
    const token=createLobbyInviteToken(),expiresAt=new Date(Date.now()+body.hours*3600000).toISOString();
    const {error}=await admin.from("lobby_invites").insert({lobby_id:id,token_hash:lobbyInviteHash(token),created_by:user.id,max_uses:body.maxUses,expires_at:expiresAt});
    if(error)throw error;
    return noStoreJson({token,path:`/lobby/invite/${token}`,expiresAt,maxUses:body.maxUses},{status:201});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:"Requisição inválida."},{status:400});
    return noStoreJson({error:"Não foi possível criar o convite."},{status:500});
  }
}

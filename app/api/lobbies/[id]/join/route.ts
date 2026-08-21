import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {assertTrustedMutation,InvalidRequestError,noStoreJson} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";
import {logSecurityEvent} from "@/lib/security/logging";

const idSchema=z.string().uuid();

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  let actorId:string|null=null;
  try{
    assertTrustedMutation(request);
    const id=idSchema.parse((await params).id),supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
    if(!user)return noStoreJson({error:"Não autorizado."},{status:401});
    actorId=user.id;
    await enforceRateLimit(request,{scope:"join-lobby",limit:20,windowSeconds:300,subject:user.id});
    const admin=createAdminClient();
    const cutoff=new Date(Date.now()-30000).toISOString();
    const [{data:lobby},{data:existing}]=await Promise.all([
      admin.from("lobbies").select("id,owner_id,max_members,status,visibility").eq("id",id).maybeSingle(),
      admin.from("lobby_members").select("role,last_seen_at").eq("lobby_id",id).eq("user_id",user.id).gt("last_seen_at",cutoff).maybeSingle(),
    ]);
    if(!lobby||lobby.status!=="open")return noStoreJson({error:"Lobby indisponível."},{status:404});
    if(lobby.visibility!=="public"&&lobby.owner_id!==user.id&&!existing)return noStoreJson({error:"Convite necessário para entrar neste lobby."},{status:403});
    const {data:joinResult,error}=await admin.rpc("join_lobby_member",{p_lobby_id:id,p_user_id:user.id});
    if(error)throw new Error("join_rpc_failed");
    if(joinResult==="full")return noStoreJson({error:"Lobby cheio."},{status:409});
    if(joinResult!=="joined")return noStoreJson({error:"Lobby indisponível."},{status:404});
    logSecurityEvent({event:"lobby_join",outcome:"allowed",actorId:user.id,route:"/api/lobbies/[id]/join"});
    return noStoreJson({ok:true,lobbyId:id});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:"Requisição inválida."},{status:400});
    logSecurityEvent({event:"lobby_join",outcome:"failed",actorId,reason:"write_failed",route:"/api/lobbies/[id]/join"});
    return noStoreJson({error:"Não foi possível entrar."},{status:500});
  }
}

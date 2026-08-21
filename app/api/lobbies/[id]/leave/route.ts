import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {assertTrustedMutation,InvalidRequestError,noStoreJson} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";
import {logSecurityEvent} from "@/lib/security/logging";

const idSchema=z.string().uuid();

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    assertTrustedMutation(request);
    const id=idSchema.parse((await params).id);
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return noStoreJson({error:"Não autorizado."},{status:401});

    await enforceRateLimit(request,{scope:"leave-lobby",limit:30,windowSeconds:300,subject:user.id});
    const admin=createAdminClient();
    const {data:lobby,error:lobbyError}=await admin.from("lobbies").select("owner_id").eq("id",id).maybeSingle();
    if(lobbyError)throw new Error("lobby_lookup_failed");
    if(!lobby)return noStoreJson({error:"Lobby não encontrado."},{status:404});

    if(lobby.owner_id===user.id){
      const {error}=await admin.from("lobbies").delete().eq("id",id).eq("owner_id",user.id);
      if(error)throw new Error("owner_leave_failed");
      logSecurityEvent({event:"lobby_leave",outcome:"allowed",actorId:user.id,reason:"owner_closed_lobby",route:"/api/lobbies/[id]/leave"});
      return noStoreJson({ok:true,closed:true});
    }

    const {data,error}=await admin.from("lobby_members")
      .delete()
      .eq("lobby_id",id)
      .eq("user_id",user.id)
      .select("user_id")
      .maybeSingle();
    if(error)throw new Error("leave_failed");
    if(!data)return noStoreJson({error:"Participação não encontrada."},{status:404});

    logSecurityEvent({event:"lobby_leave",outcome:"allowed",actorId:user.id,route:"/api/lobbies/[id]/leave"});
    return noStoreJson({ok:true,closed:false});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:"Requisição inválida."},{status:400});
    return noStoreJson({error:"Não foi possível sair."},{status:500});
  }
}

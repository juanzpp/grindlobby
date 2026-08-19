import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {getAgeAssurance,getAgeCapabilities} from "@/lib/age-assurance";
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";
import {logSecurityEvent} from "@/lib/security/logging";

const createSchema=z.object({
  name:z.string().trim().min(2).max(80),
  gameId:z.coerce.number().int().positive(),
  description:z.string().trim().max(240).optional().default(""),
  visibility:z.enum(["public","private","friends"]).default("public"),
  maxMembers:z.coerce.number().int().min(2).max(100),
}).strict();

export async function POST(request:Request){
  let actorId:string|null=null;
  try{
    assertTrustedMutation(request);
    const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
    if(!user)return noStoreJson({error:"Não autorizado."},{status:401});
    actorId=user.id;
    await enforceRateLimit(request,{scope:"create-lobby",limit:8,windowSeconds:3600,subject:user.id});
    const age=getAgeCapabilities(await getAgeAssurance(user.id));
    if(!age.canJoinLobbies)return noStoreJson({error:age.reason||"Recurso indisponível."},{status:403});
    const body=createSchema.parse(await readJsonBody(request,8192)),admin=createAdminClient();
    const {data:game}=await admin.from("games").select("id").eq("id",body.gameId).maybeSingle();
    if(!game)return noStoreJson({error:"Jogo inválido."},{status:400});
    const {data:lobby,error}=await admin.from("lobbies").insert({owner_id:user.id,game_id:body.gameId,name:body.name,description:body.description,visibility:body.visibility,max_members:body.maxMembers,status:"open"}).select("id").single();
    if(error||!lobby)throw new Error("lobby_create_failed");
    const {error:memberError}=await admin.from("lobby_members").insert({lobby_id:lobby.id,user_id:user.id,role:"owner"});
    if(memberError){await admin.from("lobbies").delete().eq("id",lobby.id);throw new Error("membership_create_failed")}
    logSecurityEvent({event:"lobby_create",outcome:"allowed",actorId:user.id,route:"/api/lobbies"});
    return noStoreJson({ok:true,lobbyId:lobby.id},{status:201});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:"Confira nome, jogo e número de vagas."},{status:400});
    logSecurityEvent({event:"lobby_create",outcome:"failed",actorId,reason:"write_failed",route:"/api/lobbies"});
    return noStoreJson({error:"Não foi possível criar o lobby."},{status:500});
  }
}

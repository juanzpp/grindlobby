import {z} from "zod";
import {getCurrentUser} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {assertTrustedMutation,InvalidRequestError,noStoreJson,readJsonBody} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";
import {lobbyInviteHash} from "@/lib/lobby-invites";

const createSchema=z.object({
  name:z.string().trim().min(2).max(80),
  gameId:z.coerce.number().int().positive(),
  description:z.string().trim().max(240).optional().default(""),
  visibility:z.enum(["public","private","friends"]).default("public"),
  maxMembers:z.coerce.number().int().min(2).max(100),
}).strict();

type LobbyCreateStage="request"|"authentication"|"rate_limit"|"payload_validation"|"game_lookup"|"lobby_insert"|"host_insert"|"invite_insert"|"rollback"|"complete";

class LobbyCreateError extends Error{
  code:string;
  constructor(code:string){super("Lobby creation failed");this.name="LobbyCreateError";this.code=code;}
}

function safeErrorCode(value:unknown,fallback:string){
  const code=typeof value==="object"&&value!==null&&"code" in value&&typeof value.code==="string"?value.code:"";
  return /^[a-zA-Z0-9_.:-]{1,64}$/.test(code)?code:fallback;
}

function logLobbyCreate(input:{authenticated:boolean;userId:string|null;stage:LobbyCreateStage;outcome:"allowed"|"blocked"|"failed";code:string}){
  console.info("[GrindLobby Lobby Create]",{...input,at:new Date().toISOString()});
}

export async function POST(request:Request){
  let userId:string|null=null,stage:LobbyCreateStage="request";
  try{
    assertTrustedMutation(request);
    stage="authentication";
    const user=await getCurrentUser(request);
    if(!user){
      logLobbyCreate({authenticated:false,userId:null,stage,outcome:"blocked",code:"unauthenticated"});
      return noStoreJson({error:"Não autorizado."},{status:401});
    }
    userId=user.id;
    logLobbyCreate({authenticated:true,userId,stage,outcome:"allowed",code:"authenticated"});
    stage="rate_limit";
    await enforceRateLimit(request,{scope:"create-lobby",limit:8,windowSeconds:3600,subject:user.id});
    stage="payload_validation";
    const body=createSchema.parse(await readJsonBody(request,8192)),admin=createAdminClient();
    stage="game_lookup";
    const {data:game,error:gameError}=await admin.from("games").select("id").eq("id",body.gameId).maybeSingle();
    if(gameError)throw new LobbyCreateError(safeErrorCode(gameError,"game_lookup_failed"));
    if(!game){logLobbyCreate({authenticated:true,userId,stage,outcome:"blocked",code:"invalid_game"});return noStoreJson({error:"Jogo inválido."},{status:400});}
    stage="lobby_insert";
    const {data:lobby,error}=await admin.from("lobbies").insert({owner_id:user.id,game_id:body.gameId,name:body.name,description:body.description,visibility:body.visibility,max_members:body.maxMembers,status:"open"}).select("id").single();
    if(error||!lobby)throw new LobbyCreateError(safeErrorCode(error,"lobby_create_failed"));
    stage="host_insert";
    const {error:memberError}=await admin.from("lobby_members").insert({lobby_id:lobby.id,user_id:user.id,role:"owner"});
    if(memberError){
      const memberCode=safeErrorCode(memberError,"membership_create_failed");stage="rollback";
      await admin.from("lobbies").delete().eq("id",lobby.id);stage="host_insert";throw new LobbyCreateError(memberCode);
    }
    if(body.visibility!=="public"){
      stage="invite_insert";
      const {error:inviteError}=await admin.from("lobby_invites").insert({lobby_id:lobby.id,token_hash:lobbyInviteHash(lobby.id),created_by:user.id,max_uses:100,expires_at:new Date(Date.now()+7*24*3600000).toISOString()});
      if(inviteError){
        stage="rollback";
        await admin.from("lobbies").delete().eq("id",lobby.id);
        throw new LobbyCreateError(safeErrorCode(inviteError,"invite_create_failed"));
      }
    }
    stage="complete";
    logLobbyCreate({authenticated:true,userId,stage,outcome:"allowed",code:"created"});
    return noStoreJson({ok:true,lobbyId:lobby.id},{status:201});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError){
      logLobbyCreate({authenticated:Boolean(userId),userId,stage,outcome:error instanceof RateLimitExceededError?"blocked":"failed",code:error instanceof RateLimitUnavailableError?error.code:"rate_limit_exceeded"});
      return rateLimitResponse(error);
    }
    if(error instanceof z.ZodError||error instanceof InvalidRequestError){
      logLobbyCreate({authenticated:Boolean(userId),userId,stage,outcome:"blocked",code:error instanceof z.ZodError?"invalid_payload":"invalid_request"});
      return noStoreJson({error:"Confira nome, jogo e número de vagas."},{status:400});
    }
    logLobbyCreate({authenticated:Boolean(userId),userId,stage,outcome:"failed",code:error instanceof LobbyCreateError?error.code:"unexpected_error"});
    return noStoreJson({error:"Não foi possível criar o lobby."},{status:500});
  }
}

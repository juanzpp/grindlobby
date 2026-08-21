import {z} from "zod";
import {AccessToken,TokenVerifier,TrackSource} from "livekit-server-sdk";
import {getCurrentUser} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {assertTrustedMutation,InvalidRequestError,noStoreJson} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";
import {logSecurityEvent} from "@/lib/security/logging";
import {isConfiguredAdmin} from "@/lib/admin-config";
import {getScreenSharePolicy} from "@/lib/livekit-screen-policy";

export const runtime="nodejs";

const idSchema=z.string().uuid();

function normalizeServerEnv(value:string|undefined){
  const trimmed=value?.trim();
  if(!trimmed)return "";
  const first=trimmed[0],last=trimmed.at(-1);
  return first===last&&(first==='"'||first==="'")?trimmed.slice(1,-1).trim():trimmed;
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  let actorId:string|null=null;
  try{
    assertTrustedMutation(request);
    const id=idSchema.parse((await params).id);
    const user=await getCurrentUser(request);
    if(!user)return noStoreJson({error:"Não autorizado."},{status:401});
    actorId=user.id;

    await enforceRateLimit(request,{scope:"livekit-token",limit:20,windowSeconds:600,subject:user.id});
    const admin=createAdminClient();
    const {data:member}=await admin.from("lobby_members")
      .select("user_id")
      .eq("lobby_id",id)
      .eq("user_id",user.id)
      .gt("last_seen_at",new Date(Date.now()-30_000).toISOString())
      .maybeSingle();
    if(!member)return noStoreJson({error:"Você não está presente neste lobby."},{status:403});

    const url=normalizeServerEnv(process.env.NEXT_PUBLIC_LIVEKIT_URL);
    const apiKey=normalizeServerEnv(process.env.LIVEKIT_API_KEY);
    const apiSecret=normalizeServerEnv(process.env.LIVEKIT_API_SECRET);
    if(!url||!apiKey||!apiSecret){
      logSecurityEvent({event:"livekit_token",outcome:"failed",actorId:user.id,reason:"server_configuration",route:"/api/lobbies/[id]/voice/token"});
      return noStoreJson({error:"LiveKit não configurado."},{status:503});
    }

    const {data:profile}=await admin.from("profiles").select("display_name,username,account_tier").eq("id",user.id).maybeSingle();
    const pro=isConfiguredAdmin(user.id)||profile?.account_tier==="pro";
    const screenShare=getScreenSharePolicy(pro);
    const room=`lobby-${id}`;
    const accessToken=new AccessToken(apiKey,apiSecret,{
      identity:user.id,
      name:profile?.display_name||profile?.username||"Player",
      ttl:"15m",
      attributes:{
        "grindlobby.tier":screenShare.tier,
        "grindlobby.screen.maxWidth":String(screenShare.maxWidth),
        "grindlobby.screen.maxHeight":String(screenShare.maxHeight),
        "grindlobby.screen.maxFps":String(screenShare.maxFps),
      },
    });
    accessToken.addGrant({
      roomJoin:true,
      room,
      canSubscribe:true,
      canPublishData:false,
      canUpdateOwnMetadata:false,
      canPublishSources:[TrackSource.MICROPHONE,TrackSource.SCREEN_SHARE,TrackSource.SCREEN_SHARE_AUDIO],
    });
    const jwt=await accessToken.toJwt();

    const verified=await new TokenVerifier(apiKey,apiSecret).verify(jwt);
    if(
      verified.sub!==user.id
      ||verified.video?.room!==room
      ||verified.video?.roomJoin!==true
      ||verified.attributes?.["grindlobby.tier"]!==screenShare.tier
    ){
      throw new Error("livekit_claim_validation_failed");
    }

    logSecurityEvent({event:"livekit_token",outcome:"allowed",actorId:user.id,route:"/api/lobbies/[id]/voice/token"});
    return noStoreJson({token:jwt,url});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    if(error instanceof z.ZodError||error instanceof InvalidRequestError)return noStoreJson({error:"Requisição inválida."},{status:400});
    logSecurityEvent({event:"livekit_token",outcome:"failed",actorId,reason:"token_issue_failed",route:"/api/lobbies/[id]/voice/token"});
    return noStoreJson({error:"Não foi possível iniciar a conexão de voz."},{status:500});
  }
}

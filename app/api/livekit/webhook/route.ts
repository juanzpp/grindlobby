import {RoomServiceClient,TrackSource,WebhookReceiver,type TrackInfo} from "livekit-server-sdk";
import {createAdminClient} from "@/lib/supabase/admin";
import {isConfiguredAdmin} from "@/lib/admin-config";
import {getScreenSharePolicy,isResolutionWithinPolicy} from "@/lib/livekit-screen-policy";
import {logSecurityEvent} from "@/lib/security/logging";

export const runtime="nodejs";

const MAX_WEBHOOK_BYTES=131_072;
const LOBBY_ROOM_PREFIX="lobby-";

function normalizeServerEnv(value:string|undefined){
  const trimmed=value?.trim();
  if(!trimmed)return "";
  const first=trimmed[0],last=trimmed.at(-1);
  return first===last&&(first==='"'||first==="'")?trimmed.slice(1,-1).trim():trimmed;
}

async function readWebhookBody(request:Request){
  const contentType=request.headers.get("content-type")?.split(";",1)[0].trim().toLowerCase();
  if(contentType!=="application/webhook+json"&&contentType!=="application/json")throw new Error("invalid_content_type");
  const declaredLength=Number(request.headers.get("content-length")??0);
  if(Number.isFinite(declaredLength)&&declaredLength>MAX_WEBHOOK_BYTES)throw new Error("webhook_too_large");
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>MAX_WEBHOOK_BYTES)throw new Error("webhook_too_large");
  return raw;
}

function trackDimensions(track:TrackInfo){
  const dimensions=[
    {width:track.width,height:track.height},
    ...track.layers.map(layer=>({width:layer.width,height:layer.height})),
    ...track.codecs.flatMap(codec=>codec.layers.map(layer=>({width:layer.width,height:layer.height}))),
  ].filter(({width,height})=>width>0&&height>0);
  return dimensions.reduce(
    (largest,current)=>current.width*current.height>largest.width*largest.height?current:largest,
    {width:0,height:0},
  );
}

function response(status=200){
  return Response.json({ok:status<400},{status,headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  const url=normalizeServerEnv(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const apiKey=normalizeServerEnv(process.env.LIVEKIT_API_KEY);
  const apiSecret=normalizeServerEnv(process.env.LIVEKIT_API_SECRET);
  if(!url||!apiKey||!apiSecret){
    logSecurityEvent({event:"livekit_webhook",outcome:"failed",reason:"server_configuration",route:"/api/livekit/webhook"});
    return response(503);
  }

  let event;
  try{
    const rawBody=await readWebhookBody(request);
    const authorization=request.headers.get("authorization")??request.headers.get("authorize")??undefined;
    event=await new WebhookReceiver(apiKey,apiSecret).receive(rawBody,authorization);
  }catch{
    logSecurityEvent({event:"livekit_webhook",outcome:"blocked",reason:"invalid_signature_or_payload",route:"/api/livekit/webhook"});
    return response(401);
  }

  if(event.event!=="track_published"||event.track?.source!==TrackSource.SCREEN_SHARE)return response();
  const room=event.room?.name;
  const identity=event.participant?.identity;
  const trackSid=event.track.sid;
  if(!room?.startsWith(LOBBY_ROOM_PREFIX)||!identity||!trackSid)return response();

  try{
    const admin=createAdminClient();
    const {data:profile,error}=await admin.from("profiles").select("account_tier").eq("id",identity).maybeSingle();
    if(error)throw error;
    const policy=getScreenSharePolicy(isConfiguredAdmin(identity)||profile?.account_tier==="pro");

    let dimensions=trackDimensions(event.track);
    if(dimensions.width===0||dimensions.height===0){
      const participant=await new RoomServiceClient(url,apiKey,apiSecret).getParticipant(room,identity);
      const currentTrack=participant.tracks.find(track=>track.sid===trackSid);
      if(currentTrack)dimensions=trackDimensions(currentTrack);
    }

    if(isResolutionWithinPolicy(dimensions.width,dimensions.height,policy)){
      logSecurityEvent({event:"screen_share_resolution",outcome:"allowed",actorId:identity,reason:`${policy.tier}:${dimensions.width}x${dimensions.height}`,route:"/api/livekit/webhook"});
      return response();
    }

    await new RoomServiceClient(url,apiKey,apiSecret).mutePublishedTrack(room,identity,trackSid,true);
    logSecurityEvent({event:"screen_share_resolution",outcome:"blocked",actorId:identity,reason:`${policy.tier}:${dimensions.width}x${dimensions.height}`,route:"/api/livekit/webhook"});
    return response();
  }catch{
    logSecurityEvent({event:"screen_share_resolution",outcome:"failed",actorId:identity,reason:"enforcement_failed",route:"/api/livekit/webhook"});
    return response(500);
  }
}

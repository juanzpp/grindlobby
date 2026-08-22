import {RoomServiceClient,TrackSource,WebhookReceiver,type TrackInfo} from "livekit-server-sdk";
import {createAdminClient} from "@/lib/supabase/admin";
import {isConfiguredAdmin} from "@/lib/admin-config";
import {getScreenSharePolicy,isBitrateWithinPolicy,isResolutionWithinPolicy} from "@/lib/livekit-screen-policy";
import {logSecurityEvent} from "@/lib/security/logging";

export const runtime="nodejs";

const MAX_WEBHOOK_BYTES=131_072;
const LOBBY_ROOM_PREFIX="lobby-";
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function trackMaxBitrate(track:TrackInfo){
  const values=[
    ...track.layers.map(layer=>Number((layer as {bitrate?:number}).bitrate)||0),
    ...track.codecs.flatMap(codec=>codec.layers.map(layer=>Number((layer as {bitrate?:number}).bitrate)||0)),
  ];
  return Math.max(0,...values);
}

function response(status=200){
  return Response.json({ok:status<400},{status,headers:{"Cache-Control":"no-store"}});
}

async function enforceLobbyMembership(room:string,identity:string,roomService:RoomServiceClient){
  if(!room.startsWith(LOBBY_ROOM_PREFIX))return true;
  const lobbyId=room.slice(LOBBY_ROOM_PREFIX.length);
  if(!UUID_RE.test(lobbyId))return false;
  const admin=createAdminClient();
  const [{data:lobby,error:lobbyError},{data:member,error:memberError}]=await Promise.all([
    admin.from("lobbies").select("id,owner_id,status").eq("id",lobbyId).maybeSingle(),
    admin.from("lobby_members").select("user_id").eq("lobby_id",lobbyId).eq("user_id",identity).maybeSingle(),
  ]);
  const authorized=!lobbyError&&!memberError&&Boolean(lobby)&&lobby?.status==="open"&&(lobby.owner_id===identity||Boolean(member));
  if(authorized)return true;
  await roomService.removeParticipant(room,identity,{revokeTokenTs:BigInt(Math.floor(Date.now()/1000))}).catch(()=>{});
  logSecurityEvent({event:"livekit_membership",outcome:"blocked",actorId:identity,reason:lobbyError||memberError?"membership_lookup_failed":"membership_revoked",route:"/api/livekit/webhook"});
  return false;
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

  const room=event.room?.name;
  const identity=event.participant?.identity;
  if(!room?.startsWith(LOBBY_ROOM_PREFIX)||!identity)return response();
  const roomService=new RoomServiceClient(url,apiKey,apiSecret);

  if(event.event==="participant_joined"){
    try{
      const authorized=await enforceLobbyMembership(room,identity,roomService);
      if(authorized)logSecurityEvent({event:"livekit_membership",outcome:"allowed",actorId:identity,route:"/api/livekit/webhook"});
      return response();
    }catch{
      await roomService.removeParticipant(room,identity,{revokeTokenTs:BigInt(Math.floor(Date.now()/1000))}).catch(()=>{});
      logSecurityEvent({event:"livekit_membership",outcome:"failed",actorId:identity,reason:"enforcement_failed",route:"/api/livekit/webhook"});
      return response();
    }
  }

  if(event.event!=="track_published")return response();
  try{
    if(!await enforceLobbyMembership(room,identity,roomService))return response();
  }catch{
    await roomService.removeParticipant(room,identity,{revokeTokenTs:BigInt(Math.floor(Date.now()/1000))}).catch(()=>{});
    logSecurityEvent({event:"livekit_membership",outcome:"failed",actorId:identity,reason:"publish_membership_enforcement_failed",route:"/api/livekit/webhook"});
    return response();
  }

  if(event.track?.source!==TrackSource.SCREEN_SHARE)return response();
  const trackSid=event.track.sid;
  if(!trackSid)return response();

  try{
    const admin=createAdminClient();
    const {data:profile,error}=await admin.from("profiles").select("account_tier").eq("id",identity).maybeSingle();
    if(error)throw error;
    const policy=getScreenSharePolicy(isConfiguredAdmin(identity)||profile?.account_tier==="pro");

    let inspectedTrack=event.track;
    let dimensions=trackDimensions(inspectedTrack);
    let bitrate=trackMaxBitrate(inspectedTrack);
    if(dimensions.width===0||dimensions.height===0||bitrate===0){
      const participant=await roomService.getParticipant(room,identity);
      const currentTrack=participant.tracks.find(track=>track.sid===trackSid);
      if(currentTrack){
        inspectedTrack=currentTrack;
        dimensions=trackDimensions(currentTrack);
        bitrate=trackMaxBitrate(currentTrack);
      }
    }

    const resolutionAllowed=isResolutionWithinPolicy(dimensions.width,dimensions.height,policy);
    const bitrateAllowed=isBitrateWithinPolicy(bitrate,policy);
    if(resolutionAllowed&&bitrateAllowed){
      logSecurityEvent({event:"screen_share_policy",outcome:"allowed",actorId:identity,reason:`${policy.tier}:${dimensions.width}x${dimensions.height}:${bitrate}`,route:"/api/livekit/webhook"});
      return response();
    }

    await roomService.mutePublishedTrack(room,identity,trackSid,true);
    const reason=!resolutionAllowed?`resolution:${dimensions.width}x${dimensions.height}`:`bitrate:${bitrate}`;
    logSecurityEvent({event:"screen_share_policy",outcome:"blocked",actorId:identity,reason:`${policy.tier}:${reason}`,route:"/api/livekit/webhook"});
    return response();
  }catch{
    logSecurityEvent({event:"screen_share_policy",outcome:"failed",actorId:identity,reason:"enforcement_failed",route:"/api/livekit/webhook"});
    return response(500);
  }
}

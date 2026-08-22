import {RoomServiceClient} from "livekit-server-sdk";

function normalizeServerEnv(value:string|undefined){
  const trimmed=value?.trim();
  if(!trimmed)return "";
  const first=trimmed[0],last=trimmed.at(-1);
  return first===last&&(first==='"'||first==="'")?trimmed.slice(1,-1).trim():trimmed;
}

function roomService(){
  const url=normalizeServerEnv(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const apiKey=normalizeServerEnv(process.env.LIVEKIT_API_KEY);
  const apiSecret=normalizeServerEnv(process.env.LIVEKIT_API_SECRET);
  if(!url||!apiKey||!apiSecret)return null;
  return new RoomServiceClient(url,apiKey,apiSecret);
}

export function liveKitLobbyRoomName(lobbyId:string){return `lobby-${lobbyId}`}

export async function disconnectLobbyParticipant(lobbyId:string,userId:string){
  const service=roomService();
  if(!service)return false;
  try{
    await service.removeParticipant(liveKitLobbyRoomName(lobbyId),userId,{revokeTokenTs:BigInt(Math.floor(Date.now()/1000))});
    return true;
  }catch{
    // Membership remains authoritative. A failed moderation call must not
    // resurrect access or make an explicit lobby leave fail transactionally.
    return false;
  }
}

export async function closeLiveKitLobbyRoom(lobbyId:string){
  const service=roomService();
  if(!service)return false;
  try{
    await service.deleteRoom(liveKitLobbyRoomName(lobbyId));
    return true;
  }catch{
    return false;
  }
}

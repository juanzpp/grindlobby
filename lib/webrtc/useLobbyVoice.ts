"use client";
import {useEffect,useState} from "react";
import {
 AudioPresets,ConnectionState,LocalAudioTrack,RemoteAudioTrack,Room,RoomEvent,Track,
 type RemoteParticipant,type RemoteTrack,type RemoteTrackPublication
} from "livekit-client";

export type VoiceMemberState={userId:string;connected:boolean;stream:RemoteAudioTrack|null;status:"Offline"|"Connecting"|"Connected"|"Reconnecting";speaking:boolean;audioLevel:number;microphoneMuted:boolean;volume:number;muted:boolean};
export type VoiceLobbyMember={userId:string;name:string;profileId:string|null;membershipId:string|null};
export type ActiveVoiceSession={lobbyId:string|null;room:Room|null;connected:boolean;participantCount:number;screenSharers:{userId:string;name:string}[]};
declare global{interface Window{__GRINDLOBBY_VOICE_DEBUG__?:boolean}}
const voiceDebug=process.env.NODE_ENV==="development"||process.env.NEXT_PUBLIC_VOICE_DEBUG==="true";
const log=(event:string,details:Record<string,unknown>={})=>{if(voiceDebug)console.debug(`[GrindLobby Voice] ${event}`,details)};
const logError=(event:string,details:Record<string,unknown>={})=>{if(voiceDebug)console.error(`[GrindLobby Voice] ${event}`,details)};

let activeRoom:Room|null=null;
let activeLobbyId:string|null=null;
let activeUserId:string|null=null;
let activeMembers:VoiceLobbyMember[]=[];
let activePresence=new Map<string,VoiceMemberState>();
let activeStream:MediaStream|null=null;
let connectGeneration=0;
let heartbeatTimer:number|undefined;
let pagehideBound=false;
const volumes=new Map<string,{volume:number;muted:boolean}>();
const roomListeners=new Set<(room:Room|null)=>void>();
const sessionListeners=new Set<(session:ActiveVoiceSession)=>void>();
const presenceListeners=new Set<(presence:Map<string,VoiceMemberState>)=>void>();

function screenSharers(room:Room|null){
 if(!room||room.state===ConnectionState.Disconnected)return[];
 const result:{userId:string;name:string}[]=[];
 if(room.localParticipant.getTrackPublication(Track.Source.ScreenShare))result.push({userId:room.localParticipant.identity,name:room.localParticipant.name||"Você"});
 for(const participant of room.remoteParticipants.values())if(participant.getTrackPublication(Track.Source.ScreenShare))result.push({userId:participant.identity,name:participant.name||"Player"});
 return result;
}
function sessionSnapshot():ActiveVoiceSession{return{lobbyId:activeLobbyId,room:activeRoom,connected:activeRoom?.state===ConnectionState.Connected,participantCount:activeRoom?.numParticipants??0,screenSharers:screenSharers(activeRoom)}}
function emitRoom(){for(const listener of roomListeners)listener(activeRoom)}
function emitSession(){const snapshot=sessionSnapshot();for(const listener of sessionListeners)listener(snapshot)}
function emitPresence(){const snapshot=new Map(activePresence);for(const listener of presenceListeners)listener(snapshot)}
function setActiveRoom(room:Room|null){activeRoom=room;emitRoom();emitSession()}
export function subscribeActiveLiveKitRoom(listener:(room:Room|null)=>void){roomListeners.add(listener);listener(activeRoom);return()=>{roomListeners.delete(listener)}}
export function subscribeVoiceSession(listener:(session:ActiveVoiceSession)=>void){sessionListeners.add(listener);listener(sessionSnapshot());return()=>{sessionListeners.delete(listener)}}
export function getActiveVoiceLobbyId(){return activeLobbyId}
export function getActiveMicrophoneStream(){
 const publication=activeRoom?.localParticipant.getTrackPublication(Track.Source.Microphone),track=publication?.track;
 return track instanceof LocalAudioTrack?new MediaStream([track.mediaStreamTrack]):activeStream;
}

function syncPresence(room=activeRoom){
 if(!room){activePresence=new Map();emitPresence();emitSession();return}
 const snapshot=new Map<string,VoiceMemberState>(),localIdentity=room.localParticipant.identity;
 for(const member of activeMembers){
  const userId=member.userId,isLocal=userId===localIdentity,participant=isLocal?room.localParticipant:room.remoteParticipants.get(userId);
  const connected=isLocal?room.state===ConnectionState.Connected:Boolean(participant),publication=participant?.getTrackPublication(Track.Source.Microphone);
  const stream=!isLocal&&publication?.track instanceof RemoteAudioTrack?publication.track:null,controls=volumes.get(userId)??{volume:100,muted:false};
  const status:VoiceMemberState["status"]=connected?"Connected":isLocal&&room.state===ConnectionState.Reconnecting?"Reconnecting":isLocal&&room.state===ConnectionState.Connecting?"Connecting":"Offline";
  snapshot.set(userId,{userId,connected,stream,status,speaking:connected?Boolean(participant?.isSpeaking):false,audioLevel:connected?participant?.audioLevel??0:0,microphoneMuted:connected?Boolean(publication?.isMuted):true,volume:controls.volume,muted:controls.muted});
 }
 activePresence=snapshot;emitPresence();emitSession();
}
function stopHeartbeat(){if(heartbeatTimer){window.clearInterval(heartbeatTimer);heartbeatTimer=undefined}}
function startHeartbeat(){
 stopHeartbeat();
 if(!activeLobbyId||typeof window==="undefined")return;
 const ping=()=>{if(activeLobbyId)fetch(`/api/lobbies/${activeLobbyId}/heartbeat`,{method:"POST",keepalive:true}).catch(()=>{})};
 void ping();heartbeatTimer=window.setInterval(ping,10_000);
 if(!pagehideBound){pagehideBound=true;window.addEventListener("pagehide",()=>{if(!activeLobbyId)return;const url=`/api/lobbies/${activeLobbyId}/leave`;navigator.sendBeacon?.(url,new Blob([],{type:"application/json"}))},{capture:true})}
}
function bindRoom(room:Room){
 const sync=()=>syncPresence(room);
 room.on(RoomEvent.Connected,()=>{startHeartbeat();sync()})
  .on(RoomEvent.ParticipantConnected,sync).on(RoomEvent.ParticipantDisconnected,sync)
  .on(RoomEvent.TrackSubscribed,sync).on(RoomEvent.TrackUnsubscribed,sync)
  .on(RoomEvent.TrackPublished,sync).on(RoomEvent.TrackUnpublished,sync)
  .on(RoomEvent.LocalTrackPublished,sync).on(RoomEvent.LocalTrackUnpublished,sync)
  .on(RoomEvent.TrackMuted,sync).on(RoomEvent.TrackUnmuted,sync)
  .on(RoomEvent.ActiveSpeakersChanged,sync).on(RoomEvent.Reconnecting,sync)
  .on(RoomEvent.Reconnected,sync).on(RoomEvent.ConnectionStateChanged,sync)
  .on(RoomEvent.Disconnected,()=>{stopHeartbeat();sync()});
}
async function publishOrReplaceMicrophone(room:Room,stream:MediaStream){
 const next=stream.getAudioTracks()[0];if(!next)return;
 activeStream=stream;
 const publication=room.localParticipant.getTrackPublication(Track.Source.Microphone),current=publication?.track;
 if(current instanceof LocalAudioTrack&&current.mediaStreamTrack===next)return;
 if(current)await room.localParticipant.unpublishTrack(current,false);
 await room.localParticipant.publishTrack(next,{source:Track.Source.Microphone,audioPreset:AudioPresets.speech,dtx:true,red:true,stopMicTrackOnMute:false});
}
async function ensureSession(lobbyId:string,userId:string,members:VoiceLobbyMember[],stream:MediaStream){
 activeMembers=members;
 if(activeRoom&&activeLobbyId===lobbyId&&activeRoom.state!==ConnectionState.Disconnected){await publishOrReplaceMicrophone(activeRoom,stream);syncPresence(activeRoom);return}
 await disconnectActiveLiveKitVoice(false);
 const generation=++connectGeneration,room=new Room({adaptiveStream:true,dynacast:true,disconnectOnPageLeave:true});
 activeLobbyId=lobbyId;activeUserId=userId;activeMembers=members;setActiveRoom(room);bindRoom(room);
 try{
  const response=await fetch(`/api/lobbies/${lobbyId}/voice/token`,{method:"POST",cache:"no-store"}),data=await response.json() as {token?:string;url?:string;error?:string};
  if(!response.ok||!data.token||!data.url)throw new Error(data.error||"Token LiveKit indisponível");
  if(generation!==connectGeneration)return;
  await room.connect(data.url,data.token,{autoSubscribe:true});if(generation!==connectGeneration)return;
  await publishOrReplaceMicrophone(room,stream);syncPresence(room);log("room-connected",{room:room.name,participantCount:room.numParticipants});
 }catch(error){logError("room-connect-failed",{error:String(error)});syncPresence(room)}
}
export async function disconnectActiveLiveKitVoice(stopTracks=true){
 connectGeneration+=1;stopHeartbeat();
 const room=activeRoom;setActiveRoom(null);activeLobbyId=null;activeUserId=null;activeMembers=[];activePresence=new Map();emitPresence();
 if(stopTracks)activeStream?.getTracks().forEach(track=>track.stop());activeStream=null;
 if(room){room.removeAllListeners();await room.disconnect()}
}
export async function setLiveKitMicrophoneMuted(muted:boolean){const publication=activeRoom?.localParticipant.getTrackPublication(Track.Source.Microphone);if(!publication)return;if(muted)await publication.mute();else await publication.unmute();syncPresence()}
export async function switchLiveKitMicrophoneDevice(deviceId:string){const publication=activeRoom?.localParticipant.getTrackPublication(Track.Source.Microphone),track=publication?.track;if(!(track instanceof LocalAudioTrack))return null;await track.setDeviceId(deviceId||"default");activeStream=new MediaStream([track.mediaStreamTrack]);return track.mediaStreamTrack}
export async function setLiveKitScreenShareEnabled(enabled:boolean){await activeRoom?.localParticipant.setScreenShareEnabled(enabled)}
export function getRemoteVoicePeerId(track:RemoteAudioTrack|null){return track?.sid}

export function useLobbyVoice(lobbyId:string,localUserId:string,lobbyMembers:VoiceLobbyMember[],localStream:MediaStream|null){
 const [voicePresence,setVoicePresence]=useState<Map<string,VoiceMemberState>>(()=>new Map(activePresence));
 activeMembers=lobbyMembers;
 useEffect(()=>{if(process.env.NEXT_PUBLIC_VOICE_DEBUG!=="true"||window.__GRINDLOBBY_VOICE_DEBUG__)return;window.__GRINDLOBBY_VOICE_DEBUG__=true;console.debug("[GrindLobby Voice] debug-enabled")},[]);
 useEffect(()=>{const listener=(value:Map<string,VoiceMemberState>)=>setVoicePresence(new Map(value));presenceListeners.add(listener);listener(activePresence);return()=>{presenceListeners.delete(listener)}},[]);
 useEffect(()=>{activeMembers=lobbyMembers;if(activeRoom&&activeLobbyId===lobbyId)syncPresence(activeRoom)},[lobbyMembers.map(member=>member.userId).join(","),lobbyId]);
 useEffect(()=>{if(!localStream)return;void ensureSession(lobbyId,localUserId,lobbyMembers,localStream)},[localStream,lobbyId,localUserId]);
 const voiceMembers=[...voicePresence.values()],remotePeers=voiceMembers.filter(member=>member.userId!==localUserId&&member.connected);
 function setPeerVolume(userId:string,volume:number){const current=volumes.get(userId)??{volume:100,muted:false};volumes.set(userId,{...current,volume});syncPresence()}
 function togglePeerMuted(userId:string){const current=volumes.get(userId)??{volume:100,muted:false};volumes.set(userId,{...current,muted:!current.muted});syncPresence()}
 function notifyVoiceLeave(){void disconnectActiveLiveKitVoice(true)}
 return{remotePeers,voiceMembers,setPeerVolume,togglePeerMuted,notifyVoiceLeave};
}

"use client";
import {useEffect,useState} from "react";
import {AudioPresets,ConnectionState,LocalAudioTrack,RemoteAudioTrack,Room,RoomEvent,Track} from "livekit-client";
import {MAX_MICROPHONE_GAIN_PERCENT,clampMediaPercent,microphoneLinearGain} from "@/lib/webrtc/mediaPolicy";
import {retainLobbyPresenceHeartbeat} from "@/lib/lobby-presence-heartbeat";

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
let micAudioContext:AudioContext|null=null;
let micGainNode:GainNode|null=null;
let micLimiterNode:DynamicsCompressorNode|null=null;
let micSourceTrackId:string|null=null;
let micProcessedStream:MediaStream|null=null;
let microphoneGain=100;
let connectGeneration=0;
let releaseVoiceHeartbeat:(()=>void)|null=null;
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
export function getActiveMicrophoneStream(){return activeStream}

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
function stopHeartbeat(){releaseVoiceHeartbeat?.();releaseVoiceHeartbeat=null}
function startHeartbeat(){
 stopHeartbeat();
 if(!activeLobbyId)return;
 releaseVoiceHeartbeat=retainLobbyPresenceHeartbeat(activeLobbyId);
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
function cleanupMicProcessing(){
 micProcessedStream?.getTracks().forEach(track=>track.stop());
 micProcessedStream=null;micGainNode=null;micLimiterNode=null;micSourceTrackId=null;
 micAudioContext?.close().catch(()=>{});micAudioContext=null;
}
async function processedMicrophoneStream(stream:MediaStream){
 const sourceTrack=stream.getAudioTracks()[0];if(!sourceTrack)return null;
 if(micProcessedStream&&micSourceTrackId===sourceTrack.id&&micProcessedStream.getAudioTracks()[0]?.readyState==="live")return micProcessedStream;
 cleanupMicProcessing();
 if(typeof AudioContext==="undefined")return stream;
 const context=new AudioContext(),source=context.createMediaStreamSource(stream),gain=context.createGain(),limiter=context.createDynamicsCompressor(),destination=context.createMediaStreamDestination();
 gain.gain.value=microphoneLinearGain(microphoneGain);
 limiter.threshold.value=-3;limiter.knee.value=2;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.12;
 source.connect(gain);gain.connect(limiter);limiter.connect(destination);
 await context.resume().catch(()=>{});
 micAudioContext=context;micGainNode=gain;micLimiterNode=limiter;micSourceTrackId=sourceTrack.id;micProcessedStream=destination.stream;
 return destination.stream;
}
async function publishOrReplaceMicrophone(room:Room,stream:MediaStream|null){
 if(!stream)return;
 const raw=stream.getAudioTracks()[0];if(!raw||raw.readyState!=="live")return;
 activeStream=stream;
 const processed=await processedMicrophoneStream(stream),next=processed?.getAudioTracks()[0];if(!next)return;
 const publication=room.localParticipant.getTrackPublication(Track.Source.Microphone),current=publication?.track;
 if(current instanceof LocalAudioTrack&&current.mediaStreamTrack===next)return;
 if(current)await room.localParticipant.unpublishTrack(current,false);
 await room.localParticipant.publishTrack(next,{source:Track.Source.Microphone,audioPreset:AudioPresets.music,dtx:true,red:true,stopMicTrackOnMute:false});
}
async function ensureSession(lobbyId:string,userId:string,members:VoiceLobbyMember[],stream:MediaStream|null){
 activeMembers=members;
 if(activeRoom&&activeLobbyId===lobbyId&&activeRoom.state!==ConnectionState.Disconnected){await publishOrReplaceMicrophone(activeRoom,stream);syncPresence(activeRoom);return}
 await disconnectActiveLiveKitVoice(false);
 const generation=++connectGeneration,room=new Room({adaptiveStream:true,dynacast:true,disconnectOnPageLeave:false});
 activeLobbyId=lobbyId;activeUserId=userId;activeMembers=members;setActiveRoom(room);bindRoom(room);
 try{
  const response=await fetch(`/api/lobbies/${lobbyId}/voice/token`,{method:"POST",cache:"no-store"}),data=await response.json() as {token?:string;url?:string;error?:string};
  if(!response.ok||!data.token||!data.url)throw new Error(data.error||"Token LiveKit indisponível");
  if(generation!==connectGeneration){room.removeAllListeners();await room.disconnect();return}
  await room.connect(data.url,data.token,{autoSubscribe:true});
  if(generation!==connectGeneration){room.removeAllListeners();await room.disconnect();return}
  if(stream)await publishOrReplaceMicrophone(room,stream);syncPresence(room);log("room-connected",{room:room.name,participantCount:room.numParticipants,microphone:Boolean(stream)});
 }catch(error){
  logError("room-connect-failed",{error:String(error)});
  if(generation===connectGeneration){stopHeartbeat();room.removeAllListeners();await room.disconnect().catch(()=>{});setActiveRoom(null);activeLobbyId=null;activeUserId=null;activeMembers=[];activePresence=new Map();emitPresence()}
 }
}
export async function disconnectActiveLiveKitVoice(stopTracks=true){
 connectGeneration+=1;stopHeartbeat();
 const room=activeRoom;setActiveRoom(null);activeLobbyId=null;activeUserId=null;activeMembers=[];activePresence=new Map();emitPresence();
 if(stopTracks)activeStream?.getTracks().forEach(track=>track.stop());activeStream=null;cleanupMicProcessing();
 if(room){room.removeAllListeners();await room.disconnect()}
}
export async function setLiveKitMicrophoneMuted(muted:boolean){const publication=activeRoom?.localParticipant.getTrackPublication(Track.Source.Microphone);if(!publication)return;if(muted)await publication.mute();else await publication.unmute();syncPresence()}
export function setLiveKitMicrophoneGain(value:number){
 microphoneGain=clampMediaPercent(value,MAX_MICROPHONE_GAIN_PERCENT);
 if(micGainNode&&micAudioContext){const now=micAudioContext.currentTime;micGainNode.gain.cancelScheduledValues(now);micGainNode.gain.setTargetAtTime(microphoneLinearGain(microphoneGain),now,.035)}
}
export async function switchLiveKitMicrophoneDevice(deviceId:string){const publication=activeRoom?.localParticipant.getTrackPublication(Track.Source.Microphone),track=publication?.track;if(!(track instanceof LocalAudioTrack))return null;await track.setDeviceId(deviceId||"default");activeStream=new MediaStream([track.mediaStreamTrack]);cleanupMicProcessing();return track.mediaStreamTrack}
export async function setLiveKitScreenShareEnabled(enabled:boolean){await activeRoom?.localParticipant.setScreenShareEnabled(enabled)}
export function getRemoteVoicePeerId(track:RemoteAudioTrack|null){return track?.sid}

export async function getLiveKitMediaRttMs(){
 const room=activeRoom;if(!room||room.state!==ConnectionState.Connected)return null;
 const tracks:(LocalAudioTrack|RemoteAudioTrack)[]=[];
 const localTrack=room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;if(localTrack instanceof LocalAudioTrack)tracks.push(localTrack);
 for(const participant of room.remoteParticipants.values()){const remoteTrack=participant.getTrackPublication(Track.Source.Microphone)?.track;if(remoteTrack instanceof RemoteAudioTrack)tracks.push(remoteTrack)}
 const candidates:number[]=[];
 for(const track of tracks){try{const report=await track.getRTCStatsReport();report?.forEach(stat=>{const row=stat as RTCStats&{currentRoundTripTime?:number;roundTripTime?:number;state?:string};if(row.type==="candidate-pair"&&row.state==="succeeded"&&typeof row.currentRoundTripTime==="number"&&row.currentRoundTripTime>=0)candidates.push(row.currentRoundTripTime*1000);if(row.type==="remote-inbound-rtp"&&typeof row.roundTripTime==="number"&&row.roundTripTime>=0)candidates.push(row.roundTripTime*1000)})}catch{}}
 if(!candidates.length)return null;return Math.max(1,Math.round(Math.min(...candidates)));
}

export function useLobbyVoice(lobbyId:string,localUserId:string,lobbyMembers:VoiceLobbyMember[],localStream:MediaStream|null){
 const [voicePresence,setVoicePresence]=useState<Map<string,VoiceMemberState>>(()=>new Map(activePresence));activeMembers=lobbyMembers;
 useEffect(()=>{if(process.env.NEXT_PUBLIC_VOICE_DEBUG!=="true"||window.__GRINDLOBBY_VOICE_DEBUG__)return;window.__GRINDLOBBY_VOICE_DEBUG__=true;console.debug("[GrindLobby Voice] debug-enabled")},[]);
 useEffect(()=>{const listener=(value:Map<string,VoiceMemberState>)=>setVoicePresence(new Map(value));presenceListeners.add(listener);listener(activePresence);return()=>{presenceListeners.delete(listener)}},[]);
 useEffect(()=>{activeMembers=lobbyMembers;if(activeRoom&&activeLobbyId===lobbyId)syncPresence(activeRoom)},[lobbyMembers.map(member=>member.userId).join(","),lobbyId]);
 useEffect(()=>{if(!lobbyId||!localUserId||!lobbyMembers.length)return;void ensureSession(lobbyId,localUserId,lobbyMembers,localStream)},[localStream,lobbyId,localUserId,lobbyMembers.map(member=>member.userId).join(",")]);
 const voiceMembers=[...voicePresence.values()],remotePeers=voiceMembers.filter(member=>member.userId!==localUserId&&member.connected);
 function setPeerVolume(userId:string,volume:number){const current=volumes.get(userId)??{volume:100,muted:false};volumes.set(userId,{...current,volume:clampMediaPercent(volume,100)});syncPresence()}
 function togglePeerMuted(userId:string){const current=volumes.get(userId)??{volume:100,muted:false};volumes.set(userId,{...current,muted:!current.muted});syncPresence()}
 function notifyVoiceLeave(){void disconnectActiveLiveKitVoice(true)}
 return{remotePeers,voiceMembers,setPeerVolume,togglePeerMuted,notifyVoiceLeave};
}

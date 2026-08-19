"use client";
import {useEffect,useRef,useState} from "react";
import {
 AudioPresets,ConnectionState,LocalAudioTrack,RemoteAudioTrack,Room,RoomEvent,Track,
 type RemoteParticipant,type RemoteTrack,type RemoteTrackPublication
} from "livekit-client";

export type VoiceMemberState={userId:string;connected:boolean;stream:RemoteAudioTrack|null;status:"Offline"|"Connecting"|"Connected"|"Reconnecting";speaking:boolean;audioLevel:number;microphoneMuted:boolean;volume:number;muted:boolean};
export type VoiceLobbyMember={userId:string;name:string;profileId:string|null;membershipId:string|null};
declare global{interface Window{__GRINDLOBBY_VOICE_DEBUG__?:boolean}}
const voiceDebug=process.env.NODE_ENV==="development"||process.env.NEXT_PUBLIC_VOICE_DEBUG==="true";
const log=(event:string,details:Record<string,unknown>={})=>{if(voiceDebug)console.debug(`[GrindLobby Voice] ${event}`,details)};
const logError=(event:string,details:Record<string,unknown>={})=>{if(voiceDebug)console.error(`[GrindLobby Voice] ${event}`,details)};
let activeRoom:Room|null=null;
const activeRoomListeners=new Set<(room:Room|null)=>void>();
function updateActiveRoom(room:Room|null){activeRoom=room;for(const listener of activeRoomListeners)listener(room)}
export function subscribeActiveLiveKitRoom(listener:(room:Room|null)=>void){activeRoomListeners.add(listener);listener(activeRoom);return()=>{activeRoomListeners.delete(listener)}}

export async function setLiveKitMicrophoneMuted(muted:boolean){
 const publication=activeRoom?.localParticipant.getTrackPublication(Track.Source.Microphone);
 if(!publication)return;
 if(muted)await publication.mute();else await publication.unmute();
}
export async function switchLiveKitMicrophoneDevice(deviceId:string){
 const publication=activeRoom?.localParticipant.getTrackPublication(Track.Source.Microphone),track=publication?.track;
 if(!(track instanceof LocalAudioTrack))return null;
 await track.setDeviceId(deviceId||"default");
 return track.mediaStreamTrack;
}
export async function setLiveKitScreenShareEnabled(enabled:boolean){await activeRoom?.localParticipant.setScreenShareEnabled(enabled)}
export function getRemoteVoicePeerId(track:RemoteAudioTrack|null){return track?.sid}

export function useLobbyVoice(lobbyId:string,localUserId:string,lobbyMembers:VoiceLobbyMember[],localStream:MediaStream|null){
 const [voicePresence,setVoicePresence]=useState<Map<string,VoiceMemberState>>(()=>new Map());
 const roomRef=useRef<Room|null>(null),generation=useRef(0),localStreamRef=useRef(localStream);
 const volumes=useRef(new Map<string,{volume:number;muted:boolean}>()),lobbyMembersRef=useRef(lobbyMembers),lastAudit=useRef("");lobbyMembersRef.current=lobbyMembers;

 const syncVoicePresence=(room:Room)=>{
  const snapshot=new Map<string,VoiceMemberState>(),localIdentity=room.localParticipant.identity,remoteIdentities=[...room.remoteParticipants.keys()];
  for(const member of lobbyMembersRef.current){
   const userId=member.userId,isLocal=userId===localIdentity,participant=isLocal?room.localParticipant:room.remoteParticipants.get(userId);
   const connected=isLocal?room.state===ConnectionState.Connected:Boolean(participant),publication=participant?.getTrackPublication(Track.Source.Microphone);
   const stream=!isLocal&&publication?.track instanceof RemoteAudioTrack?publication.track:null,controls=volumes.current.get(userId)??{volume:100,muted:false};
   const status:VoiceMemberState["status"]=connected?"Connected":isLocal&&room.state===ConnectionState.Reconnecting?"Reconnecting":isLocal&&room.state===ConnectionState.Connecting?"Connecting":"Offline";
   snapshot.set(userId,{userId,connected,stream,status,speaking:connected?Boolean(participant?.isSpeaking):false,audioLevel:connected?participant?.audioLevel??0:0,microphoneMuted:connected?Boolean(publication?.isMuted):true,volume:controls.volume,muted:controls.muted});
  }
  setVoicePresence(new Map(snapshot));
  if(voiceDebug){
   const audit={localIdentity,remoteIdentities,lobbyMembers:lobbyMembersRef.current,matchedUserIds:[...snapshot.values()].filter(item=>item.connected).map(item=>item.userId)},signature=JSON.stringify(audit);
   if(signature!==lastAudit.current){lastAudit.current=signature;console.debug("[GrindLobby LiveKit Identity Audit]",audit)}
  }
 };

 useEffect(()=>{if(process.env.NEXT_PUBLIC_VOICE_DEBUG!=="true"||window.__GRINDLOBBY_VOICE_DEBUG__)return;window.__GRINDLOBBY_VOICE_DEBUG__=true;console.debug("[GrindLobby Voice] debug-enabled")},[]);
 useEffect(()=>{
  localStreamRef.current=localStream;const run=++generation.current;
  if(!localStream){const room=roomRef.current;roomRef.current=null;if(activeRoom===room)updateActiveRoom(null);room?.disconnect();setVoicePresence(new Map(lobbyMembersRef.current.map(member=>[member.userId,{userId:member.userId,connected:false,stream:null,status:"Offline",speaking:false,audioLevel:0,microphoneMuted:true,volume:volumes.current.get(member.userId)?.volume??100,muted:volumes.current.get(member.userId)?.muted??false}])));return}
  const room=new Room({adaptiveStream:true,dynacast:true,disconnectOnPageLeave:true});roomRef.current=room;updateActiveRoom(room);
  const onParticipantConnected=(participant:RemoteParticipant)=>{syncVoicePresence(room);log("participant-connected",{peerId:participant.identity})};
  const onParticipantDisconnected=(participant:RemoteParticipant)=>{syncVoicePresence(room);log("participant-disconnected",{peerId:participant.identity})};
  const onTrackSubscribed=(track:RemoteTrack,_publication:RemoteTrackPublication,participant:RemoteParticipant)=>{syncVoicePresence(room);if(track instanceof RemoteAudioTrack)log("remote-audio-subscribed",{peerId:participant.identity,trackSid:track.sid})};
  const onTrackChanged=()=>syncVoicePresence(room);
  room.on(RoomEvent.Connected,onTrackChanged).on(RoomEvent.ParticipantConnected,onParticipantConnected).on(RoomEvent.ParticipantDisconnected,onParticipantDisconnected).on(RoomEvent.TrackSubscribed,onTrackSubscribed).on(RoomEvent.TrackUnsubscribed,onTrackChanged).on(RoomEvent.TrackMuted,onTrackChanged).on(RoomEvent.TrackUnmuted,onTrackChanged).on(RoomEvent.ActiveSpeakersChanged,onTrackChanged).on(RoomEvent.Reconnecting,onTrackChanged).on(RoomEvent.Reconnected,onTrackChanged).on(RoomEvent.Disconnected,onTrackChanged).on(RoomEvent.ConnectionStateChanged,onTrackChanged);
  (async()=>{
   try{
    const response=await fetch(`/api/lobbies/${lobbyId}/voice/token`,{method:"POST",cache:"no-store"}),data=await response.json() as {token?:string;url?:string;error?:string};
    if(!response.ok||!data.token||!data.url)throw new Error(data.error||"Token LiveKit indisponível");
    if(run!==generation.current)return;
    await room.connect(data.url,data.token,{autoSubscribe:true});if(run!==generation.current){room.disconnect();return}
    const track=localStreamRef.current?.getAudioTracks()[0];if(track)await room.localParticipant.publishTrack(track,{source:Track.Source.Microphone,audioPreset:AudioPresets.speech,dtx:true,red:true,stopMicTrackOnMute:false});
    syncVoicePresence(room);
    log("room-connected",{room:room.name,participantCount:room.numParticipants,connectionState:room.state});
   }catch(error){logError("room-connect-failed",{error:String(error)});if(run===generation.current)syncVoicePresence(room)}
  })();
  return()=>{generation.current+=1;room.removeAllListeners();room.disconnect();if(roomRef.current===room)roomRef.current=null;if(activeRoom===room)updateActiveRoom(null);setVoicePresence(new Map())};
 },[Boolean(localStream),lobbyId,localUserId]);
 useEffect(()=>{
  localStreamRef.current=localStream;const room=roomRef.current;if(!localStream||!room||room.state!==ConnectionState.Connected)return;
  const next=localStream.getAudioTracks()[0],publication=room.localParticipant.getTrackPublication(Track.Source.Microphone);
  if(!next||publication?.track?.mediaStreamTrack===next)return;
  if(publication?.track)room.localParticipant.unpublishTrack(publication.track,false).then(()=>room.localParticipant.publishTrack(next,{source:Track.Source.Microphone,audioPreset:AudioPresets.speech,dtx:true,red:true})).catch(error=>logError("microphone-replace-failed",{error:String(error)}));
 },[localStream]);
 useEffect(()=>{const room=roomRef.current;if(room)syncVoicePresence(room)},[lobbyMembers.map(member=>member.userId).join(",")]);
 const voiceMembers=[...voicePresence.values()],remotePeers=voiceMembers.filter(member=>member.userId!==localUserId&&member.connected);
 function setPeerVolume(userId:string,volume:number){const current=volumes.current.get(userId)??{volume:100,muted:false};volumes.current.set(userId,{...current,volume});setVoicePresence(items=>{const next=new Map(items),item=next.get(userId);if(item)next.set(userId,{...item,volume});return next})}
 function togglePeerMuted(userId:string){const current=volumes.current.get(userId)??{volume:100,muted:false},muted=!current.muted;volumes.current.set(userId,{...current,muted});setVoicePresence(items=>{const next=new Map(items),item=next.get(userId);if(item)next.set(userId,{...item,muted});return next})}
 function notifyVoiceLeave(){generation.current+=1;const room=roomRef.current;roomRef.current=null;if(activeRoom===room)updateActiveRoom(null);room?.disconnect();setVoicePresence(new Map())}
 return{remotePeers,voiceMembers,setPeerVolume,togglePeerMuted,notifyVoiceLeave};
}

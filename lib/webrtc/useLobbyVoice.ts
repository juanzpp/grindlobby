"use client";
import {useEffect,useRef,useState} from "react";
import {
 AudioPresets,ConnectionState,LocalAudioTrack,RemoteAudioTrack,Room,RoomEvent,Track,
 type Participant,type RemoteParticipant,type RemoteTrack,type RemoteTrackPublication,type TrackPublication
} from "livekit-client";

export type VoiceMemberState={userId:string;connected:boolean;stream:RemoteAudioTrack|null;status:"Offline"|"Connecting"|"Connected"|"Reconnecting";speaking:boolean;audioLevel:number;microphoneMuted:boolean;volume:number;muted:boolean};
declare global{interface Window{__GRINDLOBBY_VOICE_DEBUG__?:boolean}}
const voiceDebug=process.env.NODE_ENV==="development"||process.env.NEXT_PUBLIC_VOICE_DEBUG==="true";
const log=(event:string,details:Record<string,unknown>={})=>{if(voiceDebug)console.debug(`[GrindLobby Voice] ${event}`,details)};
const logError=(event:string,details:Record<string,unknown>={})=>{if(voiceDebug)console.error(`[GrindLobby Voice] ${event}`,details)};
let activeRoom:Room|null=null;

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

export function useLobbyVoice(lobbyId:string,localUserId:string,members:string[],localStream:MediaStream|null){
 const [voiceMembers,setVoiceMembers]=useState<VoiceMemberState[]>([]);
 const roomRef=useRef<Room|null>(null),generation=useRef(0),localStreamRef=useRef(localStream);
 const volumes=useRef(new Map<string,{volume:number;muted:boolean}>()),memberIdsRef=useRef(members);memberIdsRef.current=members;

 const syncVoiceMembers=(room:Room)=>setVoiceMembers(memberIdsRef.current.map(userId=>{
  const isLocal=userId===room.localParticipant.identity,participant=isLocal?room.localParticipant:room.remoteParticipants.get(userId);
  const connected=isLocal?room.state===ConnectionState.Connected:Boolean(participant);
  const publication=participant?.getTrackPublication(Track.Source.Microphone),stream=!isLocal&&publication?.track instanceof RemoteAudioTrack?publication.track:null;
  const controls=volumes.current.get(userId)??{volume:100,muted:false};
  const status:VoiceMemberState["status"]=connected?room.state===ConnectionState.Reconnecting?"Reconnecting":"Connected":room.state===ConnectionState.Connecting&&isLocal?"Connecting":"Offline";
  return{userId,connected,stream,status,speaking:connected?Boolean(participant?.isSpeaking):false,audioLevel:connected?participant?.audioLevel??0:0,microphoneMuted:connected?Boolean(publication?.isMuted):true,volume:controls.volume,muted:controls.muted};
 }));

 useEffect(()=>{if(process.env.NEXT_PUBLIC_VOICE_DEBUG!=="true"||window.__GRINDLOBBY_VOICE_DEBUG__)return;window.__GRINDLOBBY_VOICE_DEBUG__=true;console.debug("[GrindLobby Voice] debug-enabled")},[]);
 useEffect(()=>{
  localStreamRef.current=localStream;const run=++generation.current;
  if(!localStream){const room=roomRef.current;roomRef.current=null;if(activeRoom===room)activeRoom=null;room?.disconnect();setVoiceMembers(memberIdsRef.current.map(userId=>({userId,connected:false,stream:null,status:"Offline",speaking:false,audioLevel:0,microphoneMuted:true,volume:volumes.current.get(userId)?.volume??100,muted:volumes.current.get(userId)?.muted??false})));return}
  const room=new Room({adaptiveStream:true,dynacast:true,disconnectOnPageLeave:true});roomRef.current=room;activeRoom=room;
  const onParticipantConnected=(participant:RemoteParticipant)=>{syncVoiceMembers(room);log("participant-connected",{peerId:participant.identity})};
  const onParticipantDisconnected=(participant:RemoteParticipant)=>{syncVoiceMembers(room);log("participant-disconnected",{peerId:participant.identity})};
  const onTrackSubscribed=(track:RemoteTrack,_publication:RemoteTrackPublication,participant:RemoteParticipant)=>{syncVoiceMembers(room);if(track instanceof RemoteAudioTrack)log("remote-audio-subscribed",{peerId:participant.identity,trackSid:track.sid})};
  const onTrackChanged=()=>syncVoiceMembers(room);
  room.on(RoomEvent.ParticipantConnected,onParticipantConnected).on(RoomEvent.ParticipantDisconnected,onParticipantDisconnected).on(RoomEvent.TrackSubscribed,onTrackSubscribed).on(RoomEvent.TrackUnsubscribed,onTrackChanged).on(RoomEvent.TrackMuted,onTrackChanged).on(RoomEvent.TrackUnmuted,onTrackChanged).on(RoomEvent.ActiveSpeakersChanged,onTrackChanged).on(RoomEvent.Reconnecting,()=>{syncVoiceMembers(room);log("room-reconnecting")}).on(RoomEvent.Reconnected,()=>{syncVoiceMembers(room);log("room-reconnected")}).on(RoomEvent.Disconnected,reason=>{syncVoiceMembers(room);log("room-disconnected",{reason})}).on(RoomEvent.ConnectionStateChanged,state=>{syncVoiceMembers(room);log("room-connection-state",{state})});
  (async()=>{
   try{
    const response=await fetch(`/api/lobbies/${lobbyId}/voice/token`,{method:"POST",cache:"no-store"}),data=await response.json() as {token?:string;url?:string;error?:string};
    if(!response.ok||!data.token||!data.url)throw new Error(data.error||"Token LiveKit indisponível");
    if(run!==generation.current)return;
    await room.connect(data.url,data.token,{autoSubscribe:true});if(run!==generation.current){room.disconnect();return}
    const track=localStreamRef.current?.getAudioTracks()[0];if(track)await room.localParticipant.publishTrack(track,{source:Track.Source.Microphone,audioPreset:AudioPresets.speech,dtx:true,red:true,stopMicTrackOnMute:false});
    syncVoiceMembers(room);
    log("room-connected",{room:room.name,participantCount:room.numParticipants,connectionState:room.state});
   }catch(error){logError("room-connect-failed",{error:String(error)});if(run===generation.current)syncVoiceMembers(room)}
  })();
  return()=>{generation.current+=1;room.removeAllListeners();room.disconnect();if(roomRef.current===room)roomRef.current=null;if(activeRoom===room)activeRoom=null;setVoiceMembers([])};
 },[Boolean(localStream),lobbyId,localUserId]);
 useEffect(()=>{
  localStreamRef.current=localStream;const room=roomRef.current;if(!localStream||!room||room.state!==ConnectionState.Connected)return;
  const next=localStream.getAudioTracks()[0],publication=room.localParticipant.getTrackPublication(Track.Source.Microphone);
  if(!next||publication?.track?.mediaStreamTrack===next)return;
  if(publication?.track)room.localParticipant.unpublishTrack(publication.track,false).then(()=>room.localParticipant.publishTrack(next,{source:Track.Source.Microphone,audioPreset:AudioPresets.speech,dtx:true,red:true})).catch(error=>logError("microphone-replace-failed",{error:String(error)}));
 },[localStream]);
 useEffect(()=>{const room=roomRef.current;if(room)syncVoiceMembers(room)},[members.join(",")]);
 const remotePeers=voiceMembers.filter(member=>member.userId!==localUserId&&member.connected);
 function setPeerVolume(userId:string,volume:number){const current=volumes.current.get(userId)??{volume:100,muted:false};volumes.current.set(userId,{...current,volume});setVoiceMembers(items=>items.map(item=>item.userId===userId?{...item,volume}:item))}
 function togglePeerMuted(userId:string){const current=volumes.current.get(userId)??{volume:100,muted:false},muted=!current.muted;volumes.current.set(userId,{...current,muted});setVoiceMembers(items=>items.map(item=>item.userId===userId?{...item,muted}:item))}
 function notifyVoiceLeave(){generation.current+=1;const room=roomRef.current;roomRef.current=null;if(activeRoom===room)activeRoom=null;room?.disconnect();setVoiceMembers([])}
 return{remotePeers,voiceMembers,setPeerVolume,togglePeerMuted,notifyVoiceLeave};
}

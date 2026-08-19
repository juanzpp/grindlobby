"use client";
import {useEffect,useRef,useState} from "react";
import {
 AudioPresets,ConnectionState,LocalAudioTrack,RemoteAudioTrack,Room,RoomEvent,Track,
 type Participant,type RemoteParticipant,type RemoteTrack,type RemoteTrackPublication,type TrackPublication
} from "livekit-client";

export type RemoteVoicePeer={userId:string;stream:RemoteAudioTrack|null;status:"Connecting"|"Connected"|"Reconnecting";speaking:boolean;volume:number;muted:boolean};
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
 const [remotePeers,setRemotePeers]=useState<RemoteVoicePeer[]>([]);
 const roomRef=useRef<Room|null>(null),generation=useRef(0),localStreamRef=useRef(localStream);
 const volumes=useRef(new Map<string,{volume:number;muted:boolean}>());

 const upsertParticipant=(participant:RemoteParticipant,track?:RemoteAudioTrack|null)=>{
  const controls=volumes.current.get(participant.identity)??{volume:100,muted:false};
  const publication=participant.getTrackPublication(Track.Source.Microphone),audioTrack=track??(publication?.track instanceof RemoteAudioTrack?publication.track:null);
  setRemotePeers(current=>{
   const peer:RemoteVoicePeer={userId:participant.identity,stream:audioTrack,status:"Connected",speaking:participant.isSpeaking,volume:controls.volume,muted:controls.muted||Boolean(publication?.isMuted)};
   return current.some(item=>item.userId===participant.identity)?current.map(item=>item.userId===participant.identity?{...item,...peer}:item):[...current,peer];
  });
 };
 const removeParticipant=(identity:string)=>setRemotePeers(current=>current.filter(peer=>peer.userId!==identity));
 const setConnectionStatus=(status:RemoteVoicePeer["status"])=>setRemotePeers(current=>current.map(peer=>({...peer,status})));

 useEffect(()=>{if(process.env.NEXT_PUBLIC_VOICE_DEBUG!=="true"||window.__GRINDLOBBY_VOICE_DEBUG__)return;window.__GRINDLOBBY_VOICE_DEBUG__=true;console.debug("[GrindLobby Voice] debug-enabled")},[]);
 useEffect(()=>{
  localStreamRef.current=localStream;const run=++generation.current;
  if(!localStream){const room=roomRef.current;roomRef.current=null;if(activeRoom===room)activeRoom=null;room?.disconnect();setRemotePeers([]);return}
  const room=new Room({adaptiveStream:true,dynacast:true,disconnectOnPageLeave:true});roomRef.current=room;activeRoom=room;
  const onParticipantConnected=(participant:RemoteParticipant)=>{upsertParticipant(participant);log("participant-connected",{peerId:participant.identity})};
  const onParticipantDisconnected=(participant:RemoteParticipant)=>{removeParticipant(participant.identity);log("participant-disconnected",{peerId:participant.identity})};
  const onTrackSubscribed=(track:RemoteTrack,_publication:RemoteTrackPublication,participant:RemoteParticipant)=>{if(track instanceof RemoteAudioTrack){upsertParticipant(participant,track);log("remote-audio-subscribed",{peerId:participant.identity,trackSid:track.sid})}};
  const onTrackUnsubscribed=(track:RemoteTrack,_publication:RemoteTrackPublication,participant:RemoteParticipant)=>{if(track instanceof RemoteAudioTrack)upsertParticipant(participant,null)};
  const onTrackState=(_publication:TrackPublication,participant:Participant)=>{if(participant.identity!==localUserId&&"getTrackPublication" in participant)upsertParticipant(participant as RemoteParticipant)};
  const onSpeakers=(speakers:Participant[])=>{const active=new Set(speakers.map(item=>item.identity));setRemotePeers(current=>current.map(peer=>({...peer,speaking:active.has(peer.userId)})))};
  room.on(RoomEvent.ParticipantConnected,onParticipantConnected).on(RoomEvent.ParticipantDisconnected,onParticipantDisconnected).on(RoomEvent.TrackSubscribed,onTrackSubscribed).on(RoomEvent.TrackUnsubscribed,onTrackUnsubscribed).on(RoomEvent.TrackMuted,onTrackState).on(RoomEvent.TrackUnmuted,onTrackState).on(RoomEvent.ActiveSpeakersChanged,onSpeakers).on(RoomEvent.Reconnecting,()=>{setConnectionStatus("Reconnecting");log("room-reconnecting")}).on(RoomEvent.Reconnected,()=>{setConnectionStatus("Connected");log("room-reconnected")}).on(RoomEvent.Disconnected,reason=>{setRemotePeers([]);log("room-disconnected",{reason})}).on(RoomEvent.ConnectionStateChanged,state=>log("room-connection-state",{state}));
  (async()=>{
   try{
    const response=await fetch(`/api/lobbies/${lobbyId}/voice/token`,{method:"POST",cache:"no-store"}),data=await response.json() as {token?:string;url?:string;error?:string};
    if(!response.ok||!data.token||!data.url)throw new Error(data.error||"Token LiveKit indisponível");
    if(run!==generation.current)return;
    await room.connect(data.url,data.token,{autoSubscribe:true});if(run!==generation.current){room.disconnect();return}
    room.remoteParticipants.forEach(participant=>upsertParticipant(participant));
    const track=localStreamRef.current?.getAudioTracks()[0];if(track)await room.localParticipant.publishTrack(track,{source:Track.Source.Microphone,audioPreset:AudioPresets.speech,dtx:true,red:true,stopMicTrackOnMute:false});
    log("room-connected",{room:room.name,participantCount:room.numParticipants,connectionState:room.state});
   }catch(error){logError("room-connect-failed",{error:String(error)});if(run===generation.current)setConnectionStatus("Reconnecting")}
  })();
  return()=>{generation.current+=1;room.removeAllListeners();room.disconnect();if(roomRef.current===room)roomRef.current=null;if(activeRoom===room)activeRoom=null;setRemotePeers([])};
 },[Boolean(localStream),lobbyId,localUserId]);
 useEffect(()=>{
  localStreamRef.current=localStream;const room=roomRef.current;if(!localStream||!room||room.state!==ConnectionState.Connected)return;
  const next=localStream.getAudioTracks()[0],publication=room.localParticipant.getTrackPublication(Track.Source.Microphone);
  if(!next||publication?.track?.mediaStreamTrack===next)return;
  if(publication?.track)room.localParticipant.unpublishTrack(publication.track,false).then(()=>room.localParticipant.publishTrack(next,{source:Track.Source.Microphone,audioPreset:AudioPresets.speech,dtx:true,red:true})).catch(error=>logError("microphone-replace-failed",{error:String(error)}));
 },[localStream]);
 useEffect(()=>{setRemotePeers(current=>current.filter(peer=>members.includes(peer.userId)))},[members.join(",")]);
 function setPeerVolume(userId:string,volume:number){const current=volumes.current.get(userId)??{volume:100,muted:false};volumes.current.set(userId,{...current,volume});setRemotePeers(peers=>peers.map(peer=>peer.userId===userId?{...peer,volume}:peer))}
 function togglePeerMuted(userId:string){const current=volumes.current.get(userId)??{volume:100,muted:false},muted=!current.muted;volumes.current.set(userId,{...current,muted});setRemotePeers(peers=>peers.map(peer=>peer.userId===userId?{...peer,muted}:peer))}
 function notifyVoiceLeave(){generation.current+=1;const room=roomRef.current;roomRef.current=null;if(activeRoom===room)activeRoom=null;room?.disconnect();setRemotePeers([])}
 return{remotePeers,setPeerVolume,togglePeerMuted,notifyVoiceLeave};
}

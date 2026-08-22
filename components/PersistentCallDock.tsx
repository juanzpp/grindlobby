"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {usePathname,useRouter} from "next/navigation";
import {Expand,Mic,MicOff,MonitorUp,PhoneOff,Radio,Users,Volume2,X} from "lucide-react";
import {RemoteAudioTrack,RemoteVideoTrack,Track} from "livekit-client";
import {disconnectActiveLiveKitVoice,setLiveKitMicrophoneMuted,subscribeVoiceSession,type ActiveVoiceSession} from "@/lib/webrtc/useLobbyVoice";
import {loadAudioOutputPreferences,subscribeAudioOutput,type AudioOutputPreferences} from "@/lib/audio-output";
import {perceptualPlaybackGain} from "@/lib/webrtc/mediaPolicy";

const streamVolumeKey="grindlobby.stream.volume.v2";
function initialStreamVolume(){if(typeof window==="undefined")return 30;const value=Number(localStorage.getItem(streamVolumeKey));return Number.isFinite(value)?Math.max(0,Math.min(100,value)):30}

function PersistentScreenPreview({session,onOpenLobby}:{session:ActiveVoiceSession;onOpenLobby:()=>void}){
 const videoRef=useRef<HTMLVideoElement>(null),audioRef=useRef<HTMLAudioElement>(null),[volume,setVolume]=useState(initialStreamVolume),[hidden,setHidden]=useState(false),[output,setOutput]=useState<AudioOutputPreferences>(loadAudioOutputPreferences),[audioBlocked,setAudioBlocked]=useState(false);
 const share=useMemo(()=>{
  const room=session.room;if(!room)return null;
  for(const participant of room.remoteParticipants.values()){
   const video=participant.getTrackPublication(Track.Source.ScreenShare)?.track;
   const audio=participant.getTrackPublication(Track.Source.ScreenShareAudio)?.track;
   if(video instanceof RemoteVideoTrack)return{name:participant.name||"Player",video,audio:audio instanceof RemoteAudioTrack?audio:null};
  }
  return null;
 },[session.room,session.screenSharers.map(item=>item.userId).join(",")]);
 const gain=perceptualPlaybackGain(volume)*perceptualPlaybackGain(output.volume);
 useEffect(()=>subscribeAudioOutput(setOutput),[]);
 useEffect(()=>{if(share)setHidden(false)},[share?.video]);
 useEffect(()=>{localStorage.setItem(streamVolumeKey,String(volume))},[volume]);
 useEffect(()=>{const element=videoRef.current;if(!element||!share)return;share.video.attach(element);element.play().catch(()=>{});return()=>{share.video.detach(element)}},[share?.video]);
 useEffect(()=>{
  const element=audioRef.current,track=share?.audio;if(!element||!track)return;
  let disposed=false;
  const retry=()=>{if(disposed||element.muted)return;void element.play().then(()=>{setAudioBlocked(false);window.removeEventListener("pointerdown",retry,true);window.removeEventListener("touchend",retry,true)}).catch(()=>{})};
  setAudioBlocked(false);track.attach(element);element.volume=1;track.setVolume(gain);element.muted=gain===0;
  if(output.deviceId)track.setSinkId(output.deviceId).catch(()=>{});
  if(gain>0)element.play().catch(()=>{setAudioBlocked(true);window.addEventListener("pointerdown",retry,true);window.addEventListener("touchend",retry,true)});
  return()=>{disposed=true;window.removeEventListener("pointerdown",retry,true);window.removeEventListener("touchend",retry,true);track.detach(element);track.setVolume(1)};
 },[share?.audio,output.deviceId]);
 useEffect(()=>{const track=share?.audio,element=audioRef.current;if(!track)return;track.setVolume(gain);if(element){element.muted=gain===0;if(gain>0&&element.paused)element.play().then(()=>setAudioBlocked(false)).catch(()=>setAudioBlocked(true))}},[share?.audio,gain]);
 if(!share||hidden)return null;
 return <section className="persistent-screen-mini">
  <header><span><Radio size={11}/>AO VIVO · {share.name}</span><div><button onClick={onOpenLobby} title="Abrir sala"><Expand size={13}/></button><button onClick={()=>setHidden(true)} title="Fechar mini-player"><X size={13}/></button></div></header>
  <div className="persistent-screen-video"><video ref={videoRef} autoPlay playsInline muted/><audio ref={audioRef} autoPlay playsInline/>{audioBlocked?<button className="stream-unlock-audio" onClick={()=>audioRef.current?.play().then(()=>setAudioBlocked(false)).catch(()=>{})}><Volume2 size={13}/>Ativar áudio</button>:null}</div>
  <footer><Volume2 size={13}/><input aria-label="Volume da transmissão" type="range" min="0" max="100" value={volume} onChange={event=>setVolume(Number(event.target.value))}/><b>{volume}%</b></footer>
 </section>;
}

export default function PersistentCallDock(){
 const [session,setSession]=useState<ActiveVoiceSession>({lobbyId:null,room:null,connected:false,participantCount:0,screenSharers:[]});
 const [muted,setMuted]=useState(false);
 const router=useRouter(),pathname=usePathname();
 const disabled=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("desktop")==="lite";
 useEffect(()=>{if(disabled)return;return subscribeVoiceSession(next=>{setSession(next);const pub=next.room?.localParticipant.getTrackPublication(Track.Source.Microphone);setMuted(Boolean(pub?.isMuted))})},[disabled]);
 const remoteShares=useMemo(()=>session.screenSharers.filter(item=>item.userId!==session.room?.localParticipant.identity),[session]);
 if(disabled||!session.room||!session.lobbyId)return null;
 const inLobby=pathname===`/lobby/${session.lobbyId}`;
 async function toggleMute(){const next=!muted;setMuted(next);await setLiveKitMicrophoneMuted(next)}
 const openLobby=()=>router.push(`/lobby/${session.lobbyId}`);
 return <>
  {!inLobby&&remoteShares.length?<PersistentScreenPreview session={session} onOpenLobby={openLobby}/>:null}
  <aside className="persistent-call-dock" aria-label="Call ativa">
   <div className="persistent-call-main">
    <span className={`persistent-call-status ${session.connected?"online":"reconnecting"}`}><Radio size={12}/>{session.connected?"CALL ATIVA":"RECONECTANDO"}</span>
    <button className="persistent-call-room" onClick={openLobby}><strong>GrindLobby em andamento</strong><small><Users size={12}/>{session.participantCount} na call</small></button>
    {remoteShares.length?<button className="persistent-call-share" onClick={openLobby}><MonitorUp size={14}/><span><b>{remoteShares[0].name}</b> está compartilhando a tela{remoteShares.length>1?` +${remoteShares.length-1}`:""}</span></button>:null}
   </div>
   <div className="persistent-call-actions">{!inLobby?<button onClick={openLobby}>Voltar à sala</button>:null}<button className={muted?"muted":""} onClick={()=>void toggleMute()} aria-label={muted?"Ativar microfone":"Mutar microfone"}>{muted?<MicOff size={16}/>:<Mic size={16}/>}</button><button className="hangup" onClick={()=>void disconnectActiveLiveKitVoice(true)} aria-label="Sair da call"><PhoneOff size={16}/></button></div>
  </aside>
 </>;
}

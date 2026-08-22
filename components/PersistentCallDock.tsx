"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {usePathname,useRouter} from "next/navigation";
import {Expand,Mic,MicOff,MonitorUp,PhoneOff,Radio,Square,Users,Volume2,X} from "lucide-react";
import {RemoteAudioTrack,RemoteVideoTrack,Track} from "livekit-client";
import {disconnectActiveLiveKitVoice,setLiveKitMicrophoneMuted,setLiveKitScreenShareEnabled,subscribeVoiceSession,type ActiveVoiceSession} from "@/lib/webrtc/useLobbyVoice";
import {loadAudioOutputPreferences,subscribeAudioOutput,type AudioOutputPreferences} from "@/lib/audio-output";
import {perceptualPlaybackGain} from "@/lib/webrtc/mediaPolicy";

const streamVolumeKey="grindlobby.stream.volume.v2";
function initialStreamVolume(){if(typeof window==="undefined")return 30;const value=Number(localStorage.getItem(streamVolumeKey));return Number.isFinite(value)?Math.max(0,Math.min(100,value)):30}

function PersistentScreenPreview({session,onOpenLobby}:{session:ActiveVoiceSession;onOpenLobby:()=>void}){
 const videoRef=useRef<HTMLVideoElement>(null),audioRef=useRef<HTMLAudioElement>(null),[volume,setVolume]=useState(initialStreamVolume),[hiddenTrackId,setHiddenTrackId]=useState<string|null>(null),[output,setOutput]=useState<AudioOutputPreferences>(loadAudioOutputPreferences),[audioBlocked,setAudioBlocked]=useState(false);
 const room=session.room;
 let share:{name:string;video:RemoteVideoTrack;audio:RemoteAudioTrack|null}|null=null;
 if(room){
  for(const participant of room.remoteParticipants.values()){
   const video=participant.getTrackPublication(Track.Source.ScreenShare)?.track;
   const audio=participant.getTrackPublication(Track.Source.ScreenShareAudio)?.track;
   if(video instanceof RemoteVideoTrack){share={name:participant.name||"Player",video,audio:audio instanceof RemoteAudioTrack?audio:null};break}
  }
 }
 const shareTrackId=share?.video.sid??share?.video.mediaStreamTrack.id??null;
 const gain=perceptualPlaybackGain(volume)*perceptualPlaybackGain(output.volume);
 useEffect(()=>subscribeAudioOutput(setOutput),[]);
 useEffect(()=>{localStorage.setItem(streamVolumeKey,String(volume))},[volume]);
 useEffect(()=>{
  const element=videoRef.current;if(!element||!share)return;
  const track=share.video;track.attach(element);element.play().catch(()=>{});
  return()=>{track.detach(element)};
 },[share]);
 useEffect(()=>{
  const element=audioRef.current,track=share?.audio;if(!element||!track)return;
  let disposed=false;
  const retry=()=>{if(disposed||element.muted)return;void element.play().then(()=>{setAudioBlocked(false);window.removeEventListener("pointerdown",retry,true);window.removeEventListener("touchend",retry,true)}).catch(()=>{})};
  setAudioBlocked(false);track.attach(element);element.volume=1;track.setVolume(gain);element.muted=gain===0;
  if(output.deviceId)track.setSinkId(output.deviceId).catch(()=>{});
  if(gain>0)element.play().catch(()=>{setAudioBlocked(true);window.addEventListener("pointerdown",retry,true);window.addEventListener("touchend",retry,true)});
  return()=>{disposed=true;window.removeEventListener("pointerdown",retry,true);window.removeEventListener("touchend",retry,true);track.detach(element);track.setVolume(1)};
 },[share,output.deviceId,gain]);
 if(!share||!shareTrackId||hiddenTrackId===shareTrackId)return null;
 return <section className="persistent-screen-mini">
  <header><span><Radio size={11}/>AO VIVO · {share.name}</span><div><button onClick={onOpenLobby} title="Abrir sala"><Expand size={13}/></button><button onClick={()=>setHiddenTrackId(shareTrackId)} title="Fechar mini-player"><X size={13}/></button></div></header>
  <div className="persistent-screen-video"><video ref={videoRef} autoPlay playsInline muted/><audio ref={audioRef} autoPlay playsInline/>{audioBlocked?<button className="stream-unlock-audio" onClick={()=>audioRef.current?.play().then(()=>setAudioBlocked(false)).catch(()=>{})}><Volume2 size={13}/>Ativar áudio</button>:null}</div>
  <footer><Volume2 size={13}/><input aria-label="Volume da transmissão" type="range" min="0" max="100" value={volume} onChange={event=>setVolume(Number(event.target.value))}/><b>{volume}%</b></footer>
 </section>;
}

export default function PersistentCallDock(){
 const [session,setSession]=useState<ActiveVoiceSession>({lobbyId:null,room:null,connected:false,participantCount:0,screenSharers:[]});
 const [muted,setMuted]=useState(false);
 const router=useRouter(),pathname=usePathname();
 const lite=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("desktop")==="lite";
 useEffect(()=>subscribeVoiceSession(next=>{setSession(next);const pub=next.room?.localParticipant.getTrackPublication(Track.Source.Microphone);setMuted(Boolean(pub?.isMuted))}),[]);
 useEffect(()=>{if(pathname==="/login"||pathname.startsWith("/login/")||pathname==="/register"||pathname.startsWith("/register/"))void disconnectActiveLiveKitVoice(true)},[pathname]);
 const localIdentity=session.room?.localParticipant.identity;
 const localShare=session.screenSharers.find(item=>item.userId===localIdentity)??null;
 const remoteShares=useMemo(()=>session.screenSharers.filter(item=>item.userId!==localIdentity),[session.screenSharers,localIdentity]);
 if(!session.room||!session.lobbyId)return null;
 const inLobby=pathname===`/lobby/${session.lobbyId}`;
 async function toggleMute(){const next=!muted;setMuted(next);await setLiveKitMicrophoneMuted(next)}
 const openLobby=()=>router.push(`/lobby/${session.lobbyId}${lite?"?desktop=lite":""}`);
 const stopLocalShare=()=>setLiveKitScreenShareEnabled(false).catch(()=>{});
 return <>
  {!lite&&!inLobby&&remoteShares.length?<PersistentScreenPreview session={session} onOpenLobby={openLobby}/>:null}
  <aside className={`persistent-call-dock ${lite?"persistent-call-dock-lite":""}`} aria-label="Call ativa">
   <div className="persistent-call-main">
    <span className={`persistent-call-status ${session.connected?"online":"reconnecting"}`}><Radio size={12}/>{session.connected?"CALL ATIVA":"RECONECTANDO"}</span>
    <button className="persistent-call-room" onClick={openLobby}><strong>GrindLobby em andamento</strong><small><Users size={12}/>{session.participantCount} na call</small></button>
    {localShare?<button className="persistent-call-share" onClick={()=>void stopLocalShare()} title="Parar sua transmissão"><MonitorUp size={14}/><span><b>Sua tela está ao vivo</b> · Parar transmissão</span><Square size={13}/></button>:remoteShares.length?<button className="persistent-call-share" onClick={openLobby}><MonitorUp size={14}/><span><b>{remoteShares[0].name}</b> está compartilhando a tela{remoteShares.length>1?` +${remoteShares.length-1}`:""}</span></button>:null}
   </div>
   <div className="persistent-call-actions">{!inLobby?<button onClick={openLobby}>Voltar à sala</button>:null}<button className={muted?"muted":""} onClick={()=>void toggleMute()} aria-label={muted?"Ativar microfone":"Mutar microfone"}>{muted?<MicOff size={16}/>:<Mic size={16}/>}</button>{localShare?<button onClick={()=>void stopLocalShare()} aria-label="Parar transmissão"><Square size={16}/></button>:null}<button className="hangup" onClick={()=>void disconnectActiveLiveKitVoice(true)} aria-label="Sair da call"><PhoneOff size={16}/></button></div>
  </aside>
 </>;
}

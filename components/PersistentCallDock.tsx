"use client";
import {useEffect,useMemo,useState} from "react";
import {usePathname,useRouter} from "next/navigation";
import {Mic,MicOff,MonitorUp,PhoneOff,Radio,Users} from "lucide-react";
import {Track} from "livekit-client";
import {disconnectActiveLiveKitVoice,setLiveKitMicrophoneMuted,subscribeVoiceSession,type ActiveVoiceSession} from "@/lib/webrtc/useLobbyVoice";

export default function PersistentCallDock(){
 const [session,setSession]=useState<ActiveVoiceSession>({lobbyId:null,room:null,connected:false,participantCount:0,screenSharers:[]});
 const [muted,setMuted]=useState(false);
 const router=useRouter(),pathname=usePathname();
 useEffect(()=>subscribeVoiceSession(next=>{setSession(next);const pub=next.room?.localParticipant.getTrackPublication(Track.Source.Microphone);setMuted(Boolean(pub?.isMuted))}),[]);
 const remoteShares=useMemo(()=>session.screenSharers.filter(item=>item.userId!==session.room?.localParticipant.identity),[session]);
 if(!session.room||!session.lobbyId)return null;
 const inLobby=pathname===`/lobby/${session.lobbyId}`;
 async function toggleMute(){const next=!muted;setMuted(next);await setLiveKitMicrophoneMuted(next)}
 return <aside className="persistent-call-dock" aria-label="Call ativa">
  <div className="persistent-call-main">
   <span className={`persistent-call-status ${session.connected?"online":"reconnecting"}`}><Radio size={12}/>{session.connected?"CALL ATIVA":"RECONECTANDO"}</span>
   <button className="persistent-call-room" onClick={()=>router.push(`/lobby/${session.lobbyId}`)}>
    <strong>GrindLobby em andamento</strong><small><Users size={12}/>{session.participantCount} na call</small>
   </button>
   {remoteShares.length?<button className="persistent-call-share" onClick={()=>router.push(`/lobby/${session.lobbyId}`)}><MonitorUp size={14}/><span><b>{remoteShares[0].name}</b> está compartilhando a tela{remoteShares.length>1?` +${remoteShares.length-1}`:""}</span></button>:null}
  </div>
  <div className="persistent-call-actions">
   {!inLobby?<button onClick={()=>router.push(`/lobby/${session.lobbyId}`)}>Voltar à sala</button>:null}
   <button className={muted?"muted":""} onClick={()=>void toggleMute()} aria-label={muted?"Ativar microfone":"Mutar microfone"}>{muted?<MicOff size={16}/>:<Mic size={16}/>}</button>
   <button className="hangup" onClick={()=>void disconnectActiveLiveKitVoice(true)} aria-label="Sair da call"><PhoneOff size={16}/></button>
  </div>
 </aside>;
}

"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {
  ArrowLeft,Check,Copy,Crown,Gamepad2,Globe,Loader2,LogOut,Mic,MicOff,
  MonitorUp,MoreVertical,Radio,Settings,Shield,UserPlus,Users,
} from "lucide-react";
import AudioHost from "@/components/AudioHost";
import RemoteVoiceAudio from "@/components/RemoteVoiceAudio";
import LovableBrand from "@/components/brand/LovableBrand";
import GrindLoading from "@/components/feedback/GrindLoading";
import ScreenShare from "@/components/stream/ScreenShare";
import {useLobbyVoice} from "@/lib/webrtc/useLobbyVoice";
import {loadAudioPreferences,playAudioEvent} from "@/lib/audio";

type Member={
  user_id:string;
  role:string;
  joined_at:string;
  profile?:{id:string;username:string;display_name:string;avatar:string|null;status:string};
};
type Lobby={
  id:string;owner_id:string;name:string;description:string|null;visibility:string;max_members:number;
  status:string;game?:{name:string;slug:string}|null;members:Member[];isMember:boolean;me:string;
};
type LobbyUser={id:string;account_tier?:string;app_role?:string};

function initials(value:string){return value.trim().slice(0,1).toUpperCase()||"G"}
function Waveform({level=0,muted=false}:{level?:number;muted?:boolean}){
  const active=Math.max(0,Math.min(1,level));
  return <span className="lovable-wave flex items-end gap-[2px]" aria-hidden="true">{Array.from({length:14}).map((_,index)=><span key={index} className={!muted&&index/14<=Math.max(.18,active)?"bg-primary-glow":"bg-muted"} style={{height:6+(index*7)%12}}/>)}</span>;
}

export default function LobbyRoom({id,user}:{id:string;user:LobbyUser}){
  const [lobby,setLobby]=useState<Lobby|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false);
  const [error,setError]=useState("");
  const [localStream,setLocalStream]=useState<MediaStream|null>(null);
  const router=useRouter();
  const voiceLobbyMembers=lobby?.members.map(member=>({
    userId:member.user_id,
    name:member.profile?.display_name||member.profile?.username||"Player",
    profileId:member.profile?.id??null,
    membershipId:null,
  }))??[];
  const {remotePeers,voiceMembers,setPeerVolume,togglePeerMuted,notifyVoiceLeave}=useLobbyVoice(id,user.id,voiceLobbyMembers,localStream);
  const roomConnected=useRef(false);
  const roomExitAnnounced=useRef(false);

  const load=useCallback(async()=>{
    try{
      const response=await fetch(`/api/lobbies/${id}`,{cache:"no-store"});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Falha ao carregar o lobby.");
      setLobby(body.lobby as Lobby);setError("");
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao carregar o lobby.")}
    finally{setLoading(false)}
  },[id]);

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),10_000);
    return()=>window.clearInterval(timer);
  },[load]);

  useEffect(()=>{
    if(lobby?.isMember&&!roomConnected.current){
      roomConnected.current=true;roomExitAnnounced.current=false;
      playAudioEvent("connected",loadAudioPreferences());
    }
  },[lobby?.isMember]);

  useEffect(()=>{
    if(!lobby?.isMember)return;
    let expired=false;
    const expire=()=>{
      if(expired)return;
      expired=true;
      if(roomConnected.current&&!roomExitAnnounced.current){roomExitAnnounced.current=true;playAudioEvent("disconnected",loadAudioPreferences())}
      const url=`/api/lobbies/${id}/leave`;
      if(navigator.sendBeacon)navigator.sendBeacon(url,new Blob([],{type:"application/json"}));
      else fetch(url,{method:"POST",keepalive:true}).catch(()=>{});
    };
    const heartbeat=()=>fetch(`/api/lobbies/${id}/heartbeat`,{method:"POST",keepalive:true}).then(response=>{if(response.status===401)expire()}).catch(()=>{});
    void heartbeat();
    const timer=window.setInterval(()=>void heartbeat(),10_000);
    window.addEventListener("pagehide",expire);
    return()=>{window.clearInterval(timer);window.removeEventListener("pagehide",expire);expire()};
  },[id,lobby?.isMember]);

  async function join(){
    setBusy(true);setError("");
    try{const response=await fetch(`/api/lobbies/${id}/join`,{method:"POST"});const body=await response.json();if(!response.ok)throw new Error(body.error||"Não foi possível entrar.");await load()}
    catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível entrar.")}
    finally{setBusy(false)}
  }
  async function leave(){
    setBusy(true);notifyVoiceLeave();
    const response=await fetch(`/api/lobbies/${id}/leave`,{method:"POST"});
    setBusy(false);
    if(response.ok){if(!roomExitAnnounced.current){roomExitAnnounced.current=true;playAudioEvent("disconnected",loadAudioPreferences())}router.push("/")}
    else setError("Não foi possível sair.");
  }
  async function copy(){
    try{await navigator.clipboard.writeText(location.href);setCopied(true);window.setTimeout(()=>setCopied(false),1500)}
    catch{setError("Não foi possível copiar o convite.")}
  }

  if(loading)return <main className="room-shell lovable-surface lovable-room"><GrindLoading variant="fullscreen" label="Entrando no lobby…"/></main>;
  if(!lobby)return <main className="room-shell lovable-surface lovable-room"><div className="room-loading">{error||"Lobby não encontrado."}</div></main>;

  const owner=lobby.members.find(member=>member.user_id===lobby.owner_id);
  const isPro=user.account_tier==="pro"||user.app_role==="admin";

  return <main className="room-shell lovable-surface lovable-room">
    <header className="room-top">
      <button onClick={()=>router.push("/")}><ArrowLeft size={17}/>Dashboard</button>
      <LovableBrand compact emblemSize={40}/>
      <button onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Copiado":"Convidar"}</button>
    </header>

    <div className="room-wrap">
      <section className="room-hero lovable-panel lovable-hero">
        <div className="gridfx"/><div className="glow"/>
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div><div className="eyebrow"><Radio size={13}/>LIVE LOBBY · {lobby.status.toUpperCase()}</div><h1>{lobby.name}</h1><p>{lobby.game?.name??"Jogo livre"} · Host: {owner?.profile?.display_name??owner?.profile?.username??"Player"}</p><div className="room-badges"><span><Users size={14}/>{lobby.members.length}/{lobby.max_members} players</span><span><Mic size={14}/>LiveKit voice</span><span><MonitorUp size={14}/>Screen share</span><span><Shield size={14}/>{lobby.visibility}</span></div></div>
          <div className="flex gap-3"><button onClick={copy} className="lovable-btn-ghost flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm"><UserPlus size={16}/>Convidar</button>{lobby.isMember?<button onClick={leave} disabled={busy} className="lovable-btn-ghost flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm"><LogOut size={16}/>Sair</button>:<button onClick={join} disabled={busy} className="lovable-btn-primary flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm">{busy?<Loader2 size={16} className="animate-spin"/>:<Gamepad2 size={16}/>}Entrar</button>}</div>
        </div>
      </section>

      {error?<div className="lovable-feedback lovable-feedback-error mt-4" role="alert">{error}</div>:null}
      <div className="room-grid">
        <section className="room-panel lovable-panel">
          <div className="section-head"><div><small>MEMBROS</small><h2>Squad ({lobby.members.length}/{lobby.max_members})</h2></div><span className="room-count">LIVEKIT</span></div>
          <ul className="lovable-member-list mt-3 rounded-xl border border-border bg-panel/40 px-3">
            {lobby.members.map(member=>{
              const voice=voiceMembers.find(item=>item.userId===member.user_id);
              const peer=remotePeers.find(item=>item.userId===member.user_id);
              const voiceActive=Boolean(voice?.connected);
              const speaking=Boolean(voice?.speaking||(voice?.audioLevel??0)>.02);
              const memberName=member.profile?.display_name||member.profile?.username||"Player";
              return <li className={`flex flex-wrap items-center gap-3 py-3 ${speaking?"member-speaking":""}`} key={member.user_id}>
                <span className="relative"><span className="lovable-avatar grid h-9 w-9 place-items-center rounded-full font-display text-xs font-bold">{initials(memberName)}</span><span className={`lovable-presence-dot absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${voiceActive?"bg-success":"bg-muted"}`}/></span>
                <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-sm font-semibold">{memberName}{member.role==="owner"?<Crown size={14} className="text-warning"/>:null}</p><p className="text-xs text-muted-foreground">@{member.profile?.username??"player"}{voiceActive?` · ${voice?.status||"Connected"}`:" · OFF"}</p></div>
                <div className="ml-auto flex items-center gap-3">{voice?.microphoneMuted?<MicOff size={16} className="text-destructive"/>:<Mic size={16} className="text-muted-foreground"/>}<Waveform level={voice?.audioLevel} muted={!voiceActive||voice?.microphoneMuted}/><span className={member.role==="owner"?"rounded-md border border-primary/40 bg-primary/20 px-2 py-1 text-[10px] font-bold":"lovable-label"}>{member.role==="owner"?"HOST":"MEMBRO"}</span><MoreVertical size={16} className="text-muted-foreground"/></div>
                {peer?<div className="remote-voice-controls w-full"><RemoteVoiceAudio stream={peer.stream} volume={peer.volume} muted={peer.muted}/><button onClick={()=>togglePeerMuted(member.user_id)}>{peer.muted?"Desmutar":"Mutar"}</button><label>Volume <input aria-label={`Volume de ${memberName}`} type="range" min="0" max="200" value={peer.volume} onChange={event=>setPeerVolume(member.user_id,Number(event.target.value))}/><b>{peer.volume}%</b></label></div>:null}
              </li>;
            })}
          </ul>
        </section>

        <aside className="room-side">
          <AudioHost enabled={lobby.isMember} onStreamChange={setLocalStream}/>
          {lobby.isMember?<ScreenShare isPro={isPro}/>:null}
          <section className="room-panel lovable-panel"><small>SESSÃO</small><h2>Pronto para jogar</h2><p>A membership do lobby vem do Supabase; presença, mute, fala e áudio da call vêm exclusivamente do LiveKit.</p><div className="mt-4 grid gap-2 text-sm"><span className="flex items-center justify-between rounded-lg border border-border bg-panel px-3 py-2"><span className="flex items-center gap-2 text-muted-foreground"><Globe size={15}/>Visibilidade</span><b>{lobby.visibility}</b></span><span className="flex items-center justify-between rounded-lg border border-border bg-panel px-3 py-2"><span className="flex items-center gap-2 text-muted-foreground"><MonitorUp size={15}/>Qualidade</span><b>{isPro?"1080p60":"720p30"}</b></span></div>{lobby.owner_id===user.id?<button className="lovable-btn-ghost mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm"><Settings size={15}/>Você é o host</button>:null}</section>
        </aside>
      </div>
    </div>
  </main>;
}

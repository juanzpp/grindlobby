"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {
  Check,Copy,Crown,Gamepad2,Headphones,Loader2,LogOut,Mic,MicOff,MonitorUp,
  MoreVertical,PhoneOff,Settings,Share2,Shield,Users,Volume2,Workflow,
} from "lucide-react";
import AudioHost from "@/components/AudioHost";
import RemoteVoiceAudio from "@/components/RemoteVoiceAudio";
import GrindLoading from "@/components/feedback/GrindLoading";
import ScreenShare from "@/components/stream/ScreenShare";
import {setLiveKitMicrophoneGain,setLiveKitMicrophoneMuted,useLobbyVoice} from "@/lib/webrtc/useLobbyVoice";
import {useVoiceTelemetry} from "@/lib/webrtc/useVoiceTelemetry";
import {loadAudioPreferences,playAudioEvent} from "@/lib/audio";
import {getGameLobbyTheme} from "@/lib/lobby-game-theme";
import {retainLobbyPresenceHeartbeat} from "@/lib/lobby-presence-heartbeat";

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

function LevelBars({level=0,muted=false}:{level?:number;muted?:boolean}){
  const active=muted?0:Math.max(.14,Math.min(1,level));
  return <span className="dvr-levels" aria-hidden="true">{Array.from({length:5}).map((_,index)=><i key={index} className={index/5<active?"on":""} style={{height:6+index*2}}/>)}</span>;
}

export default function LobbyRoom({id,user}:{id:string;user:LobbyUser}){
  const [lobby,setLobby]=useState<Lobby|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false);
  const [error,setError]=useState("");
  const [localStream,setLocalStream]=useState<MediaStream|null>(null);
  const [localMicGain,setLocalMicGain]=useState(125);
  const router=useRouter();
  const voiceLobbyMembers=lobby?.members.map(member=>({
    userId:member.user_id,
    name:member.profile?.display_name||member.profile?.username||"Player",
    profileId:member.profile?.id??null,
    membershipId:null,
  }))??[];
  const {remotePeers,voiceMembers,setPeerVolume,togglePeerMuted,notifyVoiceLeave}=useLobbyVoice(id,user.id,voiceLobbyMembers,localStream);
  useVoiceTelemetry(id,Boolean(lobby?.isMember));
  const roomConnected=useRef(false);
  const roomExitAnnounced=useRef(false);
  const loadGeneration=useRef(0);
  const loadController=useRef<AbortController|null>(null);

  const load=useCallback(async()=>{
    const generation=++loadGeneration.current;
    loadController.current?.abort();
    const controller=new AbortController();
    loadController.current=controller;
    try{
      const response=await fetch(`/api/lobbies/${id}`,{cache:"no-store",signal:controller.signal});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Falha ao carregar o lobby.");
      if(generation!==loadGeneration.current)return;
      setLobby(body.lobby as Lobby);setError("");
    }catch(cause){
      if(controller.signal.aborted)return;
      if(generation===loadGeneration.current)setError(cause instanceof Error?cause.message:"Falha ao carregar o lobby.");
    }finally{
      if(generation===loadGeneration.current){setLoading(false);if(loadController.current===controller)loadController.current=null}
    }
  },[id]);

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),10_000);
    return()=>{window.clearInterval(timer);loadController.current?.abort()};
  },[load]);

  useEffect(()=>{
    if(lobby?.isMember&&!roomConnected.current){roomConnected.current=true;roomExitAnnounced.current=false;playAudioEvent("connected",loadAudioPreferences())}
  },[lobby?.isMember]);

  useEffect(()=>{
    if(!lobby?.isMember)return;
    let expired=false;
    const expire=()=>{
      if(expired)return;expired=true;
      if(roomConnected.current&&!roomExitAnnounced.current){roomExitAnnounced.current=true;playAudioEvent("disconnected",loadAudioPreferences())}
      const url=`/api/lobbies/${id}/leave`;
      if(navigator.sendBeacon)navigator.sendBeacon(url,new Blob([],{type:"application/json"}));
      else fetch(url,{method:"POST",keepalive:true}).catch(()=>{});
    };
    const releaseHeartbeat=retainLobbyPresenceHeartbeat(id,status=>{if(status===401)expire()});
    window.addEventListener("pagehide",expire);
    return()=>{releaseHeartbeat();window.removeEventListener("pagehide",expire)};
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
    if(!lobby)return;
    try{
      let inviteUrl=location.href;
      if(lobby.visibility!=="public"){
        if(lobby.owner_id!==user.id){setError("Apenas o host pode criar convites para este lobby privado.");return}
        const response=await fetch(`/api/lobbies/${id}/invites`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({maxUses:25,hours:24})});
        const body=await response.json();
        if(!response.ok||!body.path)throw new Error(body.error||"Não foi possível criar o convite.");
        inviteUrl=`${location.origin}${body.path}`;
      }
      await navigator.clipboard.writeText(inviteUrl);setCopied(true);setError("");window.setTimeout(()=>setCopied(false),1500);
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível copiar o convite.")}
  }

  if(loading)return <main className="desktop-voice-room"><GrindLoading variant="fullscreen" label="Entrando no lobby…"/></main>;
  if(!lobby)return <main className="desktop-voice-room"><div className="room-loading">{error||"Lobby não encontrado."}</div></main>;

  const owner=lobby.members.find(member=>member.user_id===lobby.owner_id);
  const currentMember=lobby.members.find(member=>member.user_id===user.id);
  const meName=currentMember?.profile?.display_name||currentMember?.profile?.username||"Player";
  const isPro=user.account_tier==="pro"||user.app_role==="admin";
  const gameTheme=getGameLobbyTheme(lobby.game?.slug,lobby.game?.name);
  const localVoice=voiceMembers.find(item=>item.userId===user.id);
  const localMuted=Boolean(localVoice?.microphoneMuted);
  const visibleMembers=lobby.members.slice(0,6);

  function toggleLocalMute(){void setLiveKitMicrophoneMuted(!localMuted)}
  function setLocalGain(next:number){setLocalMicGain(next);setLiveKitMicrophoneGain(next)}

  return <main className="desktop-voice-room">
    {error?<div className="dvr-error" role="alert">{error}</div>:null}
    <div className="dvr-shell">
      <aside className="dvr-left">
        <div className="dvr-brand"><img src="/brand/grindlobby-official.png" alt=""/><strong>GrindLobby</strong></div>
        <div className="dvr-room-meta">
          <div className="dvr-room-avatar">{initials(lobby.name)}</div>
          <div><h2>{lobby.name}</h2><p>Squad Room · <span>● {lobby.members.length} Online</span></p></div>
        </div>
        <div className="dvr-room-label">ROOMS</div>
        <div className="dvr-room-list">
          <button className="dvr-room-item active"><Headphones size={17}/><span>Main Voice Room</span><small>{lobby.members.length}/{lobby.max_members}</small></button>
          <button className="dvr-room-item" title="Estratégia integrada ao Grind Board"><Workflow size={17}/><span>Strategy Hub</span><small>↗</small></button>
          <button className="dvr-room-item"><Gamepad2 size={17}/><span>Match Room</span><small>{lobby.visibility!=="public"?"🔒":""}</small></button>
        </div>
        <div className="dvr-left-user">
          <div className="dvr-user-avatar">{currentMember?.profile?.avatar?<img src={currentMember.profile.avatar} alt=""/>:initials(meName)}</div>
          <div><b>{meName}</b><span>● Online</span></div>
          <button className="dvr-icon-btn" style={{marginLeft:"auto"}} aria-label="Configurações"><Settings size={15}/></button>
        </div>
      </aside>

      <header className="dvr-top">
        <nav className="dvr-top-tabs" aria-label="Sala">
          <button className="dvr-tab active"><Headphones size={16}/>Voice</button>
          <button className="dvr-tab"><Workflow size={16}/>Strategy</button>
          <button className="dvr-tab"><Gamepad2 size={16}/>Match</button>
        </nav>
        <div className="dvr-top-actions">
          <button className="dvr-invite" onClick={copy}>{copied?<Check size={14}/>:<Share2 size={14}/>} {copied?"Copiado":"Convidar"}</button>
          <button className="dvr-icon-btn" aria-label="Mais"><MoreVertical size={16}/></button>
        </div>
      </header>

      <section className="dvr-main">
        <div className="dvr-share-card">
          <div className="dvr-share-head">
            <MonitorUp size={15}/><b>Screen Share</b>
            <span>{owner?.profile?.display_name||owner?.profile?.username||"Host"}</span>
            <span className="live">LIVE</span>
            <span className="dvr-share-spacer"/>
            <span className="dvr-chip">{isPro?"1080p 60fps":"720p 30fps"}</span>
            <span className="dvr-chip good">● Low Latency</span>
          </div>
          <div className="dvr-screen-wrap">
            {lobby.isMember?<ScreenShare isPro={isPro} gameName={gameTheme.label} gameBanner={gameTheme.banner}/>:<div className="dvr-empty-share"><div><MonitorUp size={30}/><h3>Entre na sala para assistir</h3><p>A transmissão abre aqui sem esconder os controles da call.</p></div></div>}
          </div>
        </div>

        <div className="dvr-people-strip">
          {visibleMembers.map(member=>{
            const voice=voiceMembers.find(item=>item.userId===member.user_id);
            const peer=remotePeers.find(item=>item.userId===member.user_id);
            const isLocal=member.user_id===user.id;
            const memberName=member.profile?.display_name||member.profile?.username||"Player";
            const muted=Boolean(voice?.microphoneMuted)||(!isLocal&&Boolean(peer?.muted));
            return <article key={member.user_id} className={`dvr-person-card ${isLocal?"me":""}`}>
              <div className="dvr-member-avatar">{member.profile?.avatar?<img src={member.profile.avatar} alt=""/>:initials(memberName)}</div>
              <b>{memberName}</b><small>{isLocal?"You":voice?.speaking?"Speaking":"Connected"}</small>
              {muted?<MicOff className="mute" size={14}/>:null}
            </article>;
          })}
        </div>
      </section>

      <aside className="dvr-right">
        <section className="dvr-participants">
          <div className="dvr-side-head"><b>Participants {lobby.members.length} / {lobby.max_members}</b><Users size={15}/></div>
          <div className="dvr-participant-list">
            {lobby.members.map(member=>{
              const voice=voiceMembers.find(item=>item.userId===member.user_id);
              const peer=remotePeers.find(item=>item.userId===member.user_id);
              const isLocal=member.user_id===user.id;
              const memberName=member.profile?.display_name||member.profile?.username||"Player";
              const locallyMuted=!isLocal&&Boolean(peer?.muted);
              const muted=Boolean(voice?.microphoneMuted)||locallyMuted;
              const level=voice?.audioLevel??0;
              const speaking=Boolean(voice?.speaking||level>.02);
              const changeMute=()=>{
                if(isLocal){void setLiveKitMicrophoneMuted(!Boolean(voice?.microphoneMuted));return}
                if(peer)togglePeerMuted(member.user_id);
              };
              return <div className="dvr-participant" key={member.user_id}>
                <div className="dvr-member-avatar">{member.profile?.avatar?<img src={member.profile.avatar} alt=""/>:initials(memberName)}</div>
                <div><strong>{memberName}{member.role==="owner"?<Crown size={12} color="#e7b94d"/>:null}</strong><p className={speaking?"speaking":""}>{isLocal?"You":speaking?"Speaking":voice?.connected?"Connected":"Offline"}</p></div>
                <div className="dvr-participant-actions">
                  {peer?<RemoteVoiceAudio stream={peer.stream} volume={peer.volume} muted={peer.muted}/>:null}
                  <button className={`dvr-mini-action ${muted?"muted":""}`} onClick={changeMute} disabled={!voice?.connected&&!(peer&&peer.stream)} aria-label={muted?`Desmutar ${memberName}`:`Mutar ${memberName}`}>{muted?<MicOff size={14}/>:<Mic size={14}/>}</button>
                  <LevelBars level={level} muted={muted}/>
                </div>
              </div>;
            })}
          </div>
        </section>
        <section className="dvr-voice-controls">
          <AudioHost enabled={lobby.isMember} onStreamChange={setLocalStream}/>
          <label style={{display:"flex",alignItems:"center",gap:8,marginTop:10,fontSize:10,color:"#7e8ca1"}}><Volume2 size={13}/>Seu ganho<input type="range" min="0" max="200" value={localMicGain} onChange={event=>setLocalGain(Number(event.target.value))} style={{flex:1}}/><b style={{color:"#b9c5d6"}}>{localMicGain}%</b></label>
        </section>
      </aside>

      <footer className="dvr-bottom">
        <div className="dvr-bottom-group"><span><i className="dvr-good-dot"/>LOW LATENCY <strong>18ms</strong></span><span>⚡ OPTIMIZED DESKTOP CLIENT</span><span>◈ MINIMAL RESOURCE MODE</span></div>
        <div className="dvr-center-controls">
          <button className="dvr-bottom-btn" onClick={()=>router.push("/")} aria-label="Minimizar sala"><MonitorUp size={16}/></button>
          <button className="dvr-bottom-btn primary" onClick={toggleLocalMute} aria-label={localMuted?"Ativar microfone":"Mutar microfone"}>{localMuted?<MicOff size={20}/>:<Mic size={20}/>}</button>
          <button className="dvr-bottom-btn danger" onClick={leave} disabled={busy} aria-label="Sair da sala"><PhoneOff size={18}/></button>
        </div>
        <div className="dvr-bottom-group"><span><i className="dvr-good-dot"/>VOICE LIVE</span><span>SFU</span><span>{lobby.isMember?"CONNECTED":"READY"}</span></div>
      </footer>
    </div>
  </main>;
}

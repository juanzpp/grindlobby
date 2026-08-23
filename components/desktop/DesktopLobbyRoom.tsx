"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {
  CalendarDays,Check,Crown,Gamepad2,Headphones,Home,Loader2,LogOut,MessageSquare,Mic,MicOff,
  MonitorUp,MoreHorizontal,PhoneOff,Search,Settings,Share2,Shield,Store,Trophy,UserRound,Users,Volume2,Workflow,
} from "lucide-react";
import AudioHost from "@/components/AudioHost";
import RemoteVoiceAudio from "@/components/RemoteVoiceAudio";
import GrindLoading from "@/components/feedback/GrindLoading";
import LobbyChat from "@/components/lobby/LobbyChat";
import ScreenShare from "@/components/stream/ScreenShare";
import {
  getLiveKitMediaRttMs,setLiveKitMicrophoneGain,setLiveKitMicrophoneMuted,subscribeVoiceSession,useLobbyVoice,
} from "@/lib/webrtc/useLobbyVoice";
import {useVoiceTelemetry} from "@/lib/webrtc/useVoiceTelemetry";
import {loadAudioPreferences,playAudioEvent} from "@/lib/audio";
import {getGameLobbyTheme} from "@/lib/lobby-game-theme";
import {retainLobbyPresenceHeartbeat} from "@/lib/lobby-presence-heartbeat";

type Member={user_id:string;role:string;joined_at:string;profile?:{id:string;username:string;display_name:string;avatar:string|null;status:string}};
type Lobby={id:string;owner_id:string;name:string;description:string|null;visibility:string;max_members:number;status:string;game?:{name:string;slug:string}|null;members:Member[];isMember:boolean;me:string};
type LobbyUser={id:string;account_tier?:string;app_role?:string};
type Tab="call"|"lobby"|"strategy"|"match";
type Mode="standard"|"lite";

function initials(value:string){return value.trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()||"GL"}
function memberName(member?:Member|null){return member?.profile?.display_name||member?.profile?.username||"Player"}
function Avatar({member,size="md"}:{member?:Member|null;size?:"sm"|"md"|"lg"}){const name=memberName(member);return <span className={`nd-avatar ${size}`}>{member?.profile?.avatar?<img src={member.profile.avatar} alt=""/>:initials(name)}</span>}
function LevelBars({level=0,muted=false}:{level?:number;muted?:boolean}){const active=muted?0:Math.max(.12,Math.min(1,level));return <span className="nd-levels" aria-hidden="true">{Array.from({length:5}).map((_,index)=><i key={index} className={index/5<active?"on":""}/>)}</span>}

export default function DesktopLobbyRoom({id,user,mode="standard"}:{id:string;user:LobbyUser;mode?:Mode}){
  const router=useRouter();
  const [lobby,setLobby]=useState<Lobby|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false);
  const [error,setError]=useState("");
  const [tab,setTab]=useState<Tab>("call");
  const [localStream,setLocalStream]=useState<MediaStream|null>(null);
  const [localMicGain,setLocalMicGain]=useState(125);
  const [session,setSession]=useState({connected:false,participantCount:0,screenSharers:[] as {userId:string;name:string}[]});
  const [rttMs,setRttMs]=useState<number|null>(null);
  const roomConnected=useRef(false),roomExitAnnounced=useRef(false),loadGeneration=useRef(0),loadController=useRef<AbortController|null>(null);

  const voiceLobbyMembers=useMemo(()=>lobby?.members.map(member=>({userId:member.user_id,name:memberName(member),profileId:member.profile?.id??null,membershipId:null}))??[],[lobby?.members]);
  const {remotePeers,voiceMembers,setPeerVolume,togglePeerMuted,notifyVoiceLeave}=useLobbyVoice(id,user.id,voiceLobbyMembers,localStream);
  useVoiceTelemetry(id,Boolean(lobby?.isMember));

  const load=useCallback(async()=>{
    const generation=++loadGeneration.current;loadController.current?.abort();const controller=new AbortController();loadController.current=controller;
    try{const response=await fetch(`/api/lobbies/${id}`,{cache:"no-store",signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.error||"Falha ao carregar o lobby.");if(generation!==loadGeneration.current)return;setLobby(body.lobby as Lobby);setError("")}
    catch(cause){if(controller.signal.aborted)return;if(generation===loadGeneration.current)setError(cause instanceof Error?cause.message:"Falha ao carregar o lobby.")}
    finally{if(generation===loadGeneration.current){setLoading(false);if(loadController.current===controller)loadController.current=null}}
  },[id]);

  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),10_000);return()=>{window.clearInterval(timer);loadController.current?.abort()}},[load]);
  useEffect(()=>subscribeVoiceSession(value=>setSession({connected:value.connected,participantCount:value.participantCount,screenSharers:value.screenSharers})),[]);
  useEffect(()=>{if(!session.connected){setRttMs(null);return}let disposed=false;const sample=()=>void getLiveKitMediaRttMs().then(value=>{if(!disposed)setRttMs(value)}).catch(()=>{if(!disposed)setRttMs(null)});sample();const timer=window.setInterval(sample,5000);return()=>{disposed=true;window.clearInterval(timer)}},[session.connected]);
  useEffect(()=>{if(lobby?.isMember&&!roomConnected.current){roomConnected.current=true;roomExitAnnounced.current=false;playAudioEvent("connected",loadAudioPreferences())}},[lobby?.isMember]);
  useEffect(()=>{if(!lobby?.isMember)return;let expired=false;const expire=()=>{if(expired)return;expired=true;if(roomConnected.current&&!roomExitAnnounced.current){roomExitAnnounced.current=true;playAudioEvent("disconnected",loadAudioPreferences())}const url=`/api/lobbies/${id}/leave`;if(navigator.sendBeacon)navigator.sendBeacon(url,new Blob([],{type:"application/json"}));else fetch(url,{method:"POST",keepalive:true}).catch(()=>{})};const releaseHeartbeat=retainLobbyPresenceHeartbeat(id,status=>{if(status===401||status===404||status===410)expire()});window.addEventListener("pagehide",expire);return()=>{releaseHeartbeat();window.removeEventListener("pagehide",expire)}},[id,lobby?.isMember]);

  async function join(){setBusy(true);setError("");try{const response=await fetch(`/api/lobbies/${id}/join`,{method:"POST"});const body=await response.json();if(!response.ok)throw new Error(body.error||"Não foi possível entrar.");await load()}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível entrar.")}finally{setBusy(false)}}
  async function leave(){setBusy(true);notifyVoiceLeave();try{const response=await fetch(`/api/lobbies/${id}/leave`,{method:"POST"});if(!response.ok)throw new Error();if(!roomExitAnnounced.current){roomExitAnnounced.current=true;playAudioEvent("disconnected",loadAudioPreferences())}router.push(mode==="lite"?"/desktop-lite?desktop=lite":"/?desktop=1")}catch{setError("Não foi possível sair da sala.")}finally{setBusy(false)}}
  async function copy(){if(!lobby)return;try{let inviteUrl=`${location.origin}/lobby/${lobby.id}${mode==="lite"?"?desktop=lite":"?desktop=1"}`;if(lobby.visibility!=="public"){if(lobby.owner_id!==user.id){setError("Apenas o host pode criar convites para este lobby privado.");return}const response=await fetch(`/api/lobbies/${id}/invites`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({maxUses:25,hours:24})});const body=await response.json();if(!response.ok||!body.path)throw new Error(body.error||"Não foi possível criar o convite.");inviteUrl=`${location.origin}${body.path}${body.path.includes("?")?"&":"?"}desktop=${mode==="lite"?"lite":"1"}`}await navigator.clipboard.writeText(inviteUrl);setCopied(true);setError("");window.setTimeout(()=>setCopied(false),1400)}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível copiar o convite.")}}

  if(loading)return <main className="native-desktop-room"><GrindLoading variant="fullscreen" label="Entrando no lobby…"/></main>;
  if(!lobby)return <main className="native-desktop-room"><div className="nd-fatal">{error||"Lobby não encontrado."}</div></main>;

  const owner=lobby.members.find(member=>member.user_id===lobby.owner_id),currentMember=lobby.members.find(member=>member.user_id===user.id);
  const isPro=user.account_tier==="pro"||user.app_role==="admin",gameTheme=getGameLobbyTheme(lobby.game?.slug,lobby.game?.name),localVoice=voiceMembers.find(item=>item.userId===user.id),localMuted=Boolean(localVoice?.microphoneMuted);
  const shareActive=session.screenSharers.length>0,shareName=session.screenSharers[0]?.name??"";
  const navigate=(path:string)=>router.push(`${path}${path.includes("?")?"&":"?"}desktop=${mode==="lite"?"lite":"1"}`);
  const setGain=(next:number)=>{setLocalMicGain(next);setLiveKitMicrophoneGain(next)};

  const participantCards=lobby.members.slice(0,5).map(member=>{const voice=voiceMembers.find(item=>item.userId===member.user_id),peer=remotePeers.find(item=>item.userId===member.user_id),muted=Boolean(voice?.microphoneMuted)||Boolean(peer?.muted),speaking=Boolean(voice?.speaking||(voice?.audioLevel??0)>.02);return <article key={member.user_id} className={`nd-call-card ${speaking?"speaking":""} ${member.user_id===user.id?"me":""}`}><Avatar member={member} size="lg"/><div className="nd-call-card-name"><b>{memberName(member)}</b>{member.role==="owner"?<Crown size={12}/>:null}</div><small>{member.user_id===user.id?"Você":speaking?"Falando":voice?.connected?"Conectado":"Offline"}</small><span className={`nd-call-mic ${muted?"muted":""}`}>{muted?<MicOff size={13}/>:<Mic size={13}/>}</span></article>});

  return <main className={`native-desktop-room ${mode==="lite"?"is-lite":""}`}>
    {error?<div className="nd-toast" role="alert">{error}</div>:null}
    <div className="nd-window">
      <aside className="nd-rail">
        <button className="nd-logo" onClick={()=>navigate(mode==="lite"?"/desktop-lite":"/")} aria-label="Início"><img src="/brand/grindlobby-official.png" alt=""/></button>
        <nav aria-label="Navegação do cliente"><button onClick={()=>navigate("/")} title="Início"><Home/></button><button onClick={()=>navigate("/community")} title="Comunidades"><Users/></button><button className="active" title="Voz"><Mic/></button><button onClick={()=>navigate("/competitive/valorant")} title="Matchmaking"><Trophy/></button><button onClick={()=>navigate("/competitive/valorant")} title="Eventos"><CalendarDays/></button><button onClick={()=>navigate("/loja")} title="Loja"><Store/></button></nav>
        <div className="nd-rail-spacer"/><nav><button onClick={()=>navigate("/profile")} title="Perfil"><UserRound/></button><button onClick={()=>navigate("/settings")} title="Configurações"><Settings/></button></nav>
      </aside>

      <aside className="nd-room-sidebar">
        <div className="nd-room-title"><Headphones size={15}/><div><b>{lobby.name}</b><small>{gameTheme.label}</small></div><MoreHorizontal size={15}/></div>
        <div className="nd-private"><Shield size={12}/>{lobby.visibility==="public"?"Lobby público":"Lobby privado"}</div>
        <p className="nd-section-label">MEMBROS · {lobby.members.length}/{lobby.max_members}</p>
        <div className="nd-member-list">{lobby.members.map(member=>{const voice=voiceMembers.find(item=>item.userId===member.user_id),peer=remotePeers.find(item=>item.userId===member.user_id),muted=Boolean(voice?.microphoneMuted)||Boolean(peer?.muted);return <div key={member.user_id} className="nd-member-row"><Avatar member={member} size="sm"/><span><b>{memberName(member)}</b><small>{member.role==="owner"?"Líder":voice?.connected?"Na call":"No lobby"}</small></span>{muted?<MicOff size={13}/>:voice?.connected?<Mic size={13}/>:null}</div>})}</div>
        <p className="nd-section-label">CANAIS</p>
        <div className="nd-channel-list"><button className={tab==="call"?"active":""} onClick={()=>setTab("call")}><Headphones/><span>Squad Lobby<small>{session.participantCount||lobby.members.length} na voz</small></span></button><button className={tab==="strategy"?"active":""} onClick={()=>setTab("strategy")}><Workflow/><span>Strategy<small>Grind Board competitivo</small></span></button><button className={tab==="match"?"active":""} onClick={()=>setTab("match")}><Gamepad2/><span>Match Info<small>{gameTheme.label}</small></span></button></div>
        <div className="nd-sidebar-status"><span className={session.connected?"online":""}><i/>{session.connected?"Voice Connected":"Voice Ready"}</span><small>{session.connected?`${session.participantCount} participante${session.participantCount===1?"":"s"}`:"Entre no áudio para conectar"}</small><div><button onClick={()=>void setLiveKitMicrophoneMuted(!localMuted)} className={localMuted?"danger":""}>{localMuted?<MicOff/>:<Mic/>}</button><button onClick={()=>setTab("call")}><Headphones/></button><button onClick={()=>setTab("call")}><Settings/></button><button onClick={()=>void leave()}><LogOut/></button></div></div>
      </aside>

      <header className="nd-topbar"><div className="nd-search"><Search size={15}/><span>Buscar jogadores, squads ou jogos…</span><kbd>Ctrl K</kbd></div><nav className="nd-tabs"><button className={tab==="lobby"?"active":""} onClick={()=>setTab("lobby")}>Lobby</button><button className={tab==="call"?"active":""} onClick={()=>setTab("call")}>Call</button><button className={tab==="strategy"?"active":""} onClick={()=>setTab("strategy")}>Strategy</button><button className={tab==="match"?"active":""} onClick={()=>setTab("match")}>Match Info</button></nav><div className="nd-top-actions"><button onClick={()=>void copy()}>{copied?<Check/>:<Share2/>}<span>{copied?"Copiado":"Convidar"}</span></button><Avatar member={currentMember} size="sm"/></div></header>

      <section className="nd-content">
        {tab==="call"?<>
          <div className="nd-call-head"><span className={session.connected?"online":""}><i/>CALL ATIVA</span><div className="nd-live-wave">{voiceMembers.some(v=>v.speaking)?"Voz detectada":"Aguardando voz"}</div><span>{rttMs==null?"RTT —":`RTT ${rttMs} ms`}</span></div>
          <div className="nd-call-grid">{participantCards}{lobby.members.length<5?Array.from({length:5-lobby.members.length}).map((_,i)=><button className="nd-call-card empty" key={`empty-${i}`} onClick={()=>void copy()}><Users/><b>Convidar</b><small>Slot disponível</small></button>):null}</div>
          <div className="nd-media-grid"><div className="nd-share-panel"><div className="nd-panel-head"><span><MonitorUp/>Transmissão</span><small className={shareActive?"live":""}>{shareActive?`${shareName} está transmitindo`:"Nenhuma transmissão ativa"}</small></div><div className="nd-share-stage">{lobby.isMember?<ScreenShare isPro={isPro} gameName={gameTheme.label} gameBanner={gameTheme.banner}/>:<div className="nd-empty"><MonitorUp/><b>Entre no lobby</b><span>A transmissão aparece aqui.</span></div>}</div></div><div className="nd-chat-panel"><LobbyChat lobbyId={lobby.id} members={voiceLobbyMembers.map(member=>({userId:member.userId,name:member.name}))}/></div></div>
          <div className="nd-quick-audio"><div><small>Entrada</small><b>Microfone atual</b><span><i style={{width:`${Math.min(100,localMicGain/2)}%`}}/></span></div><button onClick={()=>void setLiveKitMicrophoneMuted(!localMuted)} className={localMuted?"danger":""}>{localMuted?<MicOff/>:<Mic/>}<span>{localMuted?"Microfone mudo":"Microfone ativo"}</span></button><label><small>Ganho</small><input type="range" min="0" max="200" value={localMicGain} onChange={event=>setGain(Number(event.target.value))}/><b>{localMicGain}%</b></label><button onClick={()=>setTab("lobby")}><Settings/><span>Configurar</span></button></div>
        </>:null}

        {tab==="lobby"?<div className="nd-lobby-overview"><div className="nd-overview-hero"><span>LOBBY</span><h1>{lobby.name}</h1><p>{lobby.description||`${gameTheme.label} · ${lobby.members.length}/${lobby.max_members} jogadores`}</p><div><button onClick={()=>setTab("call")}><Headphones/>Abrir call</button>{!lobby.isMember?<button className="primary" onClick={()=>void join()} disabled={busy}>{busy?<Loader2 className="spin"/>:<Users/>}Entrar</button>:<button className="danger" onClick={()=>void leave()}><LogOut/>Sair</button>}</div></div><div className="nd-roster">{lobby.members.map(member=><article key={member.user_id}><Avatar member={member} size="md"/><div><b>{memberName(member)}</b><small>@{member.profile?.username||"player"}</small></div><span>{member.role==="owner"?"LÍDER":"MEMBRO"}</span></article>)}</div></div>:null}

        {tab==="strategy"?<div className="nd-feature-state"><Workflow/><span>STRATEGY</span><h2>Grind Board</h2><p>O board colaborativo é liberado dentro de uma partida competitiva vinculada. Esta sala comum continua isolada para não misturar estratégia privada com lobby público.</p><button onClick={()=>navigate("/competitive/valorant")}><Trophy/>Abrir competitivo</button></div>:null}
        {tab==="match"?<div className="nd-feature-state"><Gamepad2/><span>MATCH INFO</span><h2>{gameTheme.label}</h2><p>{lobby.description||"Esta sala não está vinculada a uma partida competitiva ativa. Quando houver match, mapa, squad e status aparecem aqui em tempo real."}</p><button onClick={()=>navigate("/competitive/valorant")}><Trophy/>Ver matchmaking</button></div>:null}
      </section>

      <aside className="nd-context"><section><div className="nd-context-title"><b>DETALHES DA SALA</b><Shield/></div><dl><div><dt>Privacidade</dt><dd>{lobby.visibility}</dd></div><div><dt>Jogo</dt><dd>{gameTheme.label}</dd></div><div><dt>Capacidade</dt><dd>{lobby.members.length}/{lobby.max_members}</dd></div><div><dt>Voz</dt><dd className={session.connected?"good":""}>{session.connected?"Conectada":"Pronta"}</dd></div><div><dt>RTT WebRTC</dt><dd>{rttMs==null?"—":`${rttMs} ms`}</dd></div></dl></section><section><div className="nd-context-title"><b>HOST</b><Crown/></div><div className="nd-host"><Avatar member={owner} size="md"/><div><b>{memberName(owner)}</b><small>@{owner?.profile?.username||"player"}</small></div></div></section><section><div className="nd-context-title"><b>ÁUDIO</b><Volume2/></div><AudioHost enabled={lobby.isMember} onStreamChange={setLocalStream}/></section></aside>

      <footer className="nd-callbar"><div><span className={session.connected?"good":""}><i/>{session.connected?"VOICE CONNECTED":"VOICE READY"}</span><small>{mode==="lite"?"PERFORMANCE CLIENT":"STANDARD DESKTOP"}</small></div><div className="nd-callbar-actions"><button onClick={()=>void setLiveKitMicrophoneMuted(!localMuted)} className={localMuted?"danger":""}>{localMuted?<MicOff/>:<Mic/>}</button><button onClick={()=>setTab("call")}><Headphones/></button><button onClick={()=>void copy()}><Share2/></button><button className="leave" onClick={()=>void leave()} disabled={busy}><PhoneOff/></button></div><div><small>{shareActive?"SCREEN SHARE ACTIVE":"NO SCREEN SHARE"}</small><span>{rttMs==null?"RTT —":`${rttMs} ms`}</span></div></footer>
    </div>
  </main>;
}

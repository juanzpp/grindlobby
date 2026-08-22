"use client";

import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties,type FormEvent} from "react";
import Image from "next/image";
import {ProfileHoverTrigger,type HoverPlayerData} from "@/components/profile/HoverProfileCard";
import {PROFILE_EFFECTS,PROFILE_FRAMES} from "@/lib/profile-cosmetics";
import {getLiveKitMediaRttMs,subscribeActiveLiveKitRoom} from "@/lib/webrtc/useLobbyVoice";
import {RoomEvent,type Room,type Participant} from "livekit-client";
import {
  Check,ChevronDown,Coins,Crown,Disc3,Flame,Gift,Headphones,Info,ListMusic,
  Loader2,Lock,Maximize2,Megaphone,Minimize2,Pause,Play,Plus,Radio,Repeat,Search,Server,
  Shuffle,Signal,SkipBack,SkipForward,Sparkles,Trophy,TrendingUp,Volume2,Wifi,X,
} from "lucide-react";

export type HomeGame={id:number;name:string;rank:string;points:number;wins:number;matches:number;winRate:number;progress:number;nextDivision:string};
export type HomeOnlineUser={id:string;username:string;display_name:string;avatar:string|null;status:string};

type Tier={name:string;from:number;to:number;color:string;glow:string;aura:number};
const TIERS:Tier[]=[
  {name:"Iniciante",from:0,to:4,color:"oklch(0.62 0.02 285)",glow:"oklch(0.76 0.02 285)",aura:0},
  {name:"Bronze",from:5,to:9,color:"oklch(0.58 0.11 60)",glow:"oklch(0.74 0.13 70)",aura:1},
  {name:"Prata",from:10,to:14,color:"oklch(0.72 0.02 250)",glow:"oklch(0.88 0.02 250)",aura:1},
  {name:"Safira",from:15,to:19,color:"oklch(0.58 0.17 250)",glow:"oklch(0.74 0.16 245)",aura:2},
  {name:"Esmeralda",from:20,to:24,color:"oklch(0.6 0.16 160)",glow:"oklch(0.76 0.16 160)",aura:2},
  {name:"Ametista",from:25,to:29,color:"oklch(0.52 0.22 300)",glow:"oklch(0.68 0.22 305)",aura:3},
  {name:"Carmesim",from:30,to:34,color:"oklch(0.56 0.22 15)",glow:"oklch(0.72 0.2 20)",aura:3},
  {name:"Áureo",from:35,to:39,color:"oklch(0.72 0.16 90)",glow:"oklch(0.87 0.15 95)",aura:4},
  {name:"Prismático",from:40,to:999,color:"oklch(0.7 0.2 320)",glow:"oklch(0.85 0.18 200)",aura:4},
];
function tierFor(level:number){return TIERS.find(t=>level>=t.from&&level<=t.to)??TIERS[0]}
function gradient(tier:Tier){return `linear-gradient(90deg,${tier.color},${tier.glow})`}
function initials(value:string){return value.trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()||"GL"}

export function ProfileAvatar({name,size=36,className="",avatarUrl,frameId="none",effectId="none"}:{name:string;size?:number;className?:string;avatarUrl?:string|null;frameId?:string|null;effectId?:string|null}){
  const frame=PROFILE_FRAMES.find(item=>item.id===(frameId||"none"))??PROFILE_FRAMES.find(item=>item.id==="none")!;
  const effect=PROFILE_EFFECTS.find(item=>item.id===(effectId||"none"))??PROFILE_EFFECTS.find(item=>item.id==="none")!;
  const hasFrame=frame.id!=="none";
  const hasEffect=effect.id!=="none";
  return <span
    className={`lovable-profile-avatar profile-avatar-shell ${hasFrame?"profile-avatar-has-frame":"profile-avatar-no-frame"} ${hasEffect?`profile-effect-${effect.variant}`:""} ${className}`}
    style={{width:size,height:size,"--frame-ring":frame.ring,"--frame-glow":frame.glow,"--effect-glow":effect.glow} as CSSProperties}
  >
    {hasFrame?<span className="profile-avatar-frame"/>:null}
    <span className="profile-avatar-core">{avatarUrl?<img src={avatarUrl} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer"/>:<span style={{fontSize:Math.max(10,size*.36)}}>{initials(name).slice(0,1)}</span>}</span>
    {hasFrame?<><span className="profile-avatar-spark profile-avatar-spark-a"/><span className="profile-avatar-spark profile-avatar-spark-b"/></>:null}
  </span>;
}

type TickerItem={id:string;tone:"admin"|"event"|"drop"|"live";icon:typeof Crown;title:string;detail:string};
export function EventTicker({display,isAdmin,isPro,activeLobbies}:{display:string;isAdmin:boolean;isPro:boolean;activeLobbies:number}){
  const feed=useMemo<TickerItem[]>(()=>[
    {id:"account",icon:Crown,tone:"admin",title:isAdmin?"Admin online":isPro?"Grind PRO ativo":"Bem-vindo ao GrindLobby",detail:`${display} está online e pronto para competir`},
    {id:"live",icon:Radio,tone:"live",title:"Lobbies ao vivo",detail:`${activeLobbies} ${activeLobbies===1?"sala disponível":"salas disponíveis"} agora`},
    {id:"event",icon:Trophy,tone:"event",title:"Copa GrindLobby",detail:"Acompanhe os próximos eventos competitivos no painel"},
    {id:"drop",icon:Gift,tone:"drop",title:"Personalize seu Grind",detail:"Novos efeitos, bordas e títulos estão na loja"},
    {id:"streak",icon:Flame,tone:"live",title:"Continue evoluindo",detail:"Jogue partidas competitivas para avançar seu elo"},
  ],[activeLobbies,display,isAdmin,isPro]);
  const [index,setIndex]=useState(0);const [visible,setVisible]=useState(true);const [paused,setPaused]=useState(false);
  useEffect(()=>{if(paused||!visible)return;const timer=window.setInterval(()=>setIndex(i=>(i+1)%feed.length),6500);return()=>window.clearInterval(timer)},[feed.length,paused,visible]);
  if(!visible)return null;const item=feed[index]??feed[0];const Icon=item.icon;
  return <div onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} className={`lovable-panel lovable-ticker lovable-ticker-${item.tone}`} role="status" aria-live="polite">
    <span className="lovable-ticker-shine"/><div key={item.id} className="lovable-ticker-row">
      <span className={`lovable-ticker-icon lovable-ticker-text-${item.tone}`}><Icon size={16}/></span><span className="lovable-ticker-pulse"/>
      <p className="min-w-0 flex-1 truncate text-sm"><b>{item.title}</b> <span className="text-muted-foreground">— {item.detail}</span></p>
      <span className="hidden items-center gap-1 sm:flex">{feed.map((entry,i)=><button key={entry.id} aria-label={`Ver aviso ${i+1}`} onClick={()=>setIndex(i)} className={i===index?"lovable-ticker-dot is-active":"lovable-ticker-dot"}/>)}</span>
      <Megaphone size={16} className="hidden text-muted-foreground md:block"/><button onClick={()=>setVisible(false)} aria-label="Fechar avisos" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"><X size={16}/></button>
    </div><span className="lovable-ticker-track"><span key={`${item.id}-bar`} className={paused?"":"lovable-ticker-progress"}/></span>
  </div>;
}

export function TopElos({players,onAdd,onCall}:{players:HoverPlayerData[];onAdd?:(player:HoverPlayerData)=>void;onCall?:(player:HoverPlayerData)=>void}){
  if(!players.length)return <section className="lovable-panel px-5 py-4"><div className="flex items-center justify-between gap-3"><p className="lovable-label flex items-center gap-2"><Crown size={16} className="text-warning"/>Top players do servidor</p><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp size={14} className="text-success"/>ranking atual</span></div><div className="mt-4 rounded-xl border border-dashed border-border bg-panel/40 px-4 py-5 text-center text-sm text-muted-foreground">Ainda não há jogadores com histórico competitivo suficiente para entrar no Top Players.</div></section>;
  return <section className="lovable-panel px-5 py-4"><div className="flex items-center justify-between gap-3"><p className="lovable-label flex items-center gap-2"><Crown size={16} className="text-warning"/>Top players do servidor</p><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp size={14} className="text-success"/>ranking atual</span></div>
    <ol className="lovable-elo-list mt-3 flex gap-3 overflow-x-auto pb-1 pt-1">{players.map((person,index)=>{const tier=tierFor(person.level);return <li key={person.id} className="shrink-0"><ProfileHoverTrigger player={person} onAdd={onAdd?()=>onAdd(person):undefined} onCall={onCall?()=>onCall(person):undefined}><div className="lovable-elo-card" style={{boxShadow:`0 9px 24px color-mix(in oklch, ${tier.glow} 15%, transparent)`}}><span className="font-display text-sm font-bold text-muted-foreground">#{index+1}</span><ProfileAvatar name={person.name} avatarUrl={person.avatar} frameId={person.frame} effectId={person.effect} size={34}/><div className="min-w-0"><p className="truncate text-sm font-semibold">{person.name}</p><p className="mt-0.5 flex items-center gap-1.5 text-[11px]"><span className="h-2 w-2 rounded-full" style={{background:tier.color,boxShadow:`0 0 8px ${tier.glow}`}}/><span className="max-w-[82px] truncate text-muted-foreground">{person.rankName}</span><span className="rounded px-1.5 font-display font-bold text-background" style={{backgroundImage:gradient(tier)}}>{person.level}</span></p></div></div></ProfileHoverTrigger></li>})}</ol>
  </section>;
}

export function LevelHero({display,username,level,xp,game,onSelectGame,games,onOpenProfile,avatarUrl,frameId,effectId,badgeLabel}:{display:string;username:string;level:number;xp:number;game:HomeGame;games:HomeGame[];onSelectGame:(id:number)=>void;onOpenProfile:()=>void;avatarUrl?:string|null;frameId?:string|null;effectId?:string|null;badgeLabel?:string|null}){
  const tier=tierFor(level);const need=400+level*220;const within=xp%need;const pct=Math.min(100,Math.round(within/need*100));const nextTier=TIERS.find(item=>item.from>level);
  return <section className="lovable-panel lovable-level-hero relative overflow-hidden px-5 py-6"><div className="grid items-center gap-6 lg:grid-cols-[auto_1fr_auto]">
    <div className="relative mx-auto"><span className="absolute inset-0 rounded-full blur-2xl" style={{background:tier.color,opacity:.35}}/><Image src="/brand/ascent-portal.png" alt="Emblema GrindLobby" width={512} height={512} priority className="relative h-40 w-40 object-contain" style={{filter:`drop-shadow(0 0 34px ${tier.glow})`}}/></div>
    <div><p className="lovable-label">Seu progresso</p><div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="font-display text-4xl font-bold">Level {level}</h1><span className="rounded-md px-2.5 py-1 font-display text-[11px] font-bold tracking-wide text-background" style={{backgroundImage:gradient(tier)}}>{tier.name.toUpperCase()}</span><label className="lovable-btn-ghost relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium"><Sparkles size={14} className="text-primary-glow"/><select aria-label="Jogo principal" value={game.id} onChange={event=>onSelectGame(Number(event.target.value))} className="appearance-none bg-transparent pr-4 outline-none">{games.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2 text-muted-foreground"/></label></div>
      <div className="mt-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>XP do level</span><span><b className="text-foreground">{within.toLocaleString("pt-BR")}</b> / {need.toLocaleString("pt-BR")} XP</span></div><div className="relative mt-2 h-3.5 overflow-hidden rounded-full bg-secondary"><div className={tier.aura>=3?"lovable-xp-fill lovable-xp-shift":"lovable-xp-fill"} style={{width:`${pct}%`,backgroundImage:gradient(tier),boxShadow:`0 0 ${tier.aura*9}px ${tier.glow}`}}>{tier.aura>=2?<span className="lovable-bar-shimmer"/>:null}</div></div><p className="mt-2 text-xs text-muted-foreground">Faltam {(need-within).toLocaleString("pt-BR")} XP para o level {level+1}{nextTier?<> • próximo elo: <span style={{color:nextTier.glow}}>{nextTier.name}</span> no level {nextTier.from}</>:null}</p></div>
      <div className="mt-4 flex flex-wrap gap-2"><button onClick={onOpenProfile} className="lovable-btn-primary flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"><Trophy size={14}/>Ver meu rank</button><button onClick={onOpenProfile} className="lovable-btn-ghost rounded-lg px-3 py-2 text-xs font-medium">Configurar perfil</button></div>
      <div className="mt-4 flex flex-wrap gap-1.5">{TIERS.map(item=><span key={item.name} title={`${item.name} — level ${item.from}-${item.to}`} className="h-1.5 w-10 rounded-full" style={{backgroundImage:gradient(item),opacity:level>=item.from?1:.25}}/>)}</div>
    </div>
    <div className="flex flex-col items-center gap-3 lg:border-l lg:border-border lg:pl-6"><ProfileAvatar name={display} avatarUrl={avatarUrl} frameId={frameId} effectId={effectId} size={78}/><div className="text-center"><p className="font-display text-lg font-bold">{display}{badgeLabel&&badgeLabel!=="none"?<span className="ml-2 rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase text-warning">{badgeLabel}</span>:null}</p><p className="text-xs text-muted-foreground">@{username}</p><p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">{game.rank} <Info size={14}/></p></div></div>
  </div></section>;
}

type MusicProvider="youtube"|"spotify";
type Track={id:string;provider:MusicProvider;title:string;artist:string;duration:number;by:string;image:string|null;url:string;videoId?:string;spotifyUri?:string};
type MusicSearchResult=Omit<Track,"by">;
type SharedMusicState={type:"grind-music-state-v1";queue:Track[];current:number;playing:boolean;volume:number;loop:boolean;position:number;sentAt:number};
type YTPlayer={loadVideoById:(id:string,startSeconds?:number)=>void;cueVideoById:(id:string,startSeconds?:number)=>void;playVideo:()=>void;pauseVideo:()=>void;seekTo:(seconds:number,allowSeekAhead:boolean)=>void;setVolume:(value:number)=>void;getCurrentTime:()=>number;getDuration:()=>number;destroy:()=>void};
type YTNamespace={Player:new(element:HTMLElement,options:{videoId?:string;playerVars?:Record<string,string|number>;events?:{onReady?:(event:{target:YTPlayer})=>void;onStateChange?:(event:{data:number;target:YTPlayer})=>void;onAutoplayBlocked?:()=>void}})=>YTPlayer;PlayerState:{ENDED:number;PLAYING:number;PAUSED:number}};
declare global{interface Window{YT?:YTNamespace;onYouTubeIframeAPIReady?:()=>void}}
const formatTime=(seconds:number)=>`${Math.floor(Math.max(0,seconds)/60)}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,"0")}`;
const musicEncoder=new TextEncoder(),musicDecoder=new TextDecoder();

function YouTubeMusicPlayer({track,playing,volume,position,onPlayingChange,onEnded,onPosition}:{track:Track|null;playing:boolean;volume:number;position:number;onPlayingChange:(value:boolean)=>void;onEnded:()=>void;onPosition:(value:number)=>void}){
  const hostRef=useRef<HTMLDivElement|null>(null),playerRef=useRef<YTPlayer|null>(null),lastVideoRef=useRef<string|null>(null),lastRemotePosition=useRef(0);
  const callbacksRef=useRef({onPlayingChange,onEnded,onPosition});
  const latestRef=useRef({volume,playing,position});
  const [apiReady,setApiReady]=useState(false),[playerReady,setPlayerReady]=useState(false);
  useEffect(()=>{callbacksRef.current={onPlayingChange,onEnded,onPosition}},[onPlayingChange,onEnded,onPosition]);
  useEffect(()=>{latestRef.current={volume,playing,position}},[volume,playing,position]);
  useEffect(()=>{
    let disposed=false;
    const markReady=()=>{if(!disposed)setApiReady(true)};
    if(window.YT?.Player){const timer=window.setTimeout(markReady,0);return()=>{disposed=true;window.clearTimeout(timer)}}
    const existing=document.querySelector('script[data-grind-youtube-api="true"]');
    const previous=window.onYouTubeIframeAPIReady;
    const handler=()=>{previous?.();markReady()};
    window.onYouTubeIframeAPIReady=handler;
    if(!existing){const script=document.createElement("script");script.src="https://www.youtube.com/iframe_api";script.async=true;script.dataset.grindYoutubeApi="true";document.head.appendChild(script)}
    return()=>{disposed=true;if(window.onYouTubeIframeAPIReady===handler)window.onYouTubeIframeAPIReady=previous};
  },[]);
  useEffect(()=>{
    if(!apiReady||!hostRef.current||playerRef.current||!window.YT)return;
    const player=new window.YT.Player(hostRef.current,{playerVars:{playsinline:1,controls:1,rel:0,modestbranding:1},events:{
      onReady:event=>{event.target.setVolume(latestRef.current.volume);setPlayerReady(true)},
      onStateChange:event=>{if(!window.YT)return;const callbacks=callbacksRef.current;if(event.data===window.YT.PlayerState.PLAYING)callbacks.onPlayingChange(true);if(event.data===window.YT.PlayerState.PAUSED)callbacks.onPlayingChange(false);if(event.data===window.YT.PlayerState.ENDED)callbacks.onEnded()},
      onAutoplayBlocked:()=>callbacksRef.current.onPlayingChange(false),
    }});
    playerRef.current=player;
    return()=>{player.destroy();if(playerRef.current===player)playerRef.current=null};
  },[apiReady]);
  useEffect(()=>{const player=playerRef.current;if(!playerReady||!player||track?.provider!=="youtube"||!track.videoId)return;if(lastVideoRef.current!==track.videoId){lastVideoRef.current=track.videoId;if(playing)player.loadVideoById(track.videoId,position);else player.cueVideoById(track.videoId,position)}},[playerReady,track?.provider,track?.videoId,playing,position]);
  useEffect(()=>{const player=playerRef.current;if(!playerReady||!player||track?.provider!=="youtube")return;player.setVolume(volume);if(playing)player.playVideo();else player.pauseVideo()},[playerReady,playing,volume,track?.provider]);
  useEffect(()=>{const player=playerRef.current;if(!playerReady||!player||track?.provider!=="youtube")return;if(Math.abs(position-lastRemotePosition.current)>2.5){lastRemotePosition.current=position;player.seekTo(position,true)}},[playerReady,position,track?.provider]);
  useEffect(()=>{if(!playerReady||track?.provider!=="youtube")return;const timer=window.setInterval(()=>{const value=playerRef.current?.getCurrentTime()??0;lastRemotePosition.current=value;callbacksRef.current.onPosition(value)},500);return()=>window.clearInterval(timer)},[playerReady,track?.provider]);
  return <div className={track?.provider==="youtube"?"mt-3 overflow-hidden rounded-xl border border-border bg-black":"hidden"}><div ref={hostRef} className="aspect-video min-h-[200px] w-full"/></div>;
}

export function MusicBot(){
  const [queue,setQueue]=useState<Track[]>([]),[current,setCurrent]=useState(0),[playing,setPlaying]=useState(false),[elapsed,setElapsed]=useState(0),[volume,setVolume]=useState(65),[loop,setLoop]=useState(false),[input,setInput]=useState(""),[popup,setPopup]=useState(false),[hidden,setHidden]=useState(false),[source,setSource]=useState<"all"|MusicProvider>("all");
  const [results,setResults]=useState<MusicSearchResult[]>([]),[searching,setSearching]=useState(false),[searchError,setSearchError]=useState(""),[room,setRoom]=useState<Room|null>(null);
  const track=queue[current]??null,applyingRemote=useRef(false),stateRef=useRef({queue,current,playing,volume,loop,elapsed});
  useEffect(()=>{stateRef.current={queue,current,playing,volume,loop,elapsed}},[queue,current,playing,volume,loop,elapsed]);
  useEffect(()=>subscribeActiveLiveKitRoom(setRoom),[]);
  useEffect(()=>{
    if(!room)return;
    const onData=(payload:Uint8Array,participant?:Participant)=>{if(!participant)return;try{const message=JSON.parse(musicDecoder.decode(payload)) as SharedMusicState;if(message.type!=="grind-music-state-v1")return;applyingRemote.current=true;setQueue(message.queue);setCurrent(Math.max(0,Math.min(message.current,Math.max(0,message.queue.length-1))));setPlaying(message.playing);setVolume(message.volume);setLoop(message.loop);const drift=message.playing?Math.max(0,(Date.now()-message.sentAt)/1000):0;setElapsed(Math.max(0,message.position+drift));window.setTimeout(()=>{applyingRemote.current=false},0)}catch{}};
    room.on(RoomEvent.DataReceived,onData);return()=>{room.off(RoomEvent.DataReceived,onData)};
  },[room]);
  const publishState=useCallback((patch:Partial<Omit<SharedMusicState,"type"|"sentAt">>={})=>{
    if(!room||applyingRemote.current)return;
    const state=stateRef.current,message:SharedMusicState={type:"grind-music-state-v1",queue:patch.queue??state.queue,current:patch.current??state.current,playing:patch.playing??state.playing,volume:patch.volume??state.volume,loop:patch.loop??state.loop,position:patch.position??state.elapsed,sentAt:Date.now()};
    void room.localParticipant.publishData(musicEncoder.encode(JSON.stringify(message)),{reliable:true}).catch(()=>{});
  },[room]);
  const commit=(next:{queue?:Track[];current?:number;playing?:boolean;volume?:number;loop?:boolean;position?:number})=>{if(next.queue!==undefined)setQueue(next.queue);if(next.current!==undefined)setCurrent(next.current);if(next.playing!==undefined)setPlaying(next.playing);if(next.volume!==undefined)setVolume(next.volume);if(next.loop!==undefined)setLoop(next.loop);if(next.position!==undefined)setElapsed(next.position);publishState(next)};
  function skip(direction:1|-1){if(!queue.length)return;const next=(current+direction+queue.length)%queue.length;commit({current:next,position:0,playing:true})}
  function addResult(result:MusicSearchResult){const next=[...queue,{...result,by:"você"}];commit({queue:next,current:queue.length?current:0});setResults([]);setInput("")}
  async function searchTracks(event:FormEvent){event.preventDefault();const value=input.trim();if(!value)return;setSearching(true);setSearchError("");try{const response=await fetch(`/api/music/search?q=${encodeURIComponent(value)}&source=${source}`,{cache:"no-store"});const body=await response.json() as {results?:MusicSearchResult[];error?:string};if(!response.ok)throw new Error(body.error||"Busca indisponível");setResults(body.results??[]);if(!(body.results??[]).length)setSearchError("Nenhuma faixa encontrada com as fontes configuradas.")}catch(error){setSearchError(error instanceof Error?error.message:"Não foi possível buscar músicas.")}finally{setSearching(false)}}
  function onEnded(){if(loop){commit({position:0,playing:true});return}if(queue.length>1)skip(1);else commit({playing:false,position:0})}
  function togglePlay(){if(!track)return;if(track.provider==="spotify"){window.open(track.url,"_blank","noopener,noreferrer");return}commit({playing:!playing})}
  function removeFromQueue(index:number){const next=queue.filter((_,itemIndex)=>itemIndex!==index),nextCurrent=next.length?Math.min(current-(index<current?1:0),next.length-1):0;commit({queue:next,current:nextCurrent,position:0,playing:next.length?playing:false})}
  function moveQueue(index:number,direction:1|-1){const target=index+direction;if(target<0||target>=queue.length)return;const next=[...queue],[item]=next.splice(index,1);next.splice(target,0,item);const nextCurrent=current===index?target:current===target?index:current;commit({queue:next,current:nextCurrent})}
  if(popup&&hidden)return <button onClick={()=>setHidden(false)} className="lovable-panel flex w-full items-center gap-3 p-4 text-left"><Disc3 className={playing?"lovable-spin-slow text-primary-glow":"text-primary-glow"} size={20}/><span className="min-w-0 flex-1"><b className="block truncate text-sm">{track?.title??"Fila vazia"}</b><span className="lovable-label">bot em popup — clique para reabrir</span></span><Maximize2 size={16}/></button>;
  return <section className={popup?"lovable-panel lovable-music-popup p-5":"lovable-panel p-5"}><div className="flex items-center justify-between gap-2"><p className="lovable-label flex items-center gap-2"><Disc3 className={playing?"lovable-spin-slow text-primary-glow":"text-primary-glow"} size={16}/>Grind Beats — YouTube + Spotify</p><div className="flex items-center gap-1.5"><span className="hidden rounded-md border border-border bg-panel px-2 py-1 text-[11px] text-muted-foreground sm:flex">{room?"fila sincronizada na call":"fila local"}</span><button onClick={()=>setPopup(value=>!value)} aria-label={popup?"Encaixar no painel":"Abrir em popup"} className="lovable-btn-ghost grid h-8 w-8 place-items-center rounded-lg">{popup?<Minimize2 size={14}/>:<Maximize2 size={14}/>}</button>{popup?<button onClick={()=>setHidden(true)} aria-label="Minimizar popup" className="lovable-btn-ghost grid h-8 w-8 place-items-center rounded-lg"><X size={14}/></button>:null}</div></div>
    <div className="mt-4 flex items-center gap-4 rounded-xl border border-border bg-panel/60 p-3"><span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-primary/70 to-primary-glow/60" style={track?.image?{backgroundImage:`url(${track.image})`,backgroundSize:"cover",backgroundPosition:"center"}:undefined}>{track?.image?null:<Disc3 className={playing?"lovable-spin-slow":""} size={32}/>}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{track?.title??"Nenhuma música na fila"}</p><p className="truncate text-xs text-muted-foreground">{track?`${track.artist} • ${track.provider==="youtube"?"YouTube":"Spotify"} • pedido por ${track.by}`:"busque uma faixa abaixo"}</p><div className="mt-2 flex items-end gap-[2px]">{Array.from({length:26}).map((_,index)=><span key={index} className={playing?"lovable-eq-bar is-playing":"lovable-eq-bar"} style={{height:5+(index*5)%14,animationDelay:`${index%7*.12}s`}}/>)}</div><div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground"><span>{formatTime(elapsed)}</span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><span className="block h-full bg-gradient-to-r from-primary to-primary-glow" style={{width:`${track?.duration?Math.min(100,elapsed/track.duration*100):0}%`}}/></span><span>{track?formatTime(track.duration):"0:00"}</span></div></div></div>
    <YouTubeMusicPlayer track={track} playing={playing} volume={volume} position={elapsed} onPlayingChange={value=>{setPlaying(value);publishState({playing:value,position:stateRef.current.elapsed})}} onEnded={onEnded} onPosition={setElapsed}/>
    {track?.provider==="spotify"?<div className="mt-3 rounded-xl border border-[#1db954]/30 bg-[#1db954]/10 p-3 text-sm"><b>Spotify usa reprodução oficial.</b><p className="mt-1 text-xs text-muted-foreground">O GrindLobby sincroniza a fila, mas não retransmite áudio do Spotify. Clique em Play para abrir a faixa no Spotify.</p></div>:null}
    <div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={()=>skip(-1)} disabled={!queue.length} aria-label="Anterior" className="lovable-btn-ghost grid h-10 w-10 place-items-center rounded-lg disabled:opacity-40"><SkipBack size={16}/></button><button onClick={togglePlay} disabled={!track} aria-label={track?.provider==="spotify"?"Abrir no Spotify":playing?"Pausar":"Tocar"} className="lovable-btn-primary grid h-11 w-11 place-items-center rounded-full disabled:opacity-40">{playing&&track?.provider==="youtube"?<Pause size={20}/>:<Play size={20}/>}</button><button onClick={()=>skip(1)} disabled={!queue.length} aria-label="Próxima" className="lovable-btn-ghost grid h-10 w-10 place-items-center rounded-lg disabled:opacity-40"><SkipForward size={16}/></button><button onClick={()=>commit({loop:!loop})} aria-label="Repetir" className={loop?"grid h-10 w-10 place-items-center rounded-lg border border-primary/50 bg-primary/20 text-primary-glow":"lovable-btn-ghost grid h-10 w-10 place-items-center rounded-lg"}><Repeat size={16}/></button><div className="ml-auto flex min-w-[140px] items-center gap-2"><Volume2 size={16} className="text-muted-foreground"/><input type="range" min={0} max={100} value={volume} aria-label="Volume do bot" onChange={event=>commit({volume:Number(event.target.value)})} className="h-1.5 w-full accent-purple-500"/><span className="w-8 text-right text-xs text-muted-foreground">{volume}</span></div></div>
    <div className="mt-3 flex gap-2">{(["all","youtube","spotify"] as const).map(value=><button key={value} type="button" onClick={()=>setSource(value)} className={source===value?"rounded-lg border border-primary/50 bg-primary/20 px-3 py-1.5 text-xs font-semibold":"rounded-lg border border-border bg-panel px-3 py-1.5 text-xs font-semibold text-muted-foreground"}>{value==="all"?"Todos":value==="youtube"?"YouTube":"Spotify"}</button>)}</div>
    <form onSubmit={searchTracks} className="mt-3 flex gap-2"><div className="relative min-w-0 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={input} onChange={event=>setInput(event.target.value)} placeholder="Buscar música ou artista" className="w-full rounded-lg border border-input bg-panel py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary/60"/></div><button type="submit" disabled={searching} className="lovable-btn-primary flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold disabled:opacity-50">{searching?<Loader2 size={16} className="animate-spin"/>:<Search size={16}/>}Buscar</button></form>
    {searchError?<p className="mt-2 text-xs text-destructive">{searchError}</p>:null}
    {results.length?<div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-2"><p className="lovable-label px-1 pb-1">Resultados</p><ul className="max-h-56 space-y-1 overflow-y-auto">{results.map(result=><li key={result.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-secondary"><span className="h-10 w-10 shrink-0 rounded-md bg-secondary" style={result.image?{backgroundImage:`url(${result.image})`,backgroundSize:"cover",backgroundPosition:"center"}:undefined}/><button type="button" onClick={()=>addResult(result)} className="min-w-0 flex-1 text-left"><b className="block truncate text-sm">{result.title}</b><span className="block truncate text-[11px] text-muted-foreground">{result.artist} • {result.provider==="youtube"?"YouTube":"Spotify"} • {formatTime(result.duration)}</span></button><Plus size={15} className="text-primary-glow"/></li>)}</ul></div>:null}
    <div className="mt-3 rounded-xl border border-border bg-panel/50 p-3"><p className="lovable-label flex items-center gap-2"><ListMusic size={14}/>Fila ({queue.length})</p>{queue.length?<ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">{queue.map((item,index)=><li key={`${item.id}-${index}`} className={index===current?"flex items-center gap-2 rounded-lg bg-primary/15 px-2 py-2 text-sm":"flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-secondary"}><button onClick={()=>commit({current:index,position:0,playing:item.provider==="youtube"})} className="min-w-0 flex-1 truncate text-left">{index+1}. {item.title}</button><span className="text-[10px] uppercase text-muted-foreground">{item.provider==="youtube"?"YT":"SP"}</span><button onClick={()=>moveQueue(index,-1)} disabled={index===0} aria-label="Mover para cima" className="text-muted-foreground disabled:opacity-20">↑</button><button onClick={()=>moveQueue(index,1)} disabled={index===queue.length-1} aria-label="Mover para baixo" className="text-muted-foreground disabled:opacity-20">↓</button><button onClick={()=>removeFromQueue(index)} aria-label="Remover da fila" className="text-muted-foreground hover:text-destructive"><X size={14}/></button></li>)}</ul>:<p className="mt-2 text-xs text-muted-foreground">A fila está vazia.</p>}</div>
    <p className="mt-2 text-[10px] text-muted-foreground">YouTube toca no player oficial embutido. Spotify usa catálogo/links oficiais. Em uma call LiveKit ativa, a fila e os controles são sincronizados entre participantes.</p>
  </section>;
}

const STORE=[
  {id:"steel",kind:"Bordas",name:"Aço Escovado",desc:"Anel metálico duplo com brilho frio",price:250,level:0,preview:"steel"},
  {id:"neon",kind:"Bordas",name:"Neon Violeta",desc:"Contorno neon com halo pulsante",price:480,level:5,preview:"neon"},
  {id:"prisma",kind:"Bordas",name:"Prisma Rotativo",desc:"Borda cromática exclusiva de elite",price:1500,level:30,preview:"prisma"},
  {id:"grinder",kind:"Títulos",name:'Título "Grinder"',desc:"Tag exibida ao lado do seu nick",price:200,level:3,preview:"GRINDER"},
  {id:"lenda",kind:"Títulos",name:'Título "Lenda"',desc:"Para quem chegou ao topo",price:1200,level:35,preview:"LENDA"},
  {id:"void",kind:"Banners",name:"Vazio Roxo",desc:"Névoa violeta com profundidade",price:300,level:0,preview:"void"},
  {id:"boost",kind:"Boosts",name:"Boost de XP",desc:"Acelere sua progressão competitiva",price:350,level:0,preview:"boost"},
];
export function StoreSection({display,level}:{display:string;level:number}){const [tab,setTab]=useState("Bordas");const [owned,setOwned]=useState<string[]>([]);const items=STORE.filter(item=>item.kind===tab);return <section className="lovable-panel p-5"><div className="flex items-center justify-between gap-3"><p className="lovable-label">Loja — personalização de perfil</p><span className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1 text-sm font-semibold"><Coins size={16} className="text-warning"/>1.200</span></div><div className="mt-3 flex flex-wrap gap-2">{["Bordas","Títulos","Banners","Boosts"].map(value=><button key={value} onClick={()=>setTab(value)} className={tab===value?"rounded-lg border border-primary/50 bg-primary/20 px-3 py-1.5 text-xs font-semibold":"rounded-lg border border-border bg-panel px-3 py-1.5 text-xs font-semibold text-muted-foreground"}>{value}</button>)}</div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(item=>{const locked=level<item.level;const isOwned=owned.includes(item.id);return <article key={item.id} className="rounded-xl border border-border bg-panel/50 p-3"><div className={`lovable-store-preview lovable-store-${item.preview}`}>{item.kind==="Bordas"?<ProfileAvatar name={display} size={62}/>:item.kind==="Títulos"?<span>{item.preview}</span>:item.kind==="Boosts"?<Sparkles size={38} className="text-warning"/>:<b>{display}</b>}</div><h3 className="mt-3 text-sm font-semibold">{item.name}</h3><p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p><div className="mt-3 flex items-center justify-between"><p className="flex items-center gap-1.5 text-sm font-semibold"><Coins size={14} className="text-warning"/>{item.price}</p>{locked?<span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock size={14}/>Lv {item.level}</span>:isOwned?<span className="flex items-center gap-1 rounded-md border border-success/40 bg-success/15 px-2 py-1 text-xs text-success"><Check size={14}/>Equipado</span>:<button onClick={()=>setOwned(value=>[...value,item.id])} className="lovable-btn-primary rounded-md px-2.5 py-1.5 text-xs font-semibold">Comprar</button>}</div></article>})}</div></section>}

export function ConnectionPanel({active,onOpen}:{active:boolean;onOpen:()=>void}){
  const [samples,setSamples]=useState<number[]>([]),[measuring,setMeasuring]=useState(false),[source,setSource]=useState<"media"|"server">("server");
  useEffect(()=>{
    let cancelled=false;
    async function measure(){
      setMeasuring(true);
      try{
        const mediaRtt=active?await getLiveKitMediaRttMs():null;
        if(mediaRtt!=null){if(!cancelled){setSource("media");setSamples(values=>[...values.slice(-27),mediaRtt])}return}
        const started=performance.now(),response=await fetch(`/api/ping?t=${Date.now()}`,{method:"GET",cache:"no-store"});
        if(!response.ok)throw new Error("ping failed");
        const rtt=Math.max(1,Math.round(performance.now()-started));
        if(!cancelled){setSource("server");setSamples(values=>[...values.slice(-27),rtt])}
      }catch{}finally{if(!cancelled)setMeasuring(false)}
    }
    void measure();
    const timer=window.setInterval(()=>void measure(),3000);
    return()=>{cancelled=true;window.clearInterval(timer)};
  },[active]);
  const recent=samples.slice(-5).sort((a,b)=>a-b),ping=recent.length?recent[Math.floor(recent.length/2)]??recent.at(-1)!:null;
  const quality=ping==null?"medindo":ping<50?"excelente":ping<90?"boa":ping<150?"média":"alta";
  const bar=Math.min(100,ping==null?0:Math.max(5,100-ping/2));
  return <section className="lovable-panel p-5"><div className="flex items-center justify-between"><p className="lovable-label flex items-center gap-2"><Signal size={16} className="text-primary-glow"/>Conexão da call</p><span className={active?"flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary-glow":"flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] text-muted-foreground"}><span className={active?"h-1.5 w-1.5 animate-pulse rounded-full bg-primary-glow":"h-1.5 w-1.5 rounded-full bg-muted-foreground"}/>{active?"Lobby disponível":"Desconectado"}</span></div><div className="mt-4 flex items-end justify-between gap-4"><div><p className={`font-display text-4xl font-bold leading-none ${ping!=null?"text-foreground":"text-muted-foreground"}`}>{ping??"--"}<span className="ml-1 text-base font-medium">ms</span></p><p className="mt-1 text-xs text-muted-foreground">{source==="media"?"RTT real da mídia LiveKit":"RTT real até o servidor GrindLobby"}{measuring?" · medindo…":""}</p></div><div className="flex h-14 items-end gap-[3px]">{Array.from({length:28}).map((_,index)=>{const sample=samples[Math.max(0,samples.length-28+index)];const height=sample?Math.max(7,36-Math.min(30,sample/5)):6+(index*11)%20;return <span key={index} className={sample?"w-[6px] rounded-sm bg-primary-glow":"w-[6px] rounded-sm bg-muted"} style={{height,opacity:sample?.8:.2}}/>})}</div></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary-glow transition-all" style={{width:`${bar}%`}}/></div><dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">{[{icon:Wifi,label:"latência",value:ping==null?"--":`${ping} ms`},{icon:Server,label:"fonte",value:source==="media"?"LiveKit":"servidor"},{icon:Headphones,label:"qualidade",value:quality}].map(item=><div key={item.label} className="rounded-lg border border-border bg-panel/60 px-2 py-2"><dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><item.icon size={12}/>{item.label}</dt><dd className="mt-0.5 font-semibold">{item.value}</dd></div>)}</dl><button disabled={!active} onClick={onOpen} className="lovable-btn-primary mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold"><Radio size={16}/>{active?"Abrir call":"Entre em um lobby"}</button></section>
}
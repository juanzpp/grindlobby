"use client";

import {useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import Image from "next/image";
import {getLiveKitMediaRttMs} from "@/lib/webrtc/useLobbyVoice";
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

export function ProfileAvatar({name,size=36,className=""}:{name:string;size?:number;className?:string}){
  return <span className={`lovable-profile-avatar ${className}`} style={{width:size,height:size,padding:size>=60?4:3}}><span style={{fontSize:Math.max(10,size*.36)}}>{initials(name).slice(0,1)}</span></span>;
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

export function TopElos({display,username,level,online}:{display:string;username:string;level:number;online:HomeOnlineUser[]}){
  const rows=useMemo(()=>[{id:"me",name:display,handle:`@${username}`,level,you:true},...online.slice(0,6).map((person,index)=>({id:person.id,name:person.display_name||person.username,handle:`@${person.username}`,level:Math.max(1,level-index-1),you:false}))],[display,level,online,username]);
  const [open,setOpen]=useState<string|null>(null);
  return <section className="lovable-panel px-5 py-4"><div className="flex items-center justify-between gap-3"><p className="lovable-label flex items-center gap-2"><Crown size={16} className="text-warning"/>Top elos do servidor</p><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp size={14} className="text-success"/>temporada atual</span></div>
    <ol className="lovable-elo-list mt-3 flex gap-3 overflow-x-auto pb-1 pt-1">{rows.map((person,index)=>{const tier=tierFor(person.level);return <li key={person.id} className="relative shrink-0" onMouseEnter={()=>setOpen(person.id)} onMouseLeave={()=>setOpen(null)}><div className={`lovable-elo-card ${person.you?"is-you":""}`} style={open===person.id?{boxShadow:`0 10px 30px ${tier.glow}`}:{}}><span className="font-display text-sm font-bold text-muted-foreground">#{index+1}</span><ProfileAvatar name={person.name} size={34}/><div className="min-w-0"><p className="truncate text-sm font-semibold">{person.name}</p><p className="mt-0.5 flex items-center gap-1.5 text-[11px]"><span className="h-2 w-2 rounded-full" style={{background:tier.color,boxShadow:`0 0 8px ${tier.glow}`}}/><span className="text-muted-foreground">{tier.name}</span><span className="rounded px-1.5 font-display font-bold text-background" style={{backgroundImage:gradient(tier)}}>{person.level}</span></p></div></div>
      {open===person.id?<div className="lovable-elo-popup"><div className="flex items-center gap-3"><ProfileAvatar name={person.name} size={48}/><div className="min-w-0"><p className="truncate font-display font-bold">{person.name}</p><p className="truncate text-[11px] text-muted-foreground">{person.handle}</p><p className="mt-1 flex items-center gap-1.5 text-[11px] text-success"><span className="h-1.5 w-1.5 rounded-full bg-success"/>online</p></div></div><p className="mt-3 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold text-background" style={{backgroundImage:gradient(tier)}}>{tier.name.toUpperCase()} • LEVEL {person.level}</p></div>:null}
    </li>})}</ol>
  </section>;
}

export function LevelHero({display,username,level,xp,game,onSelectGame,games,onOpenProfile}:{display:string;username:string;level:number;xp:number;game:HomeGame;games:HomeGame[];onSelectGame:(id:number)=>void;onOpenProfile:()=>void}){
  const tier=tierFor(level);const need=400+level*220;const within=xp%need;const pct=Math.min(100,Math.round(within/need*100));const nextTier=TIERS.find(item=>item.from>level);
  return <section className="lovable-panel lovable-level-hero relative overflow-hidden px-5 py-6"><div className="grid items-center gap-6 lg:grid-cols-[auto_1fr_auto]">
    <div className="relative mx-auto"><span className="absolute inset-0 rounded-full blur-2xl" style={{background:tier.color,opacity:.35}}/><Image src="/brand/ascent-portal.png" alt="Emblema GrindLobby" width={512} height={512} priority className="relative h-40 w-40 object-contain" style={{filter:`drop-shadow(0 0 34px ${tier.glow})`}}/></div>
    <div><p className="lovable-label">Seu progresso</p><div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="font-display text-4xl font-bold">Level {level}</h1><span className="rounded-md px-2.5 py-1 font-display text-[11px] font-bold tracking-wide text-background" style={{backgroundImage:gradient(tier)}}>{tier.name.toUpperCase()}</span><label className="lovable-btn-ghost relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium"><Sparkles size={14} className="text-primary-glow"/><select aria-label="Jogo principal" value={game.id} onChange={event=>onSelectGame(Number(event.target.value))} className="appearance-none bg-transparent pr-4 outline-none">{games.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2 text-muted-foreground"/></label></div>
      <div className="mt-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>XP do level</span><span><b className="text-foreground">{within.toLocaleString("pt-BR")}</b> / {need.toLocaleString("pt-BR")} XP</span></div><div className="relative mt-2 h-3.5 overflow-hidden rounded-full bg-secondary"><div className={tier.aura>=3?"lovable-xp-fill lovable-xp-shift":"lovable-xp-fill"} style={{width:`${pct}%`,backgroundImage:gradient(tier),boxShadow:`0 0 ${tier.aura*9}px ${tier.glow}`}}>{tier.aura>=2?<span className="lovable-bar-shimmer"/>:null}</div></div><p className="mt-2 text-xs text-muted-foreground">Faltam {(need-within).toLocaleString("pt-BR")} XP para o level {level+1}{nextTier?<> • próximo elo: <span style={{color:nextTier.glow}}>{nextTier.name}</span> no level {nextTier.from}</>:null}</p></div>
      <div className="mt-4 flex flex-wrap gap-2"><button onClick={onOpenProfile} className="lovable-btn-primary flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"><Trophy size={14}/>Ver meu rank</button><button onClick={onOpenProfile} className="lovable-btn-ghost rounded-lg px-3 py-2 text-xs font-medium">Configurar perfil</button></div>
      <div className="mt-4 flex flex-wrap gap-1.5">{TIERS.map(item=><span key={item.name} title={`${item.name} — level ${item.from}-${item.to}`} className="h-1.5 w-10 rounded-full" style={{backgroundImage:gradient(item),opacity:level>=item.from?1:.25}}/>)}</div>
    </div>
    <div className="flex flex-col items-center gap-3 lg:border-l lg:border-border lg:pl-6"><ProfileAvatar name={display} size={78}/><div className="text-center"><p className="font-display text-lg font-bold">{display}</p><p className="text-xs text-muted-foreground">@{username}</p><p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">{game.rank} <Info size={14}/></p></div></div>
  </div></section>;
}

type Track={id:string;title:string;artist:string;duration:number;by:string;audio:string;shareUrl?:string;license?:string};
type MusicSearchResult={id:string;title:string;artist:string;duration:number;audio:string;shareUrl?:string;license?:string};
const formatTime=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,"0")}`;
export function MusicBot(){
  const [queue,setQueue]=useState<Track[]>([]),[current,setCurrent]=useState(0),[playing,setPlaying]=useState(false),[elapsed,setElapsed]=useState(0),[volume,setVolume]=useState(65),[loop,setLoop]=useState(false),[input,setInput]=useState(""),[popup,setPopup]=useState(false),[hidden,setHidden]=useState(false);
  const [results,setResults]=useState<MusicSearchResult[]>([]),[searching,setSearching]=useState(false),[searchError,setSearchError]=useState("");
  const audioRef=useRef<HTMLAudioElement|null>(null),track=queue[current];
  useEffect(()=>{const audio=audioRef.current;if(!audio)return;audio.volume=Math.max(0,Math.min(1,volume/100))},[volume]);
  useEffect(()=>{const audio=audioRef.current;if(!audio)return;if(!track){audio.pause();audio.removeAttribute("src");audio.load();setPlaying(false);setElapsed(0);return}audio.src=track.audio;audio.currentTime=0;setElapsed(0);if(playing)audio.play().catch(()=>setPlaying(false))},[track?.id]);
  async function togglePlay(){const audio=audioRef.current;if(!audio||!track)return;if(audio.paused){try{await audio.play();setPlaying(true)}catch{setPlaying(false)}}else{audio.pause();setPlaying(false)}}
  function skip(direction:1|-1){if(!queue.length)return;setCurrent(index=>(index+direction+queue.length)%queue.length)}
  function addResult(result:MusicSearchResult){setQueue(items=>{const next=[...items,{...result,by:"você"}];if(items.length===0)setCurrent(0);return next});setResults([]);setInput("")}
  async function searchTracks(event:FormEvent){event.preventDefault();const value=input.trim();if(!value)return;setSearching(true);setSearchError("");try{const response=await fetch(`/api/music/search?q=${encodeURIComponent(value)}`,{cache:"no-store"});const body=await response.json() as {results?:MusicSearchResult[];error?:string};if(!response.ok)throw new Error(body.error||"Busca indisponível");setResults(body.results??[]);if(!(body.results??[]).length)setSearchError("Nenhuma faixa encontrada.")}catch(error){setSearchError(error instanceof Error?error.message:"Não foi possível buscar músicas.")}finally{setSearching(false)}}
  function onEnded(){if(loop){const audio=audioRef.current;if(audio){audio.currentTime=0;audio.play().catch(()=>setPlaying(false))}return}if(queue.length>1)skip(1);else setPlaying(false)}
  if(popup&&hidden)return <button onClick={()=>setHidden(false)} className="lovable-panel flex w-full items-center gap-3 p-4 text-left"><Disc3 className={playing?"lovable-spin-slow text-primary-glow":"text-primary-glow"} size={20}/><span className="min-w-0 flex-1"><b className="block truncate text-sm">{track?.title??"Fila vazia"}</b><span className="lovable-label">bot em popup — clique para reabrir</span></span><Maximize2 size={16}/></button>;
  return <section className={popup?"lovable-panel lovable-music-popup p-5":"lovable-panel p-5"}><audio ref={audioRef} preload="none" onTimeUpdate={event=>setElapsed(event.currentTarget.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={onEnded}/><div className="flex items-center justify-between gap-2"><p className="lovable-label flex items-center gap-2"><Disc3 className={playing?"lovable-spin-slow text-primary-glow":"text-primary-glow"} size={16}/>Grind Beats — bot de música</p><div className="flex items-center gap-1.5"><span className="hidden rounded-md border border-border bg-panel px-2 py-1 text-[11px] text-muted-foreground sm:flex">catálogo Jamendo</span><button onClick={()=>setPopup(value=>!value)} aria-label={popup?"Encaixar no painel":"Abrir em popup"} className="lovable-btn-ghost grid h-8 w-8 place-items-center rounded-lg">{popup?<Minimize2 size={14}/>:<Maximize2 size={14}/>}</button>{popup?<button onClick={()=>setHidden(true)} aria-label="Minimizar popup" className="lovable-btn-ghost grid h-8 w-8 place-items-center rounded-lg"><X size={14}/></button>:null}</div></div>
    <div className="mt-4 flex items-center gap-4 rounded-xl border border-border bg-panel/60 p-3"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/70 to-primary-glow/60"><Disc3 className={playing?"lovable-spin-slow":""} size={32}/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{track?.title??"Nenhuma música na fila"}</p><p className="truncate text-xs text-muted-foreground">{track?`${track.artist} • pedido por ${track.by}`:"busque uma faixa abaixo"}</p><div className="mt-2 flex items-end gap-[2px]">{Array.from({length:26}).map((_,index)=><span key={index} className={playing?"lovable-eq-bar is-playing":"lovable-eq-bar"} style={{height:5+(index*5)%14,animationDelay:`${index%7*.12}s`}}/>)}</div><div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground"><span>{formatTime(elapsed)}</span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><span className="block h-full bg-gradient-to-r from-primary to-primary-glow" style={{width:`${track?.duration?Math.min(100,elapsed/track.duration*100):0}%`}}/></span><span>{track?formatTime(track.duration):"0:00"}</span></div></div></div>
    <div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={()=>skip(-1)} disabled={!queue.length} aria-label="Anterior" className="lovable-btn-ghost grid h-10 w-10 place-items-center rounded-lg disabled:opacity-40"><SkipBack size={16}/></button><button onClick={togglePlay} disabled={!track} aria-label={playing?"Pausar":"Tocar"} className="lovable-btn-primary grid h-11 w-11 place-items-center rounded-full disabled:opacity-40">{playing?<Pause size={20}/>:<Play size={20}/>}</button><button onClick={()=>skip(1)} disabled={!queue.length} aria-label="Próxima" className="lovable-btn-ghost grid h-10 w-10 place-items-center rounded-lg disabled:opacity-40"><SkipForward size={16}/></button><button onClick={()=>setLoop(value=>!value)} aria-label="Repetir" className={loop?"grid h-10 w-10 place-items-center rounded-lg border border-primary/50 bg-primary/20 text-primary-glow":"lovable-btn-ghost grid h-10 w-10 place-items-center rounded-lg"}><Repeat size={16}/></button><div className="ml-auto flex min-w-[140px] items-center gap-2"><Volume2 size={16} className="text-muted-foreground"/><input type="range" min={0} max={100} value={volume} aria-label="Volume do bot" onChange={event=>setVolume(Number(event.target.value))} className="h-1.5 w-full accent-purple-500"/><span className="w-8 text-right text-xs text-muted-foreground">{volume}</span></div></div>
    <form onSubmit={searchTracks} className="mt-3 flex gap-2"><div className="relative min-w-0 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={input} onChange={event=>setInput(event.target.value)} placeholder="Buscar música ou artista" className="w-full rounded-lg border border-input bg-panel py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary/60"/></div><button type="submit" disabled={searching} className="lovable-btn-primary flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold disabled:opacity-50">{searching?<Loader2 size={16} className="animate-spin"/>:<Search size={16}/>}Buscar</button></form>
    {searchError?<p className="mt-2 text-xs text-destructive">{searchError}</p>:null}
    {results.length?<div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-2"><p className="lovable-label px-1 pb-1">Resultados</p><ul className="max-h-48 space-y-1 overflow-y-auto">{results.map(result=><li key={result.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-secondary"><button type="button" onClick={()=>addResult(result)} className="min-w-0 flex-1 text-left"><b className="block truncate text-sm">{result.title}</b><span className="block truncate text-[11px] text-muted-foreground">{result.artist} • {formatTime(result.duration)}</span></button><Plus size={15} className="text-primary-glow"/></li>)}</ul></div>:null}
    <div className="mt-3 rounded-xl border border-border bg-panel/50 p-3"><p className="lovable-label flex items-center gap-2"><ListMusic size={14}/>Fila ({queue.length})</p>{queue.length?<ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">{queue.map((item,index)=><li key={item.id} className={index===current?"flex items-center gap-3 rounded-lg bg-primary/15 px-2 py-2 text-sm":"flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-secondary"}><button onClick={()=>setCurrent(index)} className="min-w-0 flex-1 truncate text-left">{index+1}. {item.title}</button><span className="text-[11px] text-muted-foreground">{formatTime(item.duration)}</span></li>)}</ul>:<p className="mt-2 text-xs text-muted-foreground">A fila está vazia.</p>}</div>
    <p className="mt-2 text-[10px] text-muted-foreground">Faixas independentes via Jamendo. Configure <code>JAMENDO_CLIENT_ID</code> no servidor para habilitar a busca em produção.</p>
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

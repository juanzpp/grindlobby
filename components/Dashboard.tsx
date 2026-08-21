"use client";

import Image from "next/image";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {
  Activity,Bell,ChevronRight,Crown,Gift,Globe,LayoutGrid,Loader2,
  LogOut,Mic,Monitor,MonitorUp,MoreVertical,Plus,Search,Server,Settings,
  SignalHigh,Sparkles,Star,Store,Trophy,UserPlus,Users,Video,Volume2,Wifi,
} from "lucide-react";
import AudioSettings from "@/components/AudioSettings";
import LovableBrand from "@/components/brand/LovableBrand";
import GrindPortalLoading from "@/components/feedback/GrindPortalLoading";
import {ConnectionPanel,EventTicker,LevelHero,MusicBot,ProfileAvatar,TopElos} from "@/components/dashboard/LovableWidgets";
import {ProfileHoverTrigger,type HoverPlayerData} from "@/components/profile/HoverProfileCard";
import StoreShowcase from "@/components/dashboard/StoreShowcase";

type GameCard={
  id:number;name:string;slug:string;rank:string;points:number;wins:number;losses:number;
  matches:number;winRate:number;progress:number;nextDivision:string;
};
type LobbyMember={userId:string;role:string;joinedAt:string;profile:{id:string;username:string;display_name:string;avatar:string|null;avatar_frame?:string|null;profile_effect?:string|null;profile_badge?:string|null;profile_banner?:string|null}|null;player:HoverPlayerData|null};
type LobbyCard={
  id:string;owner_id:string;game_id:number|null;name:string;description:string|null;
  visibility:string;max_members:number;status:string;created_at:string;
  game:{id:number;name:string;slug:string}|null;
  owner:{id:string;username:string;display_name:string;avatar:string|null;status:string;avatar_frame?:string|null;profile_effect?:string|null;profile_badge?:string|null;profile_banner?:string|null}|null;
  memberCount:number;joined:boolean;members?:LobbyMember[];
};
type OnlineUser={id:string;username:string;display_name:string;avatar:string|null;status:string;player:HoverPlayerData};
type DashboardData={
  games:GameCard[];
  lobbies:LobbyCard[];
  currentLobby:LobbyCard|null;
  online:OnlineUser[];
  topPlayers:HoverPlayerData[];
  account:{username:string;displayName:string;level:number;xp:number;avatar:string|null;banner:string|null;frame:string|null;effect:string|null;badge:string|null;cardStyle:string|null};
  entitlements:{tier:"free"|"pro";isAdmin:boolean};
  stats:{online:number;activeLobbies:number;myLobbies:number;rank:number};
};
type View="dashboard"|"lobbies"|"rank"|"store"|"pro"|"settings";
type DashboardUser={id:string;username:string;display_name:string;email?:string;account_tier?:string;app_role?:string};

const fallbackGames:GameCard[]=[
  {id:0,name:"EA FC 27",slug:"ea-fc-27",rank:"Sem rank",points:0,wins:0,losses:0,matches:0,winRate:0,progress:0,nextDivision:"Complete sua primeira partida ranqueada"},
];
const events=[
  {day:"24",month:"MAI",title:"Copa GrindLobby",sub:"Campeonato oficial",cta:"Inscrever-se",soon:false},
  {day:"01",month:"JUN",title:"Torneio 5v5",sub:"Premiação em dinheiro",cta:"Inscrever-se",soon:false},
  {day:"15",month:"JUN",title:"Night Cup",sub:"Somente convidados",cta:"Em breve",soon:true},
];
const nav:Array<{key:View;label:string;icon:typeof LayoutGrid}>=[
  {key:"dashboard",label:"Dashboard",icon:LayoutGrid},
  {key:"lobbies",label:"Lobbies",icon:Users},
  {key:"rank",label:"Rank",icon:Trophy},
  {key:"store",label:"Loja",icon:Store},
  {key:"pro",label:"Pro",icon:Star},
  {key:"settings",label:"Configurações",icon:Settings},
];

function initials(value:string){return value.trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()||"GL"}
function roleLabel(role:string){return role==="owner"?"HOST":role==="moderator"?"MODERADOR":"MEMBRO"}
function visibilityLabel(value:string){return value==="public"?"Pública":value==="friends"?"Amigos":"Privada"}

function Avatar({name,size=32,avatarUrl}:{name:string;size?:number;avatarUrl?:string|null}){
  return <span className="lovable-avatar grid shrink-0 place-items-center overflow-hidden rounded-full font-display text-xs font-bold text-white" style={{width:size,height:size}}>{avatarUrl?<img src={avatarUrl} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer"/>:initials(name).slice(0,1)}</span>;
}

function Waveform({bars=18,active=false}:{bars?:number;active?:boolean}){
  return <span className="lovable-wave flex items-end gap-[2px]" aria-hidden="true">{Array.from({length:bars}).map((_,index)=><span key={index} className={active&&index<bars*.55?"bg-primary-glow":"bg-muted"} style={{height:6+(index*7)%12}}/>)}</span>;
}

export default function Dashboard({user,initialView="dashboard"}:{user:DashboardUser;initialView?:View}){
  const router=useRouter();
  const [data,setData]=useState<DashboardData|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [view,setView]=useState<View>(initialView);
  const [selectedGameId,setSelectedGameId]=useState<number|null>(null);
  const [search,setSearch]=useState("");
  const [create,setCreate]=useState(false);
  const [name,setName]=useState("");
  const [gameId,setGameId]=useState("");
  const [maxMembers,setMaxMembers]=useState("8");
  const [visibility,setVisibility]=useState("public");
  const display=data?.account?.displayName||user.display_name||user.username||"Player";
  const profileUsername=data?.account?.username||user.username;
  const games=data?.games?.length?data.games:fallbackGames;
  const selectedGame=useMemo(()=>games.find(game=>game.id===selectedGameId)??games[0],[games,selectedGameId]);
  const filteredLobbies=useMemo(()=>{
    const term=search.trim().toLocaleLowerCase("pt-BR");
    if(!term)return data?.lobbies??[];
    return (data?.lobbies??[]).filter(lobby=>`${lobby.name} ${lobby.game?.name??""} ${lobby.owner?.display_name??""} ${lobby.owner?.username??""}`.toLocaleLowerCase("pt-BR").includes(term));
  },[data?.lobbies,search]);

  const load=useCallback(async(initial=false)=>{
    initial?setLoading(true):setRefreshing(true);
    try{
      const response=await fetch("/api/dashboard",{cache:"no-store"});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Falha ao carregar o dashboard.");
      setData(body as DashboardData);
      setSelectedGameId(current=>current??body.games?.[0]?.id??null);
      setGameId(current=>current||String(body.games?.[0]?.id??""));
      setError("");
      sessionStorage.removeItem("grindlobby.portalTransition");
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao carregar o dashboard.")}
    finally{setLoading(false);setRefreshing(false)}
  },[]);

  useEffect(()=>{
    void load(true);
    const timer=window.setInterval(()=>void load(false),15_000);
    const refreshProfile=()=>void load(false);
    window.addEventListener("grindlobby:profile-updated",refreshProfile);
    return()=>{window.clearInterval(timer);window.removeEventListener("grindlobby:profile-updated",refreshProfile)};
  },[load]);

  async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.push("/login");router.refresh()}
  async function createLobby(){
    setError("");
    if(!name.trim()||!gameId){setError("Preencha nome e jogo.");return}
    setBusy("create");
    try{
      const response=await fetch("/api/lobbies",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,gameId:Number(gameId),maxMembers:Number(maxMembers),visibility})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Falha ao criar lobby.");
      setCreate(false);setName("");router.push("/lobby/"+body.lobbyId);
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao criar lobby.")}
    finally{setBusy(null)}
  }
  async function enterLobby(lobby:LobbyCard){
    setBusy(lobby.id);setError("");
    try{
      if(!lobby.joined){const response=await fetch(`/api/lobbies/${lobby.id}/join`,{method:"POST"});const body=await response.json();if(!response.ok)throw new Error(body.error||"Não foi possível entrar.")}
      router.push(`/lobby/${lobby.id}`);
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível entrar.")}
    finally{setBusy(null)}
  }
  async function leaveCurrentLobby(){
    const lobby=data?.currentLobby;if(!lobby)return;
    setBusy("leave-current");setError("");
    try{const response=await fetch(`/api/lobbies/${lobby.id}/leave`,{method:"POST"});const body=await response.json();if(!response.ok)throw new Error(body.error||"Não foi possível sair.");await load(false)}
    catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível sair.")}
    finally{setBusy(null)}
  }
  async function inviteCurrentLobby(){
    const lobby=data?.currentLobby;
    if(!lobby){setError("Entre em um lobby antes de criar um convite.");return}
    try{await navigator.clipboard.writeText(`${location.origin}/lobby/${lobby.id}`)}catch{setError("Não foi possível copiar o convite neste navegador.")}
  }
  function addPlayer(player:HoverPlayerData){
    setError("");
    setNotice(`Pedido para adicionar @${player.username} preparado. O módulo de amizades ainda não tem backend próprio.`);
  }
  async function callPlayer(player:HoverPlayerData){
    setError("");
    const lobby=data?.currentLobby;
    if(!lobby){setNotice(`Entre em um lobby para chamar @${player.username}.`);return}
    try{
      await navigator.clipboard.writeText(`${location.origin}/lobby/${lobby.id}`);
      setNotice(`Convite do lobby copiado para chamar @${player.username}.`);
    }catch{setError("Não foi possível preparar o convite neste navegador.")}
  }

  if(loading&&!data)return <GrindPortalLoading variant="fullscreen" label="Sincronizando seu Grind"/>;

  const currentLobby=data?.currentLobby;
  const stats=data?.stats??{online:1,activeLobbies:0,myLobbies:0,rank:0};
  const account=data?.account??{username:user.username,displayName:user.display_name||user.username,level:1,xp:0,avatar:null,banner:null,frame:null,effect:null,badge:null,cardStyle:null};
  const isPro=data?.entitlements.tier==="pro";
  const isAdmin=Boolean(data?.entitlements.isAdmin);

  return <div className="lovable-surface lovable-dashboard-theme">
    <div className="flex min-h-screen">
      <aside className="lovable-dashboard-sidebar hidden w-64 shrink-0 flex-col justify-between border-r border-border bg-card/60 px-5 py-6 lg:flex">
        <div>
          <LovableBrand/>
          <nav className="lovable-sidebar-nav mt-8 space-y-1">{nav.slice(0,2).map(({key,label,icon:Icon})=><button key={key} onClick={()=>setView(key)} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium ${view===key?"border-primary/40 bg-primary/15 text-foreground shadow-[0_0_20px_oklch(0.58_0.24_300/0.25)]":"border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon size={16}/>{label}{key==="lobbies"&&stats.activeLobbies?<span className="ml-auto rounded-full bg-primary/20 px-2 text-[10px] text-primary-glow">{stats.activeLobbies}</span>:null}</button>)}<Link href="/community" className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"><Users size={16}/>Community<span className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary-glow">BETA</span></Link><Link href="/competitive/valorant" className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"><Trophy size={16}/>Competitivo</Link>{nav.slice(2).map(({key,label,icon:Icon})=><button key={key} onClick={()=>setView(key)} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium ${view===key?"border-primary/40 bg-primary/15 text-foreground shadow-[0_0_20px_oklch(0.58_0.24_300/0.25)]":"border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon size={16}/>{label}</button>)}</nav>
          <div className="mt-6 space-y-2"><button onClick={()=>setCreate(true)} className="lovable-btn-primary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold"><Plus size={16}/>Criar lobby</button><button onClick={inviteCurrentLobby} className="lovable-btn-ghost flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium"><UserPlus size={16}/>Convidar amigos</button></div>
          <div className="mt-8"><p className="lovable-label">Atividade recente</p><ul className="mt-3 space-y-3">{data?.online.slice(0,4).map(person=><li key={person.id}><ProfileHoverTrigger player={person.player} onAdd={()=>addPlayer(person.player)} onCall={()=>void callPlayer(person.player)}><div className="flex items-start gap-2.5 rounded-lg px-1 py-1 transition hover:bg-primary/5"><Avatar name={person.display_name||person.username} avatarUrl={person.avatar} size={28}/><div className="text-xs leading-tight"><p><span className="font-semibold">{person.display_name||person.username}</span> <span className="text-muted-foreground">está online</span></p><p className="mt-0.5 text-muted-foreground">agora</p></div></div></ProfileHoverTrigger></li>)}{!data?.online.length?<li className="text-xs text-muted-foreground">Sua rede aparecerá aqui.</li>:null}</ul></div>
        </div>
        <div className="mt-8 rounded-xl border border-border bg-panel p-3"><div className="flex items-center gap-3"><ProfileAvatar name={display} avatarUrl={account.avatar} frameId={account.frame} effectId={account.effect} size={40}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{display}</p><p className="truncate text-[11px] text-muted-foreground">Level {account.level} • @{profileUsername}</p><p className="mt-0.5 flex items-center gap-1 text-[11px] text-success"><span className="h-1.5 w-1.5 rounded-full bg-success"/>Online</p></div><button onClick={logout} aria-label="Sair" className="text-muted-foreground hover:text-foreground"><LogOut size={17}/></button></div><Link href="/perfil/editar" className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary-glow hover:bg-primary/15">Editar perfil</Link></div>
      </aside>

      <main className="lovable-dashboard-main flex-1 space-y-4 p-4 md:p-6">
        <header className="lovable-panel flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm"><LovableBrand compact emblemSize={34} className="lg:hidden"/>{isAdmin?<><Crown size={16} className="text-primary-glow"/><span className="font-semibold">Admin ativo</span><span className="text-muted-foreground">•</span><span className="font-semibold text-primary-glow">PRO liberado gratuitamente</span></>:isPro?<><Star size={16} className="text-primary-glow"/><span className="font-semibold text-primary-glow">Grind PRO ativo</span></>:<span className="font-semibold">Plano Free</span>}<span className="mx-1 hidden h-4 w-px bg-border sm:block"/><span className="max-w-[16rem] truncate text-muted-foreground">{user.email||`@${user.username}`}</span></div>
          <div className="flex items-center gap-4 text-muted-foreground">{refreshing?<Loader2 size={17} className="animate-spin"/>:<Gift size={18}/>}<span className="relative"><Bell size={18}/><span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">2</span></span><SignalHigh size={18} className="text-success"/></div>
        </header>

        <div className="lovable-mobile-nav flex gap-2 overflow-x-auto pb-1 lg:hidden">{nav.slice(0,2).map(({key,label,icon:Icon})=><button key={key} onClick={()=>setView(key)} className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs ${view===key?"border-primary/40 bg-primary/15 text-foreground":"border-border bg-card text-muted-foreground"}`}><Icon size={14}/>{label}</button>)}<Link href="/community" className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><Users size={14}/>Community</Link><Link href="/competitive/valorant" className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><Trophy size={14}/>Competitivo</Link>{nav.slice(2).map(({key,label,icon:Icon})=><button key={key} onClick={()=>setView(key)} className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs ${view===key?"border-primary/40 bg-primary/15 text-foreground":"border-border bg-card text-muted-foreground"}`}><Icon size={14}/>{label}</button>)}</div>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15}/><input value={search} onChange={event=>setSearch(event.target.value)} onFocus={()=>setView("lobbies")} aria-label="Buscar lobbies" placeholder="Buscar players, jogos e lobbies" className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60 lg:hidden"/></div>
        {error?<div className="lovable-feedback lovable-feedback-error" role="alert">{error}</div>:null}{notice?<div className="lovable-feedback lovable-feedback-info" role="status">{notice}</div>:null}

        {view==="dashboard"?<>
          <EventTicker display={display} isAdmin={isAdmin} isPro={isPro} activeLobbies={stats.activeLobbies}/>
          <TopElos players={data?.topPlayers??[]} onAdd={player=>player.id===user.id?undefined:addPlayer(player)} onCall={player=>player.id===user.id?undefined:void callPlayer(player)}/>
          {selectedGame?<LevelHero display={display} username={profileUsername} level={account.level} xp={account.xp} game={selectedGame} games={games} onSelectGame={setSelectedGameId} onOpenProfile={()=>setView("rank")} avatarUrl={account.avatar} frameId={account.frame} effectId={account.effect} badgeLabel={account.badge}/>:null}

          <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <section className="lovable-panel p-5">
              <p className="lovable-label">Lobby atual</p>
              {currentLobby?<><div className="mt-2 flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-2xl font-bold">{currentLobby.name}</h2><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="flex items-center gap-1.5 rounded-md border border-border bg-panel px-2 py-1"><Globe size={14}/>{visibilityLabel(currentLobby.visibility)}</span><span className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-2 py-1"><Trophy size={14} className="text-warning"/>Competitiva</span><span className="flex items-center gap-1.5 rounded-md border border-border bg-panel px-2 py-1"><Sparkles size={14} className="text-primary-glow"/>{currentLobby.game?.name??"Jogo livre"}</span></div></div><div className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-2"><ProfileAvatar name={currentLobby.owner?.display_name||currentLobby.owner?.username||"Host"} avatarUrl={currentLobby.owner?.avatar} frameId={currentLobby.owner?.avatar_frame} effectId={currentLobby.owner?.profile_effect} size={34}/><div className="text-xs"><p className="text-muted-foreground">Host</p><p className="flex items-center gap-1 font-semibold">{currentLobby.owner?.display_name||currentLobby.owner?.username||"Player"}<Crown size={14} className="text-warning"/></p></div></div><p className="flex items-center gap-2 text-sm"><Users size={16} className="text-muted-foreground"/><b>{currentLobby.memberCount}</b><span className="text-muted-foreground">/ {currentLobby.max_members}</span></p><button onClick={inviteCurrentLobby} className="lovable-btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm"><UserPlus size={15}/>Convidar</button></div></div><div className="mt-5 rounded-xl border border-border bg-panel/50 p-3"><p className="lovable-label px-1">Membros ({currentLobby.memberCount}/{currentLobby.max_members})</p><ul className="lovable-member-list mt-2">{currentLobby.members?.map(member=>{const memberName=member.profile?.display_name||member.profile?.username||"Player";const row=<div className="flex items-center gap-3 px-1 py-2.5 text-sm"><span className="relative"><ProfileAvatar name={memberName} avatarUrl={member.profile?.avatar} frameId={member.player?.frame} effectId={member.player?.effect} size={32}/><span className="lovable-presence-dot absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success"/></span><div className="min-w-0"><p className="font-semibold">{memberName}</p><p className="text-xs text-muted-foreground">@{member.profile?.username??"player"}</p></div><div className="ml-auto flex items-center gap-3"><Mic size={16} className="text-muted-foreground"/><Waveform bars={14}/><span className={member.role==="owner"?"rounded-md border border-primary/40 bg-primary/20 px-2 py-1 text-[10px] font-bold":"lovable-label"}>{roleLabel(member.role)}</span><MoreVertical size={16} className="text-muted-foreground"/></div></div>;return <li key={member.userId} className="rounded-lg transition hover:bg-primary/5">{member.player?<ProfileHoverTrigger player={member.player} onAdd={member.userId===user.id?undefined:()=>addPlayer(member.player!)} onCall={member.userId===user.id?undefined:()=>void callPlayer(member.player!)}>{row}</ProfileHoverTrigger>:row}</li>})}</ul></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button onClick={leaveCurrentLobby} disabled={busy==="leave-current"} className="lovable-btn-ghost flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm"><LogOut size={15}/>{busy==="leave-current"?"Saindo…":"Sair do lobby"}</button><button onClick={()=>enterLobby(currentLobby)} className="lovable-btn-primary flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm"><Settings size={15}/>Abrir lobby</button></div></>:<div className="mt-5 grid min-h-56 place-items-center rounded-xl border border-dashed border-border bg-panel/30 p-6 text-center"><div><Users className="mx-auto text-primary-glow" size={32}/><h2 className="mt-3 font-display text-2xl font-bold">Nenhum lobby atual</h2><p className="mt-1 text-sm text-muted-foreground">Crie ou entre em uma sala para reunir sua squad.</p><button onClick={()=>setCreate(true)} className="lovable-btn-primary mx-auto mt-5 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm"><Plus size={16}/>Criar lobby</button></div></div>}
            </section>

            <div className="space-y-4"><section className="lovable-panel p-5"><div className="flex items-center justify-between"><p className="lovable-label">Controles de áudio</p><Activity size={16} className="text-primary-glow"/></div><div className="mt-4 space-y-4"><div><p className="text-sm text-muted-foreground">Microfone</p><div className="mt-2 flex items-center gap-3"><div className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-border bg-panel px-3 py-2.5 text-sm"><span className="truncate">{currentLobby?"Disponível no lobby":"Aguardando lobby"}</span><ChevronRight size={15} className="text-muted-foreground"/></div><Waveform active={Boolean(currentLobby)}/><span className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-panel"><Mic size={16}/></span></div></div><div><p className="text-sm text-muted-foreground">Saída de áudio</p><div className="mt-2 flex items-center gap-3"><div className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-border bg-panel px-3 py-2.5 text-sm"><span className="truncate">Gerenciada dentro da sala</span><ChevronRight size={15} className="text-muted-foreground"/></div><Waveform/><span className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-panel"><Volume2 size={16}/></span></div></div><div className="grid gap-3 sm:grid-cols-2"><button disabled={!currentLobby} onClick={()=>currentLobby&&enterLobby(currentLobby)} className="flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-3 text-sm font-medium disabled:opacity-50"><Monitor size={16}/>Compartilhar tela</button><button disabled={!currentLobby} onClick={()=>currentLobby&&enterLobby(currentLobby)} className="lovable-btn-primary flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold"><MonitorUp size={16}/>Abrir lobby</button></div></div></section><ConnectionPanel active={Boolean(currentLobby)} onOpen={()=>currentLobby&&void enterLobby(currentLobby)}/><section className="lovable-panel p-5"><p className="lovable-label">Status do sistema</p><ul className="mt-3 space-y-2.5 text-sm"><li className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Video size={16}/>Qualidade da transmissão</span><span className="font-medium">{isPro?"1080p60":"720p30"}</span></li><li className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Wifi size={16}/>Conexão</span><span className="font-medium text-success">Online</span></li><li className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Server size={16}/>Serviços</span><span className="font-medium text-success">Disponíveis</span></li></ul></section></div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]"><div className="space-y-4"><MusicBot/><StoreShowcase display={display} isAdmin={isAdmin}/></div><section className="lovable-panel p-5"><div className="flex items-center justify-between"><p className="lovable-label">Próximos eventos</p><span className="text-sm text-primary-glow">Calendário</span></div><ul className="mt-4 space-y-3">{events.map(event=><li key={event.title} className="flex items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-primary/40 bg-primary/15"><span className="font-display text-lg font-bold leading-none">{event.day}</span><span className="text-[10px] text-muted-foreground">{event.month}</span></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{event.title}</p><p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"><Trophy size={14} className="text-warning"/>{event.sub}</p></div><button disabled={event.soon} className="rounded-lg border border-primary/40 bg-primary/15 px-3 py-2 text-xs font-semibold disabled:border-border disabled:bg-secondary disabled:text-muted-foreground">{event.cta}</button></li>)}</ul></section></div>
        </>:null}

        {view==="lobbies"?<section className="lovable-dashboard-view lovable-panel p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="lovable-label">Play now</p><h1 className="mt-1 font-display text-3xl font-bold">Lobbies disponíveis</h1></div><div className="flex flex-1 justify-end gap-3"><label className="relative hidden w-full max-w-sm sm:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15}/><input value={search} onChange={event=>setSearch(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-panel pl-9 pr-3 text-sm outline-none focus:border-primary/60" placeholder="Buscar lobby"/></label><button onClick={()=>setCreate(true)} className="lovable-btn-primary flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm"><Plus size={16}/>Criar lobby</button></div></div><div className="mt-6 grid gap-3 lg:grid-cols-2">{filteredLobbies.map(lobby=><article key={lobby.id} className="flex items-center gap-3 rounded-xl border border-border bg-panel/50 p-4"><Avatar name={lobby.name} size={44}/><div className="min-w-0 flex-1"><h2 className="truncate font-display text-lg font-bold">{lobby.name}</h2><p className="truncate text-xs text-muted-foreground">{lobby.game?.name??"Jogo livre"} · {lobby.owner?.display_name??lobby.owner?.username??"Player"}</p></div><div className="text-center"><p className="lovable-label">Membros</p><b className="text-sm">{lobby.memberCount}/{lobby.max_members}</b></div><button disabled={busy===lobby.id||lobby.memberCount>=lobby.max_members} onClick={()=>enterLobby(lobby)} className="lovable-btn-ghost rounded-lg px-3 py-2 text-sm font-semibold text-primary-glow">{busy===lobby.id?<Loader2 size={15} className="animate-spin"/>:lobby.joined?"Abrir":"Entrar"}</button></article>)}{!filteredLobbies.length?<div className="col-span-full grid min-h-64 place-items-center rounded-xl border border-dashed border-border text-muted-foreground">Nenhum lobby encontrado.</div>:null}</div></section>:null}

        {view==="rank"?<section className="lovable-dashboard-view lovable-panel lovable-view-hero p-5"><p className="lovable-label">Identidade competitiva</p><h1 className="mt-1 font-display text-3xl font-bold">Rank por jogo</h1><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{games.map(game=><article key={game.id} className="rounded-xl border border-border bg-card/70 p-5"><div className="flex items-center gap-4"><Image src="/lovable/rank-emblem.png" alt="" width={72} height={72} className="lovable-rank-emblem h-18 w-18 object-contain"/><div><h2 className="font-display text-xl font-bold">{game.name}</h2><p className="text-sm text-primary-glow">{game.rank}</p></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"><div className="lovable-rank-progress h-full" style={{width:`${game.progress}%`}}/></div><dl className="mt-4 grid grid-cols-3 text-center"><div><dt className="lovable-label">RP</dt><dd className="font-bold">{game.points}</dd></div><div><dt className="lovable-label">Partidas</dt><dd className="font-bold">{game.matches}</dd></div><div><dt className="lovable-label">Win rate</dt><dd className="font-bold">{game.winRate}%</dd></div></dl></article>)}</div></section>:null}

        {view==="store"?<div className="lovable-dashboard-view"><StoreShowcase display={display} isAdmin={isAdmin}/></div>:null}
        {view==="pro"?<section className="lovable-dashboard-view lovable-panel lovable-view-hero grid place-items-center p-8 text-center"><div><Image src="/brand/ascent-portal.png" alt="" width={180} height={180} className="lovable-rank-emblem mx-auto"/><p className="lovable-label mt-4">Grind PRO</p><h1 className="mt-2 font-display text-4xl font-bold">{isAdmin?"Admin com PRO ativo":isPro?"Sua conta PRO está ativa":"Eleve sua experiência"}</h1><p className="mx-auto mt-3 max-w-xl text-muted-foreground">{isPro?"O servidor reconhece seu tier e libera transmissão de até 1080p60.":"Contas Free transmitem até 720p30. O PRO libera até 1080p60 e benefícios premium."}</p></div></section>:null}
        {view==="settings"?<section className="lovable-dashboard-view lovable-panel p-5"><AudioSettings/></section>:null}
      </main>
    </div>

    {create?<div className="lovable-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-lobby-title"><section className="lovable-modal"><div className="flex items-start justify-between"><div><p className="lovable-label">Quick create</p><h2 id="create-lobby-title" className="mt-1 font-display text-2xl font-bold">Criar novo lobby</h2><p className="mt-1 text-sm text-muted-foreground">Defina a sala e reúna sua squad.</p></div><button onClick={()=>setCreate(false)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-secondary">×</button></div><div className="mt-5 grid gap-4"><label className="lovable-label">Nome do lobby<input value={name} maxLength={80} onChange={event=>setName(event.target.value)} placeholder="Ex: Night Grind"/></label><label className="lovable-label">Jogo<select value={gameId} onChange={event=>setGameId(event.target.value)}>{games.filter(game=>game.id>0).map(game=><option key={game.id} value={game.id}>{game.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="lovable-label">Vagas<input type="number" min="2" max="100" value={maxMembers} onChange={event=>setMaxMembers(event.target.value)}/></label><label className="lovable-label">Privacidade<select value={visibility} onChange={event=>setVisibility(event.target.value)}><option value="public">Público</option><option value="friends">Amigos</option><option value="private">Privado</option></select></label></div></div><button disabled={busy==="create"} onClick={createLobby} className="lovable-btn-primary mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold">{busy==="create"?<><Loader2 size={16} className="animate-spin"/>Criando…</>:<>Criar lobby</>}</button></section></div>:null}
  </div>;
}

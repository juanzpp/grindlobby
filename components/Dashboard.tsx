"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {
  Activity,ArrowRight,Bell,ChevronRight,Crown,Gamepad2,Headphones,Home,Loader2,
  LogOut,Medal,Mic2,MonitorUp,Plus,Radio,Search,Settings,ShieldCheck,ShoppingBag,
  Sparkles,Trophy,Users,Zap,
} from "lucide-react";
import AudioSettings from "@/components/AudioSettings";
import GrindLobbyLogo from "@/components/brand/GrindLobbyLogo";
import GrindPortalLoading from "@/components/feedback/GrindPortalLoading";
import AgeAssuranceOnboarding from "@/components/age/AgeAssuranceOnboarding";
import type {AgeAssuranceSnapshot,AgeCapabilities} from "@/lib/age-assurance-types";

type GameCard={
  id:number;name:string;slug:string;rank:string;points:number;wins:number;losses:number;
  matches:number;winRate:number;progress:number;nextDivision:string;
};
type LobbyMember={userId:string;role:string;joinedAt:string;profile:{id:string;username:string;display_name:string;avatar:string|null}|null};
type LobbyCard={
  id:string;owner_id:string;game_id:number|null;name:string;description:string|null;
  visibility:string;max_members:number;status:string;created_at:string;
  game:{id:number;name:string;slug:string}|null;
  owner:{id:string;username:string;display_name:string;avatar:string|null;status:string}|null;
  memberCount:number;joined:boolean;members?:LobbyMember[];
};
type OnlineUser={id:string;username:string;display_name:string;avatar:string|null;status:string};
type DashboardData={
  games:GameCard[];
  lobbies:LobbyCard[];
  currentLobby:LobbyCard|null;
  online:OnlineUser[];
  account:{level:number;xp:number};
  entitlements:{tier:"free"|"pro";isAdmin:boolean};
  age:{assurance:AgeAssuranceSnapshot;capabilities:AgeCapabilities};
  stats:{online:number;activeLobbies:number;myLobbies:number;rank:number};
};
type View="dashboard"|"lobbies"|"rank"|"store"|"pro"|"settings";

const fallbackGames:GameCard[]=[
  {id:0,name:"EA FC 27",slug:"ea-fc-27",rank:"Sem rank",points:0,wins:0,losses:0,matches:0,winRate:0,progress:0,nextDivision:"Complete sua primeira partida ranqueada"},
];

function initials(value:string){return value.trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()}
function roleLabel(role:string){return role==="owner"?"Líder":role==="moderator"?"Moderador":"Membro"}

export default function Dashboard({user}:{user:{id:string;username:string;display_name:string;account_tier?:string;app_role?:string}}){
  const router=useRouter();
  const [data,setData]=useState<DashboardData|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [view,setView]=useState<View>("dashboard");
  const [selectedGameId,setSelectedGameId]=useState<number|null>(null);
  const [create,setCreate]=useState(false);
  const [name,setName]=useState("");
  const [gameId,setGameId]=useState("");
  const [maxMembers,setMaxMembers]=useState("5");
  const [visibility,setVisibility]=useState("public");
  const display=user.display_name||user.username||"Player";
  const games=data?.games?.length?data.games:fallbackGames;
  const selectedGame=useMemo(()=>games.find(game=>game.id===selectedGameId)??games[0], [games,selectedGameId]);

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
      if(typeof window!=="undefined")sessionStorage.removeItem("grindlobby.portalTransition");
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Falha ao carregar o dashboard.");
    }finally{setLoading(false);setRefreshing(false)}
  },[]);

  useEffect(()=>{
    load(true);
    const timer=window.setInterval(()=>load(false),15_000);
    return()=>window.clearInterval(timer);
  },[load]);

  async function logout(){
    await fetch("/api/auth/logout",{method:"POST"});
    router.push("/login");router.refresh();
  }

  async function createLobby(){
    setError("");
    if(!name.trim()||!gameId){setError("Preencha nome e jogo.");return}
    setBusy("create");
    try{
      const response=await fetch("/api/lobbies",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name,gameId:Number(gameId),maxMembers:Number(maxMembers),visibility}),
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Falha ao criar lobby.");
      setCreate(false);setName("");
      router.push("/lobby/"+body.lobbyId);
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao criar lobby.")}
    finally{setBusy(null)}
  }

  async function enterLobby(lobby:LobbyCard){
    setBusy(lobby.id);setError("");
    try{
      if(!lobby.joined){
        const response=await fetch("/api/lobbies/"+lobby.id+"/join",{method:"POST"});
        const body=await response.json();
        if(!response.ok)throw new Error(body.error||"Não foi possível entrar.");
      }
      router.push("/lobby/"+lobby.id);
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível entrar.")}
    finally{setBusy(null)}
  }

  async function leaveCurrentLobby(){
    if(!currentLobby)return;
    setBusy("leave-current");setError("");
    try{
      const response=await fetch("/api/lobbies/"+currentLobby.id+"/leave",{method:"POST"});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Não foi possível sair.");
      await load(false);
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível sair.")}
    finally{setBusy(null)}
  }

  async function inviteCurrentLobby(){
    if(!currentLobby)return;
    try{await navigator.clipboard.writeText(location.origin+"/lobby/"+currentLobby.id)}
    catch{setError("Não foi possível copiar o convite neste navegador.")}
  }

  if(loading&&!data)return <GrindPortalLoading variant="fullscreen" label="Sincronizando seu Grind"/>;

  const stats=data?.stats??{online:1,activeLobbies:0,myLobbies:0,rank:0};
  const currentLobby=data?.currentLobby;
  const account=data?.account??{level:1,xp:0};
  const levelProgress=Math.max(0,Math.min(100,account.xp%1000/10));
  const isPro=data?.entitlements.tier==="pro";
  const isAdmin=Boolean(data?.entitlements.isAdmin);
  const blockedReason=data?.age.capabilities.reason;

  const nav:Array<{key:View;label:string;icon:typeof Home}>=[
    {key:"dashboard",label:"Dashboard",icon:Home},
    {key:"lobbies",label:"Lobbies",icon:Users},
    {key:"rank",label:"Rank",icon:Trophy},
    {key:"store",label:"Loja",icon:ShoppingBag},
    {key:"pro",label:"Pro",icon:Crown},
    {key:"settings",label:"Configurações",icon:Settings},
  ];

  return <main className="app-shell dashboard-rebuilt min-h-screen text-white">
    <div className="ambient a1"/><div className="ambient a2"/>
    <div className="relative flex min-h-screen">
      <aside className="sidebar hidden w-[244px] shrink-0 lg:flex lg:flex-col">
        <GrindLobbyLogo variant="full" size="md"/>
        <div className="nav-label">GRIND NETWORK</div>
        <nav className="space-y-1">
          {nav.map(item=><button key={item.key} onClick={()=>setView(item.key)} className={"nav-item "+(view===item.key?"active":"")}>
            <item.icon size={18}/>{item.label}
            {item.key==="lobbies"&&stats.activeLobbies>0&&<em>{stats.activeLobbies}</em>}
          </button>)}
        </nav>
        <div className="sidebar-pro">
          <Crown size={17}/>
          <div><small>{isAdmin?"ADMIN · PRO":"GRIND PRO"}</small><p>{isPro?"1080p60 e benefícios premium ativos.":"Conheça 1080p60 e recursos premium."}</p></div>
        </div>
        <div className="mt-auto">
          <button onClick={logout} className="nav-item"><LogOut size={18}/>Sair</button>
          <div className="profile-mini"><div className="avatar">{initials(display)}<i/></div><div><b>{display}</b><span>{isAdmin?"Administrador · PRO":isPro?"Membro PRO":"Membro Free"}</span></div></div>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="topbar">
          <GrindLobbyLogo variant="symbol" size="sm" className="lg:hidden"/>
          <div className="search"><Search size={16}/><input aria-label="Buscar" placeholder="Buscar players, jogos e lobbies"/></div>
          {refreshing&&<Loader2 className="animate-spin text-violet-300" size={16}/>}
          <button className="icon-btn" aria-label="Notificações"><Bell size={18}/></button>
          <div className="top-profile"><div>{initials(display)}</div><span><b>{display}</b><small>{isAdmin?"ADMIN · PRO":isPro?"PRO":"FREE"}</small></span></div>
        </header>

        <div className="dashboard-ready mx-auto max-w-[1540px] p-4 pb-24 lg:p-8">
          {error&&<div className="dash-error" role="alert">{error}</div>}
          {blockedReason&&!data?.age.capabilities.onboardingRequired&&<div className="age-restriction"><ShieldCheck size={17}/><span>{blockedReason} O restante do dashboard continua disponível.</span></div>}

          {view==="dashboard"&&<>
            <section className="rank-hero" key={selectedGame?.id}>
              <div className="rank-grid"/><div className="rank-orbit"/>
              <div className="rank-copy">
                <div className="eyebrow"><Medal size={13}/> SUA JORNADA COMPETITIVA</div>
                <label className="rank-game-picker">JOGO
                  <select value={selectedGame?.id??""} onChange={event=>setSelectedGameId(Number(event.target.value))}>
                    {games.map(game=><option key={game.id} value={game.id}>{game.name}</option>)}
                  </select>
                </label>
                <h1>{selectedGame?.rank??"Sem rank"}</h1>
                <p>{selectedGame?.name??"Selecione um jogo"} · {selectedGame?.points.toLocaleString("pt-BR")??0} RP</p>
                <div className="rank-progress"><i style={{width:(selectedGame?.progress??0)+"%"}}/></div>
                <div className="rank-next"><span>{selectedGame?.nextDivision}</span><b>{selectedGame?.progress??0}%</b></div>
              </div>
              <div className="rank-emblem" aria-hidden="true"><span>GL</span><i/><b>{selectedGame?.rank==="Sem rank"?"UNRANKED":selectedGame?.rank}</b></div>
              <div className="rank-metrics">
                <div><small>VITÓRIAS</small><b>{selectedGame?.wins??0}</b></div>
                <div><small>PARTIDAS</small><b>{selectedGame?.matches??0}</b></div>
                <div><small>WIN RATE</small><b>{selectedGame?.winRate??0}%</b></div>
                <div className="account-progress"><small>NÍVEL {account.level}</small><b>{account.xp.toLocaleString("pt-BR")} XP</b><span><i style={{width:levelProgress+"%"}}/></span></div>
              </div>
            </section>

            <div className="dashboard-priority-grid">
              <div className="dashboard-primary-column">
                <section className="current-lobby-panel">
                  <header><div><small>SEGUNDA PRIORIDADE</small><h2>Lobby atual</h2></div>{currentLobby&&<button onClick={()=>enterLobby(currentLobby)}>Abrir lobby <ArrowRight size={15}/></button>}</header>
                  {currentLobby?<div className="current-lobby-body">
                    <div className="current-lobby-title"><div><Gamepad2 size={21}/></div><span><h3>{currentLobby.name}</h3><p>{currentLobby.game?.name??"Jogo livre"} · {currentLobby.visibility} · host {currentLobby.owner?.display_name??currentLobby.owner?.username??"Player"} · {currentLobby.memberCount}/{currentLobby.max_members}</p></span><b>ATIVO</b></div>
                    <div className="lobby-member-grid">
                      {currentLobby.members?.map(member=><article key={member.userId}>
                        <div>{initials(member.profile?.display_name||member.profile?.username||"P")}</div>
                        <span><b>{member.profile?.display_name||member.profile?.username||"Player"}</b><small>{roleLabel(member.role)}</small></span>
                        <em title="O estado LiveKit é exibido em tempo real dentro da sala"><Mic2 size={13}/> Na sala</em>
                      </article>)}
                    </div>
                    <p className="presence-truth"><Activity size={14}/> Fala e mute são estados LiveKit em tempo real e aparecem ao abrir o lobby; o dashboard não inventa presença fora da conexão.</p>
                    <div className="current-lobby-actions"><button onClick={inviteCurrentLobby}>Convidar</button><button onClick={leaveCurrentLobby} disabled={busy==="leave-current"}>{busy==="leave-current"?"Saindo…":"Sair"}</button>{currentLobby.owner_id===user.id&&<button onClick={()=>enterLobby(currentLobby)}>Gerenciar</button>}</div>
                  </div>:<div className="current-lobby-empty"><Users size={25}/><div><h3>Nenhum lobby atual</h3><p>Crie ou entre em uma sala para reunir a squad, voz e transmissão.</p></div><button className="primary" onClick={()=>setCreate(true)} disabled={!data?.age.capabilities.canJoinLobbies}><Plus size={16}/>Criar lobby</button></div>}
                </section>

                <section className="store-teaser"><Sparkles size={18}/><small>LOJA</small><h3>Personalize seu Grind</h3><p>Efeitos, borders e crosshairs aparecem como destaque secundário, abaixo do lobby.</p><button onClick={()=>setView("store")}>Ver destaques <ArrowRight size={14}/></button></section>

                <section className="secondary-activity">
                  <header><div><small>REDE</small><h2>Amigos e atividade</h2></div><span>{stats.online} online</span></header>
                  <div className="activity-list">
                    {data?.online.slice(0,5).map(person=><article key={person.id}><div>{initials(person.display_name||person.username)}<i/></div><span><b>{person.display_name||person.username}</b><small>@{person.username} · online</small></span></article>)}
                    {!data?.online.length&&<p>A atividade da sua rede aparecerá aqui.</p>}
                  </div>
                </section>
              </div>

              <aside className="dashboard-context-rail">
                <section className="context-card"><header><Headphones size={17}/><span><small>ÁUDIO</small><b>{currentLobby?"Disponível no lobby":"Em espera"}</b></span></header><p>Microfone e saída são controlados somente quando você abre a sala.</p>{currentLobby&&<button onClick={()=>enterLobby(currentLobby)}>Abrir controles <ChevronRight size={14}/></button>}</section>
                <section className="context-card"><header><MonitorUp size={17}/><span><small>TRANSMISSÃO</small><b>{isPro?"Até 1080p · 60 fps":"Até 720p · 30 fps"}</b></span></header><p>Tela e áudio da tela são publicados pelo LiveKit quando o navegador e a fonte oferecem suporte.</p>{currentLobby&&<button onClick={()=>enterLobby(currentLobby)}>Ir para transmissão <ChevronRight size={14}/></button>}</section>
                <section className="context-card system-card"><header><Radio size={17}/><span><small>SISTEMA</small><b>Conexão sob demanda</b></span></header><p>Voz e tela não ficam conectadas em segundo plano no dashboard.</p></section>
                <section className="context-card"><header><Activity size={17}/><span><small>EVENTOS</small><b>{stats.activeLobbies} lobbies ativos</b></span></header><p>{stats.online} jogadores estão online na rede agora.</p></section>
              </aside>
            </div>
          </>}

          {view==="lobbies"&&<section className="dashboard-view">
            <div className="section-head"><div><small>PLAY NOW</small><h2>Lobbies disponíveis</h2></div><button disabled={!data?.age.capabilities.canJoinLobbies} onClick={()=>setCreate(true)}><Plus size={14}/>Criar lobby</button></div>
            <div className="lobby-list">{data?.lobbies.map(lobby=><article className="lobby" key={lobby.id}><div className="lobby-logo"><Gamepad2 size={19}/></div><div className="lobby-main"><h3>{lobby.name}</h3><p>{lobby.game?.name??"Jogo livre"} · por {lobby.owner?.display_name??lobby.owner?.username??"Player"}</p></div><div className="slots"><small>MEMBROS</small><b>{lobby.memberCount}/{lobby.max_members}</b></div><button disabled={busy===lobby.id||lobby.memberCount>=lobby.max_members} onClick={()=>enterLobby(lobby)} className="join">{busy===lobby.id?<Loader2 size={14} className="animate-spin"/>:lobby.joined?"Abrir":"Entrar"}</button></article>)}{!data?.lobbies.length&&<div className="empty-state">Nenhum lobby visível agora.</div>}</div>
          </section>}

          {view==="rank"&&<section className="dashboard-view">
            <div className="section-head"><div><small>IDENTIDADE COMPETITIVA</small><h2>Rank por jogo</h2></div></div>
            <div className="rank-game-list">{games.map(game=><article key={game.id}><div className="game-logo">{initials(game.name)}</div><span><h3>{game.name}</h3><p>{game.rank} · {game.points.toLocaleString("pt-BR")} RP</p></span><div><b>{game.winRate}%</b><small>WIN RATE</small></div></article>)}</div>
          </section>}

          {view==="store"&&<section className="dashboard-view empty-view"><ShoppingBag size={28}/><small>LOJA E INVENTÁRIO</small><h2>Personalização sem dominar sua home</h2><p>O catálogo, inventário e equipar/desequipar serão uma fase própria. Acesso premium continuará decidido pelo servidor.</p><button className="secondary" onClick={()=>setView("dashboard")}>Voltar ao dashboard</button></section>}
          {view==="pro"&&<section className="dashboard-view empty-view"><Crown size={28}/><small>GRIND PRO</small><h2>{isAdmin?"Admin com PRO de testes ativo":isPro?"Sua conta PRO está ativa":"Recursos para elevar a transmissão"}</h2><p>{isPro?"Seu tier server-side libera até 1080p e 60 fps.":"Free transmite até 720p e 30 fps; PRO libera até 1080p e 60 fps."}</p></section>}
          {view==="settings"&&<AudioSettings/>}
        </div>
      </section>
    </div>

    <nav className="mobile-dashboard-nav lg:hidden" aria-label="Navegação principal">
      {nav.map(item=><button key={item.key} onClick={()=>setView(item.key)} className={view===item.key?"active":""}><item.icon size={17}/><span>{item.label}</span></button>)}
    </nav>

    {data?.age.capabilities.onboardingRequired&&<AgeAssuranceOnboarding onComplete={result=>setData(current=>current?{...current,age:result}:current)}/>}

    {create&&<div className="modal-bg"><div className="modal">
      <div className="modal-head"><div><div className="eyebrow"><Sparkles size={13}/>QUICK CREATE</div><h2>Criar novo lobby</h2><p>Defina a sala e reúna sua squad.</p></div><button onClick={()=>setCreate(false)}>✕</button></div>
      <div className="modal-fields"><label>Nome do lobby<input value={name} maxLength={80} onChange={event=>setName(event.target.value)} placeholder="Ex: Night Grind"/></label><label>Jogo<select value={gameId} onChange={event=>setGameId(event.target.value)}>{games.filter(game=>game.id>0).map(game=><option key={game.id} value={game.id}>{game.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label>Vagas<input type="number" min="2" max="100" value={maxMembers} onChange={event=>setMaxMembers(event.target.value)}/></label><label>Privacidade<select value={visibility} onChange={event=>setVisibility(event.target.value)}><option value="public">Público</option><option value="friends">Amigos</option><option value="private">Privado</option></select></label></div></div>
      <button disabled={busy==="create"} onClick={createLobby} className="primary mt-6 w-full justify-center">{busy==="create"?<><Loader2 size={15} className="animate-spin"/>Criando…</>:<>Criar lobby</>}</button>
    </div></div>}
  </main>;
}

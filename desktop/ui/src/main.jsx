import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import {
  Bell, CalendarDays, Check, ChevronRight, CircleHelp, Gamepad2, Headphones, Home,
  LogOut, Maximize2, MessageCircle, Mic, MicOff, Minimize2, MonitorUp, MoreHorizontal,
  Music2, Plus, RefreshCw, Search, Send, Settings, ShoppingBag, Sparkles, Store,
  Trophy, UserPlus, UserRound, Users, Video, Volume2, Wifi, X
} from "lucide-react";
import {Room, RoomEvent, Track} from "livekit-client";
import "./styles.css";

const invoke=(command,args={})=>window.__TAURI__?.core?.invoke(command,args);
const API=(method,path,body)=>invoke("api_request",{request:{method,path,body:body??null}});
const LS={messages:"grind.desktop.messages",settings:"grind.desktop.settings",equipped:"grind.desktop.equipped"};

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||"")||fallback}catch{return fallback}}
function initials(value="GL"){return value.trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"GL"}
function cx(...parts){return parts.filter(Boolean).join(" ")}

function App(){
  const [boot,setBoot]=useState(true);
  const [session,setSession]=useState("checking");
  const [dashboard,setDashboard]=useState(null);
  const [view,setView]=useState("home");
  const [toast,setToast]=useState(null);
  const [createOpen,setCreateOpen]=useState(false);
  const [call,setCall]=useState(null);
  const [muted,setMuted]=useState(false);
  const [sharing,setSharing]=useState(false);
  const roomRef=useRef(null);

  const notify=useCallback((text,type="ok")=>{setToast({text,type});window.clearTimeout(window.__grindToast);window.__grindToast=window.setTimeout(()=>setToast(null),3300)},[]);
  const loadDashboard=useCallback(async()=>{
    try{
      const response=await API("GET","/api/dashboard");
      if(response?.status===401){setSession("guest");setDashboard(null);return false}
      if(!response?.ok)throw new Error(response?.data?.error||"Não foi possível carregar o GrindLobby.");
      setDashboard(response.data);setSession("ready");return true;
    }catch(error){setSession("guest");notify(error?.message||"Falha de conexão.","error");return false}
  },[notify]);

  useEffect(()=>{(async()=>{await loadDashboard();setBoot(false)})()},[loadDashboard]);
  useEffect(()=>()=>{roomRef.current?.disconnect()},[]);

  const login=async(identifier,password,remember)=>{
    const response=await API("POST","/api/auth/login",{identifier,password,remember});
    if(!response?.ok)throw new Error(response?.data?.error||"Credenciais inválidas.");
    await loadDashboard();notify("Bem-vindo ao GrindLobby.");
  };
  const logout=async()=>{
    try{roomRef.current?.disconnect();roomRef.current=null;await API("POST","/api/auth/logout",{});}finally{setCall(null);setSession("guest");setDashboard(null);notify("Sessão encerrada.")}
  };

  const joinLobby=async(lobby,{openCall=true}={})=>{
    let target=lobby;
    if(!lobby.joined){
      const joined=await API("POST",`/api/lobbies/${lobby.id}/join`,{});
      if(!joined?.ok)throw new Error(joined?.data?.error||"Não foi possível entrar no lobby.");
      target={...lobby,joined:true,memberCount:Math.min(lobby.max_members,(lobby.memberCount||0)+1)};
      await loadDashboard();
    }
    if(openCall)await connectVoice(target);
    notify(`Você entrou em ${lobby.name}.`);
  };

  const connectVoice=async(lobby)=>{
    if(roomRef.current){roomRef.current.disconnect();roomRef.current=null}
    const tokenResponse=await API("POST",`/api/lobbies/${lobby.id}/voice/token`,{});
    if(!tokenResponse?.ok)throw new Error(tokenResponse?.data?.error||"Não foi possível iniciar a call.");
    const {token,url}=tokenResponse.data;
    const room=new Room({adaptiveStream:true,dynacast:true,disconnectOnPageLeave:false});
    const refresh=()=>setCall(prev=>prev?{...prev,participants:[...room.remoteParticipants.values()].map(p=>({id:p.identity,name:p.name||p.identity})),connected:room.state==="connected"}:prev);
    room.on(RoomEvent.ParticipantConnected,refresh);
    room.on(RoomEvent.ParticipantDisconnected,refresh);
    room.on(RoomEvent.ActiveSpeakersChanged,refresh);
    room.on(RoomEvent.TrackSubscribed,(track)=>{
      if(track.kind===Track.Kind.Audio){const element=track.attach();element.autoplay=true;document.getElementById("remote-audio-host")?.appendChild(element)}
      refresh();
    });
    room.on(RoomEvent.Disconnected,()=>setCall(prev=>prev?{...prev,connected:false}:prev));
    await room.connect(url,token,{autoSubscribe:true});
    await room.localParticipant.setMicrophoneEnabled(true);
    roomRef.current=room;setMuted(false);setSharing(false);
    setCall({lobby,connected:true,participants:[...room.remoteParticipants.values()].map(p=>({id:p.identity,name:p.name||p.identity}))});
    setView("call");
  };

  const toggleMic=async()=>{
    const room=roomRef.current;if(!room)return;
    const next=!muted;await room.localParticipant.setMicrophoneEnabled(!next);setMuted(next);notify(next?"Microfone desativado.":"Microfone ativado.");
  };
  const toggleShare=async()=>{
    const room=roomRef.current;if(!room)return;
    const next=!sharing;
    try{await room.localParticipant.setScreenShareEnabled(next,{audio:true});setSharing(next);notify(next?"Transmissão iniciada.":"Transmissão encerrada.")}catch(error){notify(error?.message||"Não foi possível compartilhar a tela.","error")}
  };
  const leaveCall=async()=>{
    const lobby=call?.lobby;roomRef.current?.disconnect();roomRef.current=null;setCall(null);setSharing(false);setMuted(false);setView("home");
    if(lobby?.id){await API("POST",`/api/lobbies/${lobby.id}/leave`,{}).catch(()=>{});await loadDashboard()}
    notify("Você saiu da call.");
  };

  if(boot)return <Splash/>;
  if(session!=="ready")return <Login onLogin={login}/>;

  const display=dashboard?.account?.displayName||dashboard?.account?.username||"Player";
  const nav=[
    ["home","Início",Home],["lobbies","Lobbies",Gamepad2],["community","Community",Users],
    ["friends","Amigos",UserRound],["messages","Mensagens",MessageCircle],["tournaments","Torneios",Trophy],
    ["events","Eventos",CalendarDays],["store","Loja",Store],["settings","Configurações",Settings]
  ];

  return <div className="app-shell">
    <div id="remote-audio-host" aria-hidden="true"/>
    <Titlebar display={display}/>
    <aside className="sidebar">
      <div className="brand"><img src="./brand/grindlobby-official.png" onError={e=>e.currentTarget.style.display="none"}/><span className="brand-fallback">G</span><b>GRIND<span>LOBBY</span></b></div>
      <button className="profile-card" onClick={()=>setView("profile")}><Avatar name={display} url={dashboard?.account?.avatar}/><div><b>{display}</b><small><i/> Online</small><em>Nível {dashboard?.account?.level||1}</em></div></button>
      <Xp value={dashboard?.account?.xp||0}/>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={cx(view===id&&"active")} onClick={()=>setView(id)}><Icon/><span>{label}</span>{id==="messages"?<strong>3</strong>:null}</button>)}</nav>
      <div className="sidebar-spacer"/>
      <section className="pro-card"><Sparkles/><span><small>GRIND PRO</small><b>{dashboard?.entitlements?.isAdmin||dashboard?.entitlements?.tier==="pro"?"Ativo":"Upgrade disponível"}</b><em>1080p60 · efeitos · extras</em></span></section>
      <button className="logout" onClick={logout}><LogOut/> Sair</button>
    </aside>
    <header className="topbar"><SearchBox/><div className="top-actions"><button onClick={loadDashboard} title="Atualizar"><RefreshCw/></button><button title="Notificações"><Bell/></button><button onClick={()=>setView("profile")}><Avatar name={display} url={dashboard?.account?.avatar}/></button></div></header>
    <main className="content">
      {view==="home"&&<HomeView data={dashboard} onView={setView} onJoin={joinLobby} onCreate={()=>setCreateOpen(true)} onConnect={connectVoice}/>} 
      {view==="lobbies"&&<LobbiesView data={dashboard} onJoin={joinLobby} onCreate={()=>setCreateOpen(true)}/>} 
      {view==="community"&&<CommunityView data={dashboard}/>} 
      {view==="friends"&&<FriendsView data={dashboard} notify={notify}/>} 
      {view==="messages"&&<MessagesView data={dashboard} notify={notify}/>} 
      {view==="tournaments"&&<TournamentsView notify={notify}/>} 
      {view==="events"&&<EventsView notify={notify}/>} 
      {view==="store"&&<StoreView notify={notify}/>} 
      {view==="profile"&&<ProfileView data={dashboard}/>} 
      {view==="settings"&&<SettingsView notify={notify}/>} 
      {view==="call"&&<CallView call={call} muted={muted} sharing={sharing} onMic={toggleMic} onShare={toggleShare} onLeave={leaveCall}/>} 
    </main>
    <MusicBar/>
    {createOpen&&<CreateLobbyModal data={dashboard} onClose={()=>setCreateOpen(false)} onCreated={async(id)=>{setCreateOpen(false);await loadDashboard();notify("Lobby criado com sucesso.");const fresh=(dashboard?.lobbies||[]).find(x=>x.id===id);if(fresh)setView("lobbies")}}/>}
    {toast&&<div className={cx("toast",toast.type)}>{toast.type==="ok"?<Check/>:<CircleHelp/>}<span>{toast.text}</span></div>}
  </div>
}

function Splash(){return <div className="splash"><div className="portal"><span>G</span></div><b>GRINDLOBBY</b><small>Preparando o cliente desktop</small></div>}
function Login({onLogin}){const [identifier,setIdentifier]=useState("");const [password,setPassword]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");return <div className="login-screen"><div className="login-glow"/><section className="login-card"><div className="login-brand"><div className="portal small"><span>G</span></div><b>GRINDLOBBY</b></div><h1>Bem-vindo de volta.</h1><p>Entre no cliente desktop para continuar.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{await onLogin(identifier,password,true)}catch(err){setError(err.message)}finally{setBusy(false)}}}><label>Usuário ou e-mail<input autoFocus value={identifier} onChange={e=>setIdentifier(e.target.value)} autoComplete="username"/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>{error&&<div className="form-error">{error}</div>}<button disabled={busy} className="primary wide">{busy?"Entrando...":"Entrar"}</button></form><small className="login-note">Interface renderizada localmente no seu PC.</small></section></div>}

function Titlebar({display}){return <div className="titlebar" data-tauri-drag-region><div data-tauri-drag-region className="title-name"><span className="mini-logo">G</span><b>GrindLobby</b><em>Desktop</em></div><div className="title-center" data-tauri-drag-region>{display}</div><div className="window-controls"><button onClick={()=>invoke("window_minimize")}><Minimize2/></button><button onClick={()=>invoke("window_toggle_maximize")}><Maximize2/></button><button className="close" onClick={()=>invoke("window_close")}><X/></button></div></div>}
function Avatar({name,url,size="md"}){return <span className={cx("avatar",size)}>{url?<img src={url}/>:initials(name)}</span>}
function Xp({value}){const pct=Math.max(4,Math.min(100,(value%5000)/50));return <div className="xp"><div><i style={{width:`${pct}%`}}/></div><small>{value.toLocaleString("pt-BR")} / 5.000 XP</small></div>}
function SearchBox(){return <button className="search-box"><Search/><span>Buscar jogadores, lobbies e comunidades...</span><kbd>Ctrl K</kbd></button>}

function HomeView({data,onView,onJoin,onCreate,onConnect}){const display=data?.account?.displayName||data?.account?.username||"Player";const lobbies=(data?.lobbies||[]).filter(x=>x.status==="open").slice(0,4);const online=(data?.online||[]).slice(0,5);const current=data?.currentLobby;return <div className="dashboard-layout"><section className="dashboard-main"><div className="welcome"><div><span className="eyebrow">GRIND DESKTOP</span><h1>Boa noite, <strong>{display}.</strong></h1><p>Sua call, seus lobbies e sua comunidade em um único lugar.</p></div><div className="welcome-actions"><button className="primary" onClick={onCreate}><Plus/> Criar lobby</button><button onClick={()=>onView("lobbies")}><Gamepad2/> Entrar em lobby</button></div></div><div className="feature-grid"><Feature icon={Headphones} title="Voice & Chat" text="Voz limpa com baixa latência e controle individual." action={current?"Abrir call":"Ver lobbies"} onClick={()=>current?onConnect(current):onView("lobbies")}/><Feature accent icon={MonitorUp} title="Transmitir" badge="até 1080p60" text="Compartilhamento de tela integrado à call." action={current?"Iniciar na call":"Entrar em lobby"} onClick={()=>current?onConnect(current):onView("lobbies")}/><Feature icon={Music2} title="Música" text="Player persistente sem ocupar sua área principal." action="Abrir player" onClick={()=>document.querySelector(".musicbar")?.classList.toggle("expanded")}/></div><SectionTitle title="Lobbies recentes" action="Ver todos" onClick={()=>onView("lobbies")}/><div className="lobby-list">{lobbies.length?lobbies.map((l,i)=><LobbyRow key={l.id} lobby={l} index={i} onJoin={onJoin}/>):<EmptyLobby onCreate={onCreate}/>}</div><div className="tournament-banner"><div><small>TORNEIO EM DESTAQUE</small><h3>Copa GrindLobby</h3><p>32 equipes · premiação especial · inscrições abertas</p></div><div className="trophy-orbit"><Trophy/></div><button onClick={()=>onView("tournaments")}>Ver detalhes <ChevronRight/></button></div></section><aside className="dashboard-right"><Activity/><ActiveCall current={current} online={online} onOpen={()=>current&&onConnect(current)}/><OnlineFriends online={online} onView={()=>onView("friends")}/></aside></div>}
function Feature({icon:Icon,title,text,action,onClick,accent,badge}){return <article className={cx("feature-card",accent&&"accent")}><div className="feature-icon"><Icon/></div>{badge&&<span className="badge">{badge}</span>}<h3>{title}</h3><p>{text}</p><button onClick={onClick}>{action}<ChevronRight/></button></article>}
function SectionTitle({title,action,onClick}){return <div className="section-title"><h2>{title}</h2>{action&&<button onClick={onClick}>{action}</button>}</div>}
function LobbyRow({lobby,index,onJoin}){return <article className="lobby-row"><span className={`game-icon game-${index%4}`}>{initials(lobby.game?.name||lobby.name)}</span><div><b>{lobby.name}</b><small>{lobby.game?.name||"GrindLobby"} · {lobby.memberCount}/{lobby.max_members} jogadores</small></div><div className="avatar-stack">{Array.from({length:Math.min(5,Math.max(2,lobby.memberCount||2))},(_,i)=><span key={i}/>)}</div><span className="latency"><i/> 12 ms</span><button onClick={()=>onJoin(lobby)}>Entrar</button></article>}
function EmptyLobby({onCreate}){return <article className="empty-lobby"><Gamepad2/><div><b>Nenhum lobby aberto agora</b><small>Crie um lobby e chame seu squad.</small></div><button onClick={onCreate}>Criar agora</button></article>}
function Activity(){return <section className="side-card"><SectionTitle title="Atividade" action="Ver tudo"/><ul className="activity"><li><i className="violet"/><span><b>KillerBee</b> entrou em um lobby</span><small>agora</small></li><li><i className="orange"/><span><b>ShadowZ</b> iniciou uma transmissão</span><small>2 min</small></li><li><i className="pink"/><span><b>Luna</b> enviou uma mensagem</span><small>5 min</small></li></ul></section>}
function ActiveCall({current,online,onOpen}){return <section className="side-card call-card"><SectionTitle title="Call ativa"/><div className="call-head"><span><i className={current?"online":""}/>{current?.name||"Nenhuma call ativa"}</span><small>{current?"00:24:16":"—"}</small></div>{online.map((p,i)=><div className="person" key={p.id||i}><Avatar name={p.display_name||p.username||"Player"} url={p.avatar} size="sm"/><span>{p.display_name||p.username}</span>{i<3?<Mic/>:<MicOff/>}</div>)}<button className="call-open" onClick={onOpen} disabled={!current}>{current?"Abrir call":"Entre em um lobby"}</button></section>}
function OnlineFriends({online,onView}){return <section className="side-card"><SectionTitle title="Amigos online" action="Ver todos" onClick={onView}/>{online.length?online.map((p,i)=><div className="person friend" key={p.id||i}><Avatar name={p.display_name||p.username||"Player"} url={p.avatar} size="sm"/><span><b>{p.display_name||p.username}</b><small><i/> online</small></span></div>):["Juan","Tauanpc","Thaywan"].map(x=><div className="person friend" key={x}><Avatar name={x} size="sm"/><span><b>{x}</b><small><i/> online</small></span></div>)}</section>}

function LobbiesView({data,onJoin,onCreate}){const [filter,setFilter]=useState("all");const rows=(data?.lobbies||[]).filter(l=>l.status==="open"&& (filter==="all"||l.visibility===filter));return <Page title="Lobbies" subtitle="Encontre sua próxima call ou crie um espaço para seu squad." action={<button className="primary" onClick={onCreate}><Plus/> Criar lobby</button>}><div className="tabbar"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Todos</button><button className={filter==="public"?"active":""} onClick={()=>setFilter("public")}>Públicos</button><button className={filter==="private"?"active":""} onClick={()=>setFilter("private")}>Privados</button><button className={filter==="friends"?"active":""} onClick={()=>setFilter("friends")}>Amigos</button></div><div className="lobby-table">{rows.length?rows.map((l,i)=><LobbyRow key={l.id} lobby={l} index={i} onJoin={onJoin}/>):<EmptyLobby onCreate={onCreate}/>}</div></Page>}

function CommunityView({data}){const online=(data?.online||[]).slice(0,6);return <Page className="community-page" title="Community" subtitle="Comunidades privadas, calls e eventos sem copiar a estrutura do Discord."><div className="community-hero"><div className="community-symbol">G</div><div><span className="eyebrow">COMUNIDADE OFICIAL</span><h2>GrindHouse <Check/></h2><p>Seu ponto de encontro dentro do GrindLobby.</p><small><i/> 1.842 online · 8.753 membros</small></div><button className="primary"><UserPlus/> Convidar</button><button><MoreHorizontal/></button></div><div className="community-tabs"><button className="active">Visão geral</button><button>Canais</button><button>Eventos</button><button>Membros</button><button>Configurações</button></div><div className="community-grid"><section className="channels"><ChannelGroup title="BEM-VINDO" items={["# regras","# anúncios"]}/><ChannelGroup title="GERAL" items={["# chat-geral","◖ Sala Geral · 24/30"]}/><ChannelGroup title="JOGOS" items={["# valorant","# cs2","# league-of-legends"]}/><ChannelGroup title="MÍDIA" items={["# clipes","# memes"]}/></section><aside><section className="info-card"><h3>Sobre a comunidade</h3><p>Participe de discussões, encontre novos players e acompanhe os eventos sem sair do app.</p></section><section className="info-card"><h3>Eventos próximos</h3><EventMini title="Copa GrindLobby" date="24 Mai · 19:00"/><EventMini title="Noite de Resenha" date="Amanhã · 22:00"/></section><section className="info-card"><h3>Membros online</h3>{online.map((p,i)=><div className="person friend" key={p.id||i}><Avatar name={p.display_name||p.username} url={p.avatar} size="sm"/><span><b>{p.display_name||p.username}</b><small><i/> online</small></span></div>)}</section></aside></div></Page>}
function ChannelGroup({title,items}){return <section className="channel-group"><header><b>{title}</b><Plus/></header>{items.map((x,i)=><button className={x.includes("Sala Geral")?"voice":""} key={x}><span>{x}</span><small>{i?"3 min atrás":"agora"}</small></button>)}</section>}
function EventMini({title,date}){return <div className="event-mini"><span className="event-dot"/><div><b>{title}</b><small>{date}</small></div></div>}

function FriendsView({data,notify}){const initial=(data?.online||[]).map(p=>({name:p.display_name||p.username,status:"Online",avatar:p.avatar}));const [friends,setFriends]=useState(initial.length?initial:[{name:"ShadowZ",status:"Em lobby"},{name:"Luna",status:"Jogando VALORANT"},{name:"KillerBee",status:"Online"},{name:"Mika",status:"Ausente"}]);return <Page title="Amigos" subtitle="Veja quem está online e entre na resenha." action={<button className="primary" onClick={()=>{const name=prompt("Usuário GrindLobby");if(name){setFriends(x=>[{name,status:"Pedido enviado"},...x]);notify("Solicitação enviada.")}}}><UserPlus/> Adicionar amigo</button>}><div className="tabbar"><button className="active">Todos</button><button>Online</button><button>Em jogo</button><button>Pendentes</button></div><div className="friend-list">{friends.map((f,i)=><article key={`${f.name}-${i}`}><Avatar name={f.name} url={f.avatar}/><div><b>{f.name}</b><small><i/> {f.status}</small></div><button onClick={()=>notify(`Conversa com ${f.name} aberta.`)}><MessageCircle/></button><button><MoreHorizontal/></button></article>)}</div></Page>}

function MessagesView({data,notify}){const contacts=(data?.online||[]).map(p=>p.display_name||p.username).filter(Boolean);const names=contacts.length?contacts:["ShadowZ","Luna","KillerBee","Tauanpc"];const [active,setActive]=useState(names[0]);const [messages,setMessages]=useState(()=>readJson(LS.messages,{[names[0]]:[{mine:false,text:"Eae, bora jogar mais tarde?"},{mine:true,text:"Bora sim! Chama geral 👀"}]}));const [draft,setDraft]=useState("");const send=()=>{const text=draft.trim();if(!text)return;const next={...messages,[active]:[...(messages[active]||[]),{mine:true,text}]};setMessages(next);localStorage.setItem(LS.messages,JSON.stringify(next));setDraft("");notify("Mensagem enviada.")};return <div className="messages-view"><aside><SearchBox/>{names.map(n=><button key={n} className={active===n?"active":""} onClick={()=>setActive(n)}><Avatar name={n}/><span><b>{n}</b><small>Online agora</small></span></button>)}</aside><section><header><Avatar name={active}/><div><b>{active}</b><small><i/> online</small></div><button><Video/></button><button><Headphones/></button></header><div className="chat-log">{(messages[active]||[]).map((m,i)=><div key={i} className={m.mine?"mine":""}><p>{m.text}</p><small>{m.mine?"Você":active} · agora</small></div>)}</div><div className="composer"><Plus/><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={`Mensagem para ${active}`}/><button className="primary" onClick={send}><Send/></button></div></section></div>}

function TournamentsView({notify}){return <Page title="Torneios" subtitle="Competições organizadas sem transformar o GrindLobby em uma tela de e-sports exagerada."><div className="tourney-hero"><div><span className="eyebrow">DESTAQUE DA SEMANA</span><h2>Copa GrindLobby</h2><p>32 equipes · formato 5v5 · premiação especial</p><button className="primary" onClick={()=>notify("Inscrição registrada.")}>Inscrever-se</button></div><div className="tourney-art"><Trophy/></div></div><SectionTitle title="Próximos torneios"/><div className="event-list">{[["Scrim Valorant","16 equipes · amanhã 20:00"],["Campeonato CS2","64 equipes · 24 Mai 19:00"],["LoL Community Cup","32 equipes · 27 Mai 18:00"]].map(([a,b])=><article key={a}><Trophy/><div><b>{a}</b><small>{b}</small></div><button onClick={()=>notify(`Inscrição em ${a} registrada.`)}>Inscrever-se</button></article>)}</div></Page>}
function EventsView({notify}){return <Page title="Eventos" subtitle="Agenda social das suas comunidades."><div className="event-list large">{[["24 MAI","Copa GrindLobby","19:00 · GrindHouse"],["28 MAI","Noite de Resenha","22:00 · Community"],["30 MAI","Treino Comunitário","20:30 · GrindHouse"]].map(([d,a,b])=><article key={a}><span className="datebox">{d}</span><div><b>{a}</b><small>{b}</small></div><button onClick={()=>notify(`Você confirmou presença em ${a}.`)}>Participar</button></article>)}</div></Page>}

function StoreView({notify}){const items=[{id:"eclipse",title:"Moldura Eclipse",type:"Moldura",price:2200},{id:"shadow",title:"Avatar Shadow",type:"Avatar",price:1600},{id:"pulse",title:"Efeito Pulse",type:"Efeito",price:2800},{id:"nebula",title:"Fundo Nebulosa",type:"Fundo",price:1900}];const [equipped,setEquipped]=useState(()=>readJson(LS.equipped,{}));const equip=item=>{const next={...equipped,[item.type]:item.id};setEquipped(next);localStorage.setItem(LS.equipped,JSON.stringify(next));notify(`${item.title} equipado.`)};return <Page className="store-page" title="Loja" subtitle="Personalização GrindLobby com preview direto no cliente."><div className="store-hero"><div><span className="eyebrow">COLEÇÃO ECLIPSE</span><h2>Seu perfil, sua presença.</h2><p>Efeitos mais ricos, sem prejudicar o desempenho da call.</p><button className="primary">Explorar coleção</button></div><div className="eclipse-orb"><span>G</span></div></div><div className="tabbar"><button className="active">Destaques</button><button>Bundles</button><button>Avatares</button><button>Molduras</button><button>Fundos</button><button>Efeitos</button></div><div className="shop-grid">{items.map((item,i)=><article key={item.id}><div className={`cosmetic-art art-${i}`}><span>G</span></div><small>{item.type}</small><b>{item.title}</b><em>{item.price.toLocaleString("pt-BR")} GR</em><button className={equipped[item.type]===item.id?"equipped":""} onClick={()=>equip(item)}>{equipped[item.type]===item.id?"Equipado":"Equipar"}</button></article>)}</div></Page>}

function ProfileView({data}){const display=data?.account?.displayName||data?.account?.username||"Player";return <Page className="profile-page"><div className="profile-banner"><div className="profile-pattern"/><Avatar name={display} url={data?.account?.avatar} size="xl"/></div><div className="profile-heading"><div><h2>{display} <Check/></h2><p>@{data?.account?.username||"player"} · Brasil</p><Xp value={data?.account?.xp||0}/></div><button className="primary">Editar perfil</button></div><div className="stats-grid"><Stat value={data?.stats?.myLobbies||0} label="Lobbies"/><Stat value="32" label="Torneios"/><Stat value={data?.stats?.online||0} label="Amigos online"/><Stat value="256h" label="Tempo em call"/></div><SectionTitle title="Conquistas recentes"/><div className="achievement-grid">{["Primeira call","Squad fechado","100 horas","Organizador","Veterano"].map((x,i)=><article key={x}><span>{["◇","✦","⬢","✹","◆"][i]}</span><b>{x}</b></article>)}</div></Page>}
function Stat({value,label}){return <article><b>{value}</b><small>{label}</small></article>}

function SettingsView({notify}){const [settings,setSettings]=useState(()=>readJson(LS.settings,{startWindows:true,tray:true,noise:true,echo:true,agc:true,volume:78,density:"comfortable"}));const update=(key,value)=>{const next={...settings,[key]:value};setSettings(next);localStorage.setItem(LS.settings,JSON.stringify(next));notify("Configuração salva.")};return <div className="settings-view"><aside>{["Geral","Conta","Privacidade","Notificações","Voz & Vídeo","Transmissão","Aparência","Atalhos","Sobre"].map((x,i)=><button className={i===0?"active":""} key={x}>{x}</button>)}</aside><section><h2>Configurações</h2><p>Preferências aplicadas no cliente desktop.</p><SettingsGroup title="Geral"><Setting label="Iniciar com o Windows"><Toggle value={settings.startWindows} onChange={v=>update("startWindows",v)}/></Setting><Setting label="Minimizar para a bandeja"><Toggle value={settings.tray} onChange={v=>update("tray",v)}/></Setting><Setting label="Densidade"><select value={settings.density} onChange={e=>update("density",e.target.value)}><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></Setting></SettingsGroup><SettingsGroup title="Voz & Vídeo"><Setting label="Volume de entrada"><input type="range" value={settings.volume} onChange={e=>update("volume",Number(e.target.value))}/></Setting><Setting label="Redução de ruído"><Toggle value={settings.noise} onChange={v=>update("noise",v)}/></Setting><Setting label="Cancelamento de eco"><Toggle value={settings.echo} onChange={v=>update("echo",v)}/></Setting><Setting label="Ganho automático"><Toggle value={settings.agc} onChange={v=>update("agc",v)}/></Setting></SettingsGroup><SettingsGroup title="Transmissão"><Setting label="Qualidade máxima"><strong>1080p · 60 FPS (Pro)</strong></Setting><Setting label="Aceleração por hardware"><span className="status-good"><i/> Ativa</span></Setting></SettingsGroup></section></div>}
function SettingsGroup({title,children}){return <div className="settings-group"><h3>{title}</h3>{children}</div>}
function Setting({label,children}){return <label className="setting"><span>{label}</span>{children}</label>}
function Toggle({value,onChange}){return <button className={cx("toggle",value&&"on")} onClick={()=>onChange(!value)}><i/></button>}

function CallView({call,muted,sharing,onMic,onShare,onLeave}){const lobby=call?.lobby;return <div className="call-view"><header><div><span className="eyebrow">CALL GRIND</span><h2>{lobby?.name||"Lobby"}</h2><p>{lobby?.game?.name||"GrindLobby"} · conexão SFU</p></div><span className={cx("connection",call?.connected&&"online")}><i/>{call?.connected?"Conectado":"Reconectando"}</span></header><div className="call-grid"><ParticipantCard name="Você" me muted={muted}/>{(call?.participants||[]).map((p,i)=><ParticipantCard key={p.id||i} name={p.name}/>) }{Array.from({length:Math.max(0,5-(call?.participants?.length||0)-1)},(_,i)=><article className="participant empty" key={`e${i}`}><UserPlus/><span>Vaga livre</span></article>)}</div><div className={cx("share-stage",sharing&&"active")}><div className="share-mark"><MonitorUp/><h3>{sharing?"Você está transmitindo sua tela":"Compartilhamento pronto"}</h3><p>{sharing?"A transmissão está sendo enviada diretamente pela call LiveKit.":"Clique em Transmitir para escolher uma janela ou monitor."}</p></div></div><footer className="call-toolbar"><button className={muted?"danger active":""} onClick={onMic}>{muted?<MicOff/>:<Mic/>}<span>{muted?"Ativar mic":"Microfone"}</span></button><button className={sharing?"active":""} onClick={onShare}><MonitorUp/><span>{sharing?"Parar transmissão":"Transmitir"}</span></button><button><Video/><span>Câmera</span></button><button className="hangup" onClick={onLeave}><X/><span>Sair da call</span></button></footer></div>}
function ParticipantCard({name,me,muted}){return <article className={cx("participant",me&&"me")}><div className="participant-bg"/><Avatar name={name} size="lg"/><div><b>{name}{me?" (você)":""}</b><small><i/> conectado</small></div>{muted?<MicOff/>:<Mic/>}</article>}

function CreateLobbyModal({data,onClose,onCreated}){const games=data?.games||[];const [name,setName]=useState("");const [gameId,setGameId]=useState(games[0]?.id||1);const [visibility,setVisibility]=useState("public");const [maxMembers,setMaxMembers]=useState(10);const [busy,setBusy]=useState(false);const [error,setError]=useState("");return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{const response=await API("POST","/api/lobbies",{name,gameId:Number(gameId),description:"Criado pelo GrindLobby Desktop",visibility,maxMembers:Number(maxMembers)});if(!response?.ok)throw new Error(response?.data?.error||"Não foi possível criar o lobby.");onCreated(response.data.lobbyId)}catch(err){setError(err.message)}finally{setBusy(false)}}}><header><div><span className="eyebrow">NOVO LOBBY</span><h2>Criar lobby</h2></div><button type="button" onClick={onClose}><X/></button></header><label>Nome<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={80} required placeholder="Ex.: Resenha 5v5"/></label><div className="form-grid"><label>Jogo<select value={gameId} onChange={e=>setGameId(e.target.value)}>{games.length?games.map(g=><option value={g.id} key={g.id}>{g.name}</option>):<option value="1">GrindLobby</option>}</select></label><label>Visibilidade<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="public">Público</option><option value="private">Privado</option><option value="friends">Amigos</option></select></label></div><label>Máximo de membros<input type="number" min="2" max="100" value={maxMembers} onChange={e=>setMaxMembers(e.target.value)}/></label>{error&&<div className="form-error">{error}</div>}<footer><button type="button" onClick={onClose}>Cancelar</button><button disabled={busy} className="primary">{busy?"Criando...":"Criar lobby"}</button></footer></form></div>}

function Page({title,subtitle,action,children,className=""}){return <div className={cx("page",className)}>{(title||subtitle||action)&&<header className="page-header"><div>{title&&<h1>{title}</h1>}{subtitle&&<p>{subtitle}</p>}</div>{action}</header>}{children}</div>}
function MusicBar(){const [playing,setPlaying]=useState(true);const [volume,setVolume]=useState(72);return <footer className="musicbar"><span className="album">A7X</span><div><b>Afterlife</b><small>Avenged Sevenfold</small></div><div className="music-controls"><button>◀</button><button className="music-play" onClick={()=>setPlaying(!playing)}>{playing?"Ⅱ":"▶"}</button><button>▶</button></div><Volume2/><input type="range" value={volume} onChange={e=>setVolume(e.target.value)}/></footer>}

createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);

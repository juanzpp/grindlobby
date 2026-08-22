"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {Headphones,Link2,LogOut,Mic,MonitorUp,Plus,RefreshCw,Settings,Shield,Users,Wifi,Zap} from "lucide-react";

type DesktopUser={id:string;username:string;display_name:string;email?:string};
type Lobby={id:string;name:string;visibility:string;max_members:number;memberCount:number;joined:boolean;game?:{name:string;slug:string}|null;owner?:{display_name:string;username:string}|null};
type DashboardData={
  lobbies:Lobby[];
  currentLobby:Lobby|null;
  account:{displayName:string;username:string;avatar:string|null};
  entitlements:{tier:"free"|"pro";isAdmin:boolean};
  stats:{online:number;activeLobbies:number;myLobbies:number;rank:number};
};

function initials(value:string){return value.trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()||"GL"}

export default function DesktopLiteHome({user}:{user:DesktopUser}){
  const router=useRouter();
  const [data,setData]=useState<DashboardData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [invite,setInvite]=useState("");
  const [busy,setBusy]=useState<string|null>(null);

  const load=useCallback(async()=>{
    try{
      const response=await fetch("/api/dashboard",{cache:"no-store"});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Não foi possível carregar o GrindLobby Lite.");
      setData(body as DashboardData);setError("");
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao carregar.")}
    finally{setLoading(false)}
  },[]);

  useEffect(()=>{void load()},[load]);

  const visibleLobbies=useMemo(()=>data?.lobbies?.filter(lobby=>lobby.visibility==="public").slice(0,5)??[],[data?.lobbies]);
  const display=data?.account?.displayName||user.display_name||user.username;
  const current=data?.currentLobby??null;
  const tier=data?.entitlements?.isAdmin?"ADMIN":(data?.entitlements?.tier??"free").toUpperCase();

  function openLobby(id:string){router.push(`/lobby/${id}?desktop=lite`)}
  async function joinLobby(lobby:Lobby){
    setBusy(lobby.id);setError("");
    try{
      if(!lobby.joined){const response=await fetch(`/api/lobbies/${lobby.id}/join`,{method:"POST"});const body=await response.json();if(!response.ok)throw new Error(body.error||"Não foi possível entrar.")}
      openLobby(lobby.id);
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível entrar.")}
    finally{setBusy(null)}
  }
  function quickJoin(){
    const raw=invite.trim();if(!raw)return;
    try{
      const url=new URL(raw,location.origin);
      const match=url.pathname.match(/^\/lobby\/invite\/([A-Za-z0-9_-]{20,128})$/);
      if(!match)throw new Error();
      router.push(`/lobby/invite/${match[1]}?desktop=lite`);
    }catch{setError("Cole um link de convite válido do GrindLobby.")}
  }
  async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.push("/login?desktop=lite");router.refresh()}

  return <main className="lite-shell">
    <aside className="lite-rail">
      <div className="lite-mark">G</div>
      <nav aria-label="Navegação do GrindLobby Lite">
        <button className="active" title="Início"><Zap/></button>
        <button onClick={()=>router.push("/desktop-lite")} title="Salas"><Headphones/></button>
        <button onClick={()=>router.push("/settings?desktop=lite")} title="Configurações"><Settings/></button>
      </nav>
      <button className="lite-avatar" title={display}>{data?.account?.avatar?<img src={data.account.avatar} alt=""/>:initials(display)}</button>
    </aside>

    <section className="lite-app">
      <header className="lite-topbar">
        <div><span className="lite-brand">GrindLobby</span><small>Performance Client</small></div>
        <div className="lite-top-status"><span><i/>Online</span><span className="lite-tier">{tier}</span><button onClick={()=>void load()} title="Atualizar"><RefreshCw className={loading?"spin":""}/></button><button onClick={logout} title="Sair"><LogOut/></button></div>
      </header>

      <div className="lite-content">
        <section className="lite-welcome">
          <div><small>DESKTOP PERFORMANCE</small><h1>Olá, {display}.</h1><p>Voz e transmissão primeiro. O restante fica fora do caminho.</p></div>
          <div className="lite-ready"><Wifi/><span><b>Pronto para jogar</b><small>Cliente leve conectado</small></span></div>
        </section>

        {error?<div className="lite-error" role="alert">{error}</div>:null}

        <div className="lite-main-grid">
          <section className="lite-panel lite-room-panel">
            <div className="lite-panel-head"><span><Mic/>SALA DE VOZ</span>{current?<b>ATIVA</b>:<b className="idle">SEM SALA</b>}</div>
            {current?<>
              <div className="lite-current-room">
                <div className="lite-room-orb"><Zap/></div>
                <div className="lite-room-copy"><h2>{current.name}</h2><p>{current.game?.name||"GrindLobby"} · {current.memberCount}/{current.max_members} jogadores</p><span><Shield/>{current.visibility}</span></div>
              </div>
              <div className="lite-room-actions"><button className="primary" onClick={()=>openLobby(current.id)}><Headphones/>Abrir sala</button><button onClick={()=>navigator.clipboard?.writeText(`${location.origin}/lobby/${current.id}`).catch(()=>{})}><Link2/>Copiar link</button></div>
            </>:<div className="lite-empty-room"><div className="lite-room-orb"><Mic/></div><h2>Nenhuma sala ativa</h2><p>Entre em uma sala pública ou use um convite.</p></div>}
          </section>

          <section className="lite-panel lite-quick-panel">
            <div className="lite-panel-head"><span><Link2/>ENTRADA RÁPIDA</span></div>
            <label><span>Link de convite</span><div><input value={invite} onChange={event=>setInvite(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")quickJoin()}} placeholder="Cole o convite da sala"/><button className="primary" onClick={quickJoin}>Entrar</button></div></label>
            <div className="lite-separator"><span>ou</span></div>
            <div className="lite-public-head"><span><Users/>Salas públicas</span><small>{data?.stats?.activeLobbies??0} ativas</small></div>
            <div className="lite-public-list">{visibleLobbies.map(lobby=><button key={lobby.id} onClick={()=>void joinLobby(lobby)} disabled={busy===lobby.id}><span><b>{lobby.name}</b><small>{lobby.game?.name||"GrindLobby"} · {lobby.memberCount}/{lobby.max_members}</small></span><strong>{busy===lobby.id?"...":"Entrar"}</strong></button>)}{!visibleLobbies.length?<p>Nenhuma sala pública disponível agora.</p>:null}</div>
          </section>
        </div>

        <section className="lite-performance-strip">
          <div><Mic/><span><small>ÁUDIO</small><b>Opus + RED</b><em>Prioridade: clareza</em></span></div>
          <div><MonitorUp/><span><small>TRANSMISSÃO</small><b>{data?.entitlements?.tier==="pro"||data?.entitlements?.isAdmin?"até 1080p60":"até 720p30"}</b><em>Adaptativa</em></span></div>
          <div><Zap/><span><small>MODO</small><b>Performance</b><em>UI reduzida</em></span></div>
        </section>
      </div>
    </section>
  </main>;
}

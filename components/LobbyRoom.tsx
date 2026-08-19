"use client";
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import AudioHost from './AudioHost';
import {loadAudioPreferences,playAudioEvent} from '@/lib/audio';
import {ArrowLeft,Gamepad2,Mic2,MonitorUp,Users,Shield,LogOut,Loader2,Radio,Copy,Check} from 'lucide-react';

type Member={user_id:string;role:string;joined_at:string;profile?:{id:string;username:string;display_name:string;avatar:string|null;status:string}};
type Lobby={id:string;owner_id:string;name:string;description:string|null;visibility:string;max_members:number;status:string;game?:{name:string;slug:string}|null;members:Member[];isMember:boolean;me:string};
export default function LobbyRoom({id,user}:{id:string;user:any}){
 const [lobby,setLobby]=useState<Lobby|null>(null); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [copied,setCopied]=useState(false); const [error,setError]=useState(''); const router=useRouter();
 async function load(){try{const r=await fetch(`/api/lobbies/${id}`,{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Falha');setLobby(j.lobby)}catch(e:any){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load();const t=setInterval(load,10000);return()=>clearInterval(t)},[id]);
 useEffect(()=>{
  if(!lobby?.isMember)return;
  let expired=false;
  const expire=()=>{
   if(expired)return;
   expired=true;
   const url=`/api/lobbies/${id}/leave`;
   if(navigator.sendBeacon){navigator.sendBeacon(url,new Blob([], {type:'application/json'}));}
   else fetch(url,{method:'POST',keepalive:true}).catch(()=>{});
  };
    const heartbeat=()=>fetch(`/api/lobbies/${id}/heartbeat`,{method:'POST',keepalive:true}).then(response=>{
     if(response.status===401)expire();
    }).catch(()=>{});
  heartbeat();
  const timer=setInterval(heartbeat,10000);
  window.addEventListener('pagehide',expire);
  return()=>{clearInterval(timer);window.removeEventListener('pagehide',expire);expire()};
 },[id,lobby?.isMember]);
 async function join(){setBusy(true);const r=await fetch(`/api/lobbies/${id}/join`,{method:'POST'});const j=await r.json();setBusy(false);if(!r.ok)return setError(j.error||'Falha');playAudioEvent('join',loadAudioPreferences());load()}
 async function leave(){setBusy(true);const r=await fetch(`/api/lobbies/${id}/leave`,{method:'POST'});setBusy(false);if(r.ok){playAudioEvent('leave',loadAudioPreferences());router.push('/')}else setError('Não foi possível sair.')}
 function copy(){navigator.clipboard?.writeText(location.href);setCopied(true);setTimeout(()=>setCopied(false),1500)}
 if(loading)return <main className="room-shell"><div className="room-loading"><Loader2 className="animate-spin"/>Carregando lobby...</div></main>
 if(!lobby)return <main className="room-shell"><div className="room-loading">{error||'Lobby não encontrado.'}</div></main>
 const owner=lobby.members.find(m=>m.user_id===lobby.owner_id);
 return <main className="room-shell"><div className="ambient a1"/><div className="room-top"><button onClick={()=>router.push('/')}><ArrowLeft size={17}/> Dashboard</button><div className="brand room-brand"><div className="brand-mark">G</div><div><b>GRIND<span>LOBBY</span></b><small>ROOM SESSION</small></div></div><button onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copiado':'Convidar'}</button></div>
 <div className="room-wrap"><section className="room-hero"><div className="gridfx"/><div className="glow"/><div className="relative z-10"><div className="eyebrow"><Radio size={13}/> LIVE LOBBY · {lobby.status.toUpperCase()}</div><h1>{lobby.name}</h1><p>{lobby.game?.name??'Jogo livre'} · Host: {owner?.profile?.display_name??owner?.profile?.username??'Player'}</p><div className="room-badges"><span><Users size={14}/>{lobby.members.length}/{lobby.max_members} players</span><span><Mic2 size={14}/>Voice ready</span><span><MonitorUp size={14}/>Stream ready</span><span><Shield size={14}/>{lobby.visibility}</span></div></div></section>
 {error&&<div className="dash-error">{error}</div>}
 <div className="room-grid"><section className="room-panel"><div className="section-head"><div><small>SQUAD</small><h2>Membros da sala</h2></div><span className="room-count">{lobby.members.length}/{lobby.max_members}</span></div><div className="member-grid">{lobby.members.map(m=><article className="member-card" key={m.user_id}><div className="member-avatar">{(m.profile?.display_name||m.profile?.username||'?')[0].toUpperCase()}<i className={m.profile?.status==='online'?'on':''}/></div><div><h3>{m.profile?.display_name||m.profile?.username||'Player'}</h3><p>@{m.profile?.username??'player'}</p></div><span>{m.role==='owner'?'HOST':m.role.toUpperCase()}</span></article>)}</div></section>
 <aside className="room-side"><AudioHost enabled={lobby.isMember}/><div className="room-panel"><small>SESSION</small><h2>Pronto para jogar</h2><p>A sala permanece salva mesmo se o criador sair. Voz e transmissão entram na próxima etapa.</p><div className="room-actions">{!lobby.isMember?<button onClick={join} disabled={busy} className="primary justify-center">{busy?<Loader2 size={15} className="animate-spin"/>:<Gamepad2 size={15}/>}Entrar na sala</button>:<button onClick={leave} disabled={busy} className="secondary justify-center"><LogOut size={15}/>Sair da sala</button>}</div></div><div className="room-panel feature-lock"><div><Mic2 size={19}/><b>Voice Engine</b><span>Próxima fase</span></div><div><MonitorUp size={19}/><b>Screen Share</b><span>1080p60 Pro</span></div></div></aside></div></div></main>
}

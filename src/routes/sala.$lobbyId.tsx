import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, Headphones, Mic, MicOff, MonitorUp, Settings, Share2, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/sala/$lobbyId")({ component: RoomPage });

type MediaSettings = {
  mic:string; output:string; micVolume:number; outputVolume:number; sensitivity:number;
  noiseSuppression:boolean; echoCancellation:boolean; autoGainControl:boolean; voiceActivity:boolean;
  quality:string; bitrate:number; systemAudio:boolean; lowLatency:boolean; hardwareAcceleration:boolean;
  showPreview:boolean; joinSounds:boolean; muteSounds:boolean;
};
const defaults:MediaSettings={mic:"",output:"",micVolume:100,outputVolume:80,sensitivity:45,noiseSuppression:true,echoCancellation:true,autoGainControl:true,voiceActivity:true,quality:"720p30",bitrate:3500,systemAudio:true,lowLatency:true,hardwareAcceleration:true,showPreview:true,joinSounds:true,muteSounds:true};
function readCfg():MediaSettings{try{return{...defaults,...JSON.parse(localStorage.getItem("grind:mediaSettings")||"{}")};}catch{return defaults;}}
function getVideoPreset(quality:string){if(quality==="1080p60")return{width:1920,height:1080,frameRate:60};if(quality==="720p30")return{width:1280,height:720,frameRate:30};if(quality==="480p30")return{width:854,height:480,frameRate:30};return{width:640,height:360,frameRate:30};}

function RoomPage(){
  const {lobbyId}=Route.useParams(); const navigate=useNavigate();
  const [cfg,setCfg]=useState<MediaSettings>(defaults); const [muted,setMuted]=useState(false); const [deafened,setDeafened]=useState(false);
  const [micState,setMicState]=useState("desconectado"); const [screenState,setScreenState]=useState("parada"); const [status,setStatus]=useState("");
  const micStream=useRef<MediaStream|null>(null); const screenStream=useRef<MediaStream|null>(null); const videoRef=useRef<HTMLVideoElement|null>(null);

  useEffect(()=>{const settings=readCfg();setCfg(settings);connectMic(settings);return()=>{micStream.current?.getTracks().forEach(t=>t.stop());screenStream.current?.getTracks().forEach(t=>t.stop());};},[]);

  const connectMic=async(settings:MediaSettings)=>{try{setMicState("conectando");const stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:settings.mic?{exact:settings.mic}:undefined,noiseSuppression:settings.noiseSuppression,echoCancellation:settings.echoCancellation,autoGainControl:settings.autoGainControl}});micStream.current?.getTracks().forEach(t=>t.stop());micStream.current=stream;stream.getAudioTracks().forEach(t=>t.enabled=!muted);setMicState("conectado");}catch{setMicState("sem permissão");}};
  const toggleMute=()=>{const next=!muted;setMuted(next);micStream.current?.getAudioTracks().forEach(t=>t.enabled=!next);};
  const toggleDeafen=()=>setDeafened(v=>!v);
  const startScreen=async()=>{try{const p=getVideoPreset(cfg.quality);const stream=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:p.width},height:{ideal:p.height},frameRate:{ideal:p.frameRate,max:p.frameRate}},audio:cfg.systemAudio});screenStream.current=stream;setScreenState("ao vivo");if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.muted=true;await videoRef.current.play().catch(()=>{});}stream.getVideoTracks()[0]?.addEventListener("ended",stopScreen,{once:true});}catch{setStatus("Compartilhamento cancelado ou não permitido.");}};
  const stopScreen=()=>{screenStream.current?.getTracks().forEach(t=>t.stop());screenStream.current=null;if(videoRef.current)videoRef.current.srcObject=null;setScreenState("parada");};
  const copyInvite=async()=>{await navigator.clipboard.writeText(`${location.origin}/lobbies?join=${encodeURIComponent(lobbyId)}`);setStatus("Convite copiado.");};
  const leave=()=>{micStream.current?.getTracks().forEach(t=>t.stop());stopScreen();localStorage.removeItem("grind:activeLobby");navigate({to:"/lobbies"});};

  return <div className="min-h-screen bg-background text-foreground"><main className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
    <header className="panel flex flex-wrap items-center gap-3 p-4"><img src="/grindlobby-logo.png" alt="GrindLobby" className="h-11 w-11 object-contain" style={{clipPath:"circle(47% at 50% 50%)"}}/><div><p className="label-caps">Sala atual</p><h1 className="font-display text-xl font-bold">{lobbyId}</h1></div><span className="ml-auto text-xs text-muted-foreground">Microfone: {micState}</span><button onClick={copyInvite} className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm"><Copy className="h-4 w-4"/>Convite</button><Link to="/configuracoes" className="btn-ghost grid h-9 w-9 place-items-center rounded-lg"><Settings className="h-4 w-4"/></Link></header>

    <section className="grid gap-4 lg:grid-cols-[1fr_320px]"><div className="panel min-h-[360px] p-4"><div className="flex items-center justify-between"><div><p className="label-caps">Tela ao vivo</p><p className="mt-1 text-sm text-muted-foreground">{cfg.quality} · {cfg.bitrate} kbps alvo · {cfg.lowLatency?"baixa latência":"buffer padrão"}</p></div><span className={`rounded-full px-2 py-1 text-xs ${screenState==="ao vivo"?"bg-red-500/15 text-red-300":"bg-secondary text-muted-foreground"}`}>{screenState==="ao vivo"?"AO VIVO":"OFF"}</span></div><div className="mt-4 grid min-h-[280px] place-items-center overflow-hidden rounded-xl border border-border bg-black/30">{cfg.showPreview?<video ref={videoRef} autoPlay playsInline className="max-h-[520px] w-full object-contain"/>:<p className="text-sm text-muted-foreground">Preview local desativado nas configurações.</p>}</div><div className="mt-4 flex flex-wrap gap-2">{screenState==="ao vivo"?<button onClick={stopScreen} className="btn-ghost flex items-center gap-2 rounded-lg px-4 py-2 text-sm"><X className="h-4 w-4"/>Parar transmissão</button>:<button onClick={startScreen} className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"><MonitorUp className="h-4 w-4"/>Compartilhar tela</button>}<Link to="/configuracoes" className="btn-ghost flex items-center gap-2 rounded-lg px-4 py-2 text-sm"><Share2 className="h-4 w-4"/>Qualidade e áudio</Link></div></div>

    <aside className="space-y-4"><section className="panel p-4"><p className="label-caps">Call</p><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={toggleMute} className={`rounded-xl border p-4 ${muted?"border-red-500/40 bg-red-500/10":"border-border bg-panel"}`}>{muted?<MicOff className="mx-auto h-5 w-5 text-red-300"/>:<Mic className="mx-auto h-5 w-5"/>}<span className="mt-2 block text-xs">{muted?"Microfone off":"Microfone on"}</span></button><button onClick={toggleDeafen} className={`rounded-xl border p-4 ${deafened?"border-red-500/40 bg-red-500/10":"border-border bg-panel"}`}><Headphones className="mx-auto h-5 w-5"/><span className="mt-2 block text-xs">{deafened?"Áudio off":"Áudio on"}</span></button></div><div className="mt-4 space-y-2 text-xs text-muted-foreground"><p className="flex items-center justify-between"><span>Supressão de ruído</span><span>{cfg.noiseSuppression?"ON":"OFF"}</span></p><p className="flex items-center justify-between"><span>Cancelamento de eco</span><span>{cfg.echoCancellation?"ON":"OFF"}</span></p><p className="flex items-center justify-between"><span>Ganho automático</span><span>{cfg.autoGainControl?"ON":"OFF"}</span></p><p className="flex items-center justify-between"><span>Sensibilidade</span><span>{cfg.sensitivity}%</span></p><p className="flex items-center justify-between"><span className="flex items-center gap-1"><Volume2 className="h-3 w-3"/>Saída</span><span>{cfg.outputVolume}%</span></p></div></section>
    <section className="panel p-4"><p className="label-caps">Sala</p><p className="mt-3 text-sm">Você entrou automaticamente em <strong>{lobbyId}</strong>.</p><p className="mt-2 text-xs text-muted-foreground">A interface visual definitiva da sala será trabalhada depois; este fluxo já mantém os controles reais de mídia separados da estética.</p><button onClick={leave} className="mt-4 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">Sair da sala</button></section></aside></section>
    {status&&<p className="text-sm text-muted-foreground">{status}</p>}
  </main></div>;
}

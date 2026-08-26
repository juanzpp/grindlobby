import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Headphones, LayoutGrid, Mic, Monitor, Settings, SlidersHorizontal, Star, Store, Trophy, Users, Volume2, Waves } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/configuracoes")({ component: SettingsPage });
const nav = [["Dashboard","/",LayoutGrid],["Lobbies","/lobbies",Users],["Rank","/rank",Trophy],["Loja","/loja",Store],["Pro","/pro",Star],["Configurações","/configuracoes",Settings]] as const;

type DeviceOption = { deviceId: string; label: string; kind: MediaDeviceKind };
type MediaSettings = {
  mic: string; output: string; micVolume: number; outputVolume: number; sensitivity: number;
  noiseSuppression: boolean; echoCancellation: boolean; autoGainControl: boolean; voiceActivity: boolean;
  quality: string; bitrate: number; systemAudio: boolean; lowLatency: boolean; hardwareAcceleration: boolean;
  showPreview: boolean; joinSounds: boolean; muteSounds: boolean;
};

const defaults: MediaSettings = {
  mic:"", output:"", micVolume:100, outputVolume:80, sensitivity:45,
  noiseSuppression:true, echoCancellation:true, autoGainControl:true, voiceActivity:true,
  quality:"720p30", bitrate:3500, systemAudio:true, lowLatency:true, hardwareAcceleration:true,
  showPreview:true, joinSounds:true, muteSounds:true,
};

function readSettings(): MediaSettings {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem("grind:mediaSettings") || "{}") }; } catch { return defaults; }
}

function BrandLogo(){return <img src="/grindlobby-logo.png" alt="GrindLobby" className="mx-auto h-14 w-14 object-contain" style={{clipPath:"circle(47% at 50% 50%)"}}/>;}

function Toggle({checked,onChange,label,description}:{checked:boolean;onChange:(v:boolean)=>void;label:string;description:string}){
  return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-panel/50 p-3"><span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="h-4 w-4 accent-primary"/></label>;
}

function SettingsPage(){
  const [devices,setDevices]=useState<DeviceOption[]>([]); const [status,setStatus]=useState("");
  const [cfg,setCfg]=useState<MediaSettings>(defaults); const [meter,setMeter]=useState(0); const [testing,setTesting]=useState(false);
  const testStream=useRef<MediaStream|null>(null); const raf=useRef<number|null>(null); const audioCtx=useRef<AudioContext|null>(null);

  useEffect(()=>{setCfg(readSettings()); return ()=>stopMicTest();},[]);

  const patch=<K extends keyof MediaSettings>(key:K,value:MediaSettings[K])=>setCfg(v=>({...v,[key]:value}));
  const loadDevices=async()=>{try{const probe=await navigator.mediaDevices.getUserMedia({audio:true});probe.getTracks().forEach(t=>t.stop());const list=await navigator.mediaDevices.enumerateDevices();setDevices(list.filter(d=>d.kind==="audioinput"||d.kind==="audiooutput").map(d=>({deviceId:d.deviceId,label:d.label||"Dispositivo sem nome",kind:d.kind})));setStatus("Dispositivos atualizados.");}catch{setStatus("Permissão de microfone não concedida ou mídia indisponível.");}};

  const stopMicTest=()=>{if(raf.current)cancelAnimationFrame(raf.current);raf.current=null;testStream.current?.getTracks().forEach(t=>t.stop());testStream.current=null;audioCtx.current?.close().catch(()=>{});audioCtx.current=null;setTesting(false);setMeter(0);};
  const startMicTest=async()=>{stopMicTest();try{const stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:cfg.mic?{exact:cfg.mic}:undefined,noiseSuppression:cfg.noiseSuppression,echoCancellation:cfg.echoCancellation,autoGainControl:cfg.autoGainControl}});testStream.current=stream;const Ctx=window.AudioContext||(window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext;const ctx=new Ctx();audioCtx.current=ctx;const src=ctx.createMediaStreamSource(stream);const analyser=ctx.createAnalyser();analyser.fftSize=512;src.connect(analyser);const data=new Uint8Array(analyser.frequencyBinCount);setTesting(true);const tick=()=>{analyser.getByteFrequencyData(data);const avg=data.reduce((a,b)=>a+b,0)/data.length;setMeter(Math.min(100,Math.round((avg/128)*100)));raf.current=requestAnimationFrame(tick);};tick();}catch{setStatus("Não foi possível iniciar o teste do microfone.");}};

  const save=()=>{localStorage.setItem("grind:mediaSettings",JSON.stringify(cfg));localStorage.setItem("grind:mic",cfg.mic);localStorage.setItem("grind:out",cfg.output);localStorage.setItem("grind:streamQuality",cfg.quality);setStatus("Configurações de áudio e transmissão salvas.");};
  const inputs=devices.filter(d=>d.kind==="audioinput"), outputs=devices.filter(d=>d.kind==="audiooutput");
  const preset=cfg.quality.includes("1080")?{w:1920,h:1080,fps:60}:cfg.quality.includes("720")?{w:1280,h:720,fps:30}:cfg.quality.includes("480")?{w:854,h:480,fps:30}:{w:640,h:360,fps:30};

  return <div className="min-h-screen bg-background text-foreground"><div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-6"><aside className="hidden w-56 shrink-0 lg:block"><div className="panel sticky top-6 p-4"><BrandLogo/><nav className="mt-5 space-y-1">{nav.map(([label,to,Icon])=><Link key={label} to={to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${to==="/configuracoes"?"bg-primary/15 text-primary-glow":"text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon className="h-4 w-4"/>{label}</Link>)}</nav></div></aside><main className="min-w-0 flex-1 space-y-5"><header><p className="label-caps">Sistema</p><h1 className="font-display text-3xl font-bold">Áudio e tela ao vivo</h1><p className="mt-1 text-sm text-muted-foreground">Configurações usadas ao entrar em uma sala. As permissões e dispositivos são do navegador real.</p></header>

  <section className="panel p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><Mic className="h-4 w-4"/>Entrada de áudio</h2><p className="mt-1 text-xs text-muted-foreground">Dispositivo, ganho, sensibilidade e processamento.</p></div><button onClick={loadDevices} className="btn-ghost rounded-lg px-3 py-2 text-sm">Detectar dispositivos</button></div>
  <div className="mt-4 grid gap-4 lg:grid-cols-2"><label className="text-sm"><span className="mb-2 block text-muted-foreground">Microfone</span><select value={cfg.mic} onChange={e=>patch("mic",e.target.value)} className="w-full rounded-lg border border-border bg-panel px-3 py-2"><option value="">Padrão do sistema</option>{inputs.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></label><label className="text-sm"><span className="mb-2 flex items-center gap-2 text-muted-foreground"><Headphones className="h-4 w-4"/>Saída de áudio</span><select value={cfg.output} onChange={e=>patch("output",e.target.value)} className="w-full rounded-lg border border-border bg-panel px-3 py-2"><option value="">Padrão do sistema</option>{outputs.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></label></div>
  <div className="mt-4 grid gap-4 lg:grid-cols-3"><label className="text-sm"><span className="mb-2 flex justify-between text-muted-foreground"><span>Volume do microfone</span><span>{cfg.micVolume}%</span></span><input type="range" min="0" max="150" value={cfg.micVolume} onChange={e=>patch("micVolume",+e.target.value)} className="w-full"/></label><label className="text-sm"><span className="mb-2 flex justify-between text-muted-foreground"><span>Volume de saída</span><span>{cfg.outputVolume}%</span></span><input type="range" min="0" max="100" value={cfg.outputVolume} onChange={e=>patch("outputVolume",+e.target.value)} className="w-full"/></label><label className="text-sm"><span className="mb-2 flex justify-between text-muted-foreground"><span>Sensibilidade de voz</span><span>{cfg.sensitivity}%</span></span><input type="range" min="0" max="100" value={cfg.sensitivity} onChange={e=>patch("sensitivity",+e.target.value)} className="w-full"/></label></div>
  <div className="mt-4 grid gap-3 md:grid-cols-2"><Toggle checked={cfg.noiseSuppression} onChange={v=>patch("noiseSuppression",v)} label="Supressão de ruído" description="Reduz teclado, ventoinha e ruído contínuo."/><Toggle checked={cfg.echoCancellation} onChange={v=>patch("echoCancellation",v)} label="Cancelamento de eco" description="Evita retorno da saída pelo microfone."/><Toggle checked={cfg.autoGainControl} onChange={v=>patch("autoGainControl",v)} label="Ganho automático" description="Mantém a voz em nível consistente."/><Toggle checked={cfg.voiceActivity} onChange={v=>patch("voiceActivity",v)} label="Detecção de voz" description="Usa a sensibilidade para indicar fala."/></div>
  <div className="mt-4 rounded-xl border border-border bg-panel/50 p-4"><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4"/>Teste do microfone</span><button onClick={testing?stopMicTest:startMicTest} className="btn-ghost rounded-lg px-3 py-2 text-sm">{testing?"Parar teste":"Iniciar teste"}</button></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary-glow transition-[width]" style={{width:`${meter}%`}}/></div></div></section>

  <section className="panel p-5"><h2 className="flex items-center gap-2 font-semibold"><Monitor className="h-4 w-4"/>Tela ao vivo</h2><p className="mt-1 text-xs text-muted-foreground">Perfil de captura aplicado ao iniciar compartilhamento dentro da sala.</p>
  <div className="mt-4 grid gap-4 lg:grid-cols-3"><label className="text-sm"><span className="mb-2 block text-muted-foreground">Qualidade</span><select value={cfg.quality} onChange={e=>patch("quality",e.target.value)} className="w-full rounded-lg border border-border bg-panel px-3 py-2"><option value="360p30">360p · 30 FPS</option><option value="480p30">480p · 30 FPS</option><option value="720p30">720p · 30 FPS</option><option value="1080p60">1080p · 60 FPS</option></select></label><label className="text-sm"><span className="mb-2 flex justify-between text-muted-foreground"><span>Bitrate alvo</span><span>{cfg.bitrate} kbps</span></span><input type="range" min="500" max="12000" step="250" value={cfg.bitrate} onChange={e=>patch("bitrate",+e.target.value)} className="w-full"/></label><div className="rounded-xl border border-border bg-panel/50 p-3 text-xs text-muted-foreground"><p className="font-medium text-foreground">Captura atual</p><p className="mt-1">{preset.w}×{preset.h} · {preset.fps} FPS</p><p>{cfg.lowLatency?"Modo baixa latência":"Modo padrão"}</p></div></div>
  <div className="mt-4 grid gap-3 md:grid-cols-2"><Toggle checked={cfg.systemAudio} onChange={v=>patch("systemAudio",v)} label="Áudio do sistema" description="Solicita áudio junto com a tela quando o navegador permitir."/><Toggle checked={cfg.lowLatency} onChange={v=>patch("lowLatency",v)} label="Baixa latência" description="Prioriza resposta rápida em vez de buffer excessivo."/><Toggle checked={cfg.hardwareAcceleration} onChange={v=>patch("hardwareAcceleration",v)} label="Aceleração por hardware" description="Preferência para reduzir carga da CPU quando suportado."/><Toggle checked={cfg.showPreview} onChange={v=>patch("showPreview",v)} label="Preview local" description="Exibe sua própria transmissão dentro da sala."/></div></section>

  <section className="panel p-5"><h2 className="flex items-center gap-2 font-semibold"><Waves className="h-4 w-4"/>Sons e experiência</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Toggle checked={cfg.joinSounds} onChange={v=>patch("joinSounds",v)} label="Sons de entrada/saída" description="Mantém os avisos sonoros da call."/><Toggle checked={cfg.muteSounds} onChange={v=>patch("muteSounds",v)} label="Sons de mute/deafen" description="Feedback ao ligar/desligar microfone e áudio."/></div></section>

  <div className="flex flex-wrap items-center gap-3"><button onClick={save} className="btn-primary rounded-lg px-5 py-2.5 font-semibold">Salvar configurações</button><Link to="/lobbies" className="btn-ghost rounded-lg px-5 py-2.5 text-sm">Ir para lobbies</Link>{status&&<p className="text-sm text-muted-foreground">{status}</p>}</div></main></div></div>;
}

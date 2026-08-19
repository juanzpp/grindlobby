"use client";
import {useEffect,useRef,useState} from "react";
import {Mic,MicOff,Headphones,Volume2,SlidersHorizontal,Radio,PhoneOff} from "lucide-react";

type Props={enabled:boolean};

export default function AudioHost({enabled}:Props){
 const [open,setOpen]=useState(false),[active,setActive]=useState(false),[muted,setMuted]=useState(false);
 const [input,setInput]=useState(85),[output,setOutput]=useState(80),[sensitivity,setSensitivity]=useState(38);
 const [noise,setNoise]=useState(true),[echo,setEcho]=useState(true),[agc,setAgc]=useState(true),[level,setLevel]=useState(0);
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]),[micId,setMicId]=useState(""),[speakerId,setSpeakerId]=useState("");
 const stream=useRef<MediaStream|null>(null),ctx=useRef<AudioContext|null>(null),raf=useRef<number|undefined>(undefined);

 async function refreshDevices(){const d=await navigator.mediaDevices.enumerateDevices();setDevices(d)}
 async function connect(){
  if(!enabled)return;
  try{
   disconnect();
   const s=await navigator.mediaDevices.getUserMedia({audio:{
    deviceId:micId?{exact:micId}:undefined,
    echoCancellation:echo,noiseSuppression:noise,autoGainControl:agc,
    channelCount:1
   },video:false});
   stream.current=s;s.getAudioTracks().forEach(t=>t.enabled=!muted);setActive(true);await refreshDevices();
   const ac=new AudioContext();ctx.current=ac;const src=ac.createMediaStreamSource(s),an=ac.createAnalyser();an.fftSize=256;src.connect(an);
   const data=new Uint8Array(an.frequencyBinCount);
   const tick=()=>{an.getByteFrequencyData(data);const avg=data.reduce((a,b)=>a+b,0)/data.length;setLevel(Math.min(100,Math.round(avg*1.6)));raf.current=requestAnimationFrame(tick)};tick();
  }catch(e){console.error(e);setActive(false);alert("Não foi possível acessar o microfone. Confira a permissão do navegador.")}
 }
 function disconnect(){if(raf.current)cancelAnimationFrame(raf.current);stream.current?.getTracks().forEach(t=>t.stop());ctx.current?.close();stream.current=null;ctx.current=null;setActive(false);setLevel(0)}
 function toggleMute(){const next=!muted;setMuted(next);stream.current?.getAudioTracks().forEach(t=>t.enabled=!next)}
 useEffect(()=>{refreshDevices().catch(()=>{});return()=>disconnect()},[]);
 useEffect(()=>{if(active)connect()},[micId,noise,echo,agc]);
 return <div className="voice-engine">
  <div className="voice-head"><div><small>VOICE ENGINE</small><h2>Áudio da sala</h2></div><span className={active?"voice-live":""}><Radio size={12}/>{active?"CONECTADO":"PRONTO"}</span></div>
  <div className="voice-meter"><i style={{width:`${muted?0:Math.max(2,level)}%`}}/><span>{muted?"MIC MUDO":level>sensitivity?"FALANDO":"AGUARDANDO VOZ"}</span></div>
  <div className="voice-actions">
   {!active?<button className="primary" disabled={!enabled} onClick={connect}><Mic size={16}/>Entrar no áudio</button>:<>
    <button className={muted?"voice-danger":"secondary"} onClick={toggleMute}>{muted?<MicOff size={16}/>:<Mic size={16}/>} {muted?"Ativar":"Mutar"}</button>
    <button className="secondary" onClick={()=>setOpen(!open)}><SlidersHorizontal size={16}/>Ajustes</button>
    <button className="voice-danger" onClick={disconnect}><PhoneOff size={16}/>Desconectar</button>
   </>}
  </div>
  {!enabled&&<p className="voice-note">Entre no lobby para liberar o áudio.</p>}
  {open&&<div className="voice-settings">
   <label>Microfone<select value={micId} onChange={e=>setMicId(e.target.value)}><option value="">Padrão do sistema</option>{devices.filter(d=>d.kind==="audioinput").map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||"Microfone"}</option>)}</select></label>
   <label>Saída de áudio<select value={speakerId} onChange={e=>setSpeakerId(e.target.value)}><option value="">Padrão do sistema</option>{devices.filter(d=>d.kind==="audiooutput").map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||"Saída de áudio"}</option>)}</select></label>
   <label>Volume do microfone <b>{input}%</b><input type="range" min="0" max="100" value={input} onChange={e=>setInput(+e.target.value)}/></label>
   <label>Volume de saída <b>{output}%</b><input type="range" min="0" max="100" value={output} onChange={e=>setOutput(+e.target.value)}/></label>
   <label>Sensibilidade <b>{sensitivity}%</b><input type="range" min="1" max="100" value={sensitivity} onChange={e=>setSensitivity(+e.target.value)}/></label>
   <div className="voice-toggles">
    <button className={noise?"on":""} onClick={()=>setNoise(!noise)}>Redução de ruído <span>{noise?"ON":"OFF"}</span></button>
    <button className={echo?"on":""} onClick={()=>setEcho(!echo)}>Cancelamento de eco <span>{echo?"ON":"OFF"}</span></button>
    <button className={agc?"on":""} onClick={()=>setAgc(!agc)}>Ganho automático <span>{agc?"ON":"OFF"}</span></button>
   </div>
   <p className="voice-note"><Headphones size={13}/> O navegador controla o volume físico final da saída. Os controles ficam preparados para o mixer WebRTC da próxima etapa.</p>
  </div>}
 </div>
}

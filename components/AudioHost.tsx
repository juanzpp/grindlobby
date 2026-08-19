"use client";
import {useEffect,useRef,useState} from "react";
import {
  Mic,MicOff,Headphones,SlidersHorizontal,Radio,PhoneOff,
  X,Volume2,AudioLines,Settings2
} from "lucide-react";

type Props={enabled:boolean};

export default function AudioHost({enabled}:Props){
 const [open,setOpen]=useState(false),[active,setActive]=useState(false),[muted,setMuted]=useState(false);
 const [input,setInput]=useState(125),[output,setOutput]=useState(80),[sensitivity,setSensitivity]=useState(38);
 const [noise,setNoise]=useState(true),[echo,setEcho]=useState(true),[agc,setAgc]=useState(true),[level,setLevel]=useState(0);
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]),[micId,setMicId]=useState(""),[speakerId,setSpeakerId]=useState("");
 const [testing,setTesting]=useState(false);
 const stream=useRef<MediaStream|null>(null),ctx=useRef<AudioContext|null>(null),gain=useRef<GainNode|null>(null),raf=useRef<number|undefined>(undefined);
 const testStream=useRef<MediaStream|null>(null),testAudio=useRef<HTMLAudioElement|null>(null);

 async function refreshDevices(){
  const d=await navigator.mediaDevices.enumerateDevices();
  setDevices(d);
 }
 function constraints(){
  return {
   deviceId:micId?{exact:micId}:undefined,
   echoCancellation:echo,
   noiseSuppression:noise,
   autoGainControl:agc,
   channelCount:1
  } as MediaTrackConstraints;
 }
 function stopMeter(){
  if(raf.current) cancelAnimationFrame(raf.current);
  raf.current=undefined;
  ctx.current?.close().catch(()=>{});
  ctx.current=null;
  setLevel(0);
 }
 function startMeter(s:MediaStream,monitor=false){
  stopMeter();
  const ac=new AudioContext();
  ctx.current=ac;
  const src=ac.createMediaStreamSource(s),inputGain=ac.createGain(),an=ac.createAnalyser();
  gain.current=inputGain;
  inputGain.gain.value=input/100;
  an.fftSize=256;
  src.connect(inputGain);
  inputGain.connect(an);
  if(monitor){
   const destination=ac.createMediaStreamDestination();
   inputGain.connect(destination);
   const audio=testAudio.current;
   if(audio){audio.srcObject=destination.stream;audio.volume=Math.min(1,output/100)}
   ac.resume().catch(()=>{});
  }
  const data=new Uint8Array(an.frequencyBinCount);
  const tick=()=>{
   an.getByteFrequencyData(data);
   const avg=data.reduce((a,b)=>a+b,0)/data.length;
   setLevel(Math.min(100,Math.round(avg*1.6)));
   raf.current=requestAnimationFrame(tick);
  };
  tick();
 }
 async function connect(){
  if(!enabled)return;
  try{
   disconnect();
   const s=await navigator.mediaDevices.getUserMedia({audio:constraints(),video:false});
   stream.current=s;
   s.getAudioTracks().forEach(t=>t.enabled=!muted);
   setActive(true);
   await refreshDevices();
  startMeter(s);
  }catch(e){
   console.error(e);
   setActive(false);
   alert("Não foi possível acessar o microfone. Confira a permissão do navegador.");
  }
 }
 function disconnect(){
  stopMicTest();
  stream.current?.getTracks().forEach(t=>t.stop());
  stream.current=null;
  stopMeter();
  setActive(false);
 }
 function toggleMute(){
  const next=!muted;
  setMuted(next);
  stream.current?.getAudioTracks().forEach(t=>t.enabled=!next);
 }
 async function runMicTest(){
  try{
   stopMicTest();
   const s=await navigator.mediaDevices.getUserMedia({audio:constraints(),video:false});
   testStream.current=s;
   const audio=new Audio();
   testAudio.current=audio;
   audio.autoplay=true;
  setTesting(true);
  startMeter(s,true);

   const anyAudio=audio as HTMLAudioElement & {setSinkId?:(id:string)=>Promise<void>};
   if(speakerId && anyAudio.setSinkId){
    try{await anyAudio.setSinkId(speakerId)}catch(e){console.warn("Saída selecionada não pôde ser aplicada",e)}
   }

   await audio.play();
  }catch(e){
   console.error(e);
   setTesting(false);
   alert("Não foi possível iniciar o monitoramento do microfone.");
  }
 }
 function stopMicTest(){
  testAudio.current?.pause();
  if(testAudio.current)testAudio.current.srcObject=null;
  testAudio.current=null;
  testStream.current?.getTracks().forEach(t=>t.stop());
  testStream.current=null;
  stopMeter();
  if(active&&stream.current)startMeter(stream.current);
  setTesting(false);
 }
 useEffect(()=>{refreshDevices().catch(()=>{});return()=>disconnect()},[]);
 useEffect(()=>{if(active)connect()},[micId,noise,echo,agc]);
 useEffect(()=>{
  if(testAudio.current)testAudio.current.volume=Math.min(1,output/100);
  if(gain.current)gain.current.gain.value=input/100;
 },[input,output]);

 return <>
 <div className="voice-engine compact">
  <div className="voice-head">
   <div><small>VOICE ENGINE</small><h2>Áudio da sala</h2></div>
   <span className={active?"voice-live":""}><Radio size={12}/>{active?"CONECTADO":"PRONTO"}</span>
  </div>

  <div className="voice-compact-row">
   <div className="voice-mini-meter"><i style={{width:`${muted?0:Math.max(2,level)}%`}}/></div>
   <span>{muted?"MIC MUDO":level>sensitivity?"FALANDO":"MIC OK"}</span>
  </div>

  <div className="voice-actions">
   {!active
    ? <button className="primary" disabled={!enabled} onClick={connect}><Mic size={16}/>Entrar no áudio</button>
    : <>
      <button className={muted?"voice-danger":"secondary"} onClick={toggleMute}>{muted?<MicOff size={16}/>:<Mic size={16}/>} {muted?"Ativar":"Mutar"}</button>
      <button className="voice-danger" onClick={disconnect}><PhoneOff size={16}/>Sair do áudio</button>
     </>
   }
   <button className="secondary" onClick={()=>setOpen(true)}><SlidersHorizontal size={16}/>Configurar</button>
  </div>
  {!enabled&&<p className="voice-note">Entre no lobby para liberar o áudio.</p>}
 </div>

 {open&&<div className="voice-modal-bg" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
  <div className="voice-modal">
   <div className="voice-modal-head">
    <div><small>VOICE ENGINE</small><h2>Configurações de áudio</h2><p>Dispositivos, qualidade e teste de microfone.</p></div>
    <button onClick={()=>setOpen(false)}><X size={18}/></button>
   </div>

   <div className="voice-settings-grid">
    <section className="voice-group">
     <div className="voice-group-title"><Headphones size={15}/><div><b>Dispositivos</b><span>Entrada e saída de áudio</span></div></div>
     <label>Microfone<select value={micId} onChange={e=>setMicId(e.target.value)}><option value="">Padrão do sistema</option>{devices.filter(d=>d.kind==="audioinput").map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||"Microfone"}</option>)}</select></label>
     <label>Saída de áudio<select value={speakerId} onChange={e=>setSpeakerId(e.target.value)}><option value="">Padrão do sistema</option>{devices.filter(d=>d.kind==="audiooutput").map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||"Saída de áudio"}</option>)}</select></label>
    </section>

    <section className="voice-group">
     <div className="voice-group-title"><AudioLines size={15}/><div><b>Entrada</b><span>Volume e detecção de voz</span></div></div>
    <label>Volume do microfone <b>{input}%</b><input type="range" min="0" max="200" value={input} onChange={e=>setInput(+e.target.value)}/></label>
     <label>Sensibilidade <b>{sensitivity}%</b><input type="range" min="1" max="100" value={sensitivity} onChange={e=>setSensitivity(+e.target.value)}/></label>
     <div className="voice-meter large"><i style={{width:`${Math.max(2,level)}%`}}/><span>{level>sensitivity?"Sua voz está sendo detectada":"Fale para calibrar"}</span></div>
    </section>

    <section className="voice-group">
     <div className="voice-group-title"><Volume2 size={15}/><div><b>Saída</b><span>Volume do áudio recebido</span></div></div>
    <label>Volume de saída <b>{output}%</b><input type="range" min="0" max="150" value={output} onChange={e=>setOutput(+e.target.value)}/></label>
    </section>

    <section className="voice-group">
     <div className="voice-group-title"><Settings2 size={15}/><div><b>Processamento</b><span>Limpeza e estabilidade da voz</span></div></div>
     <div className="voice-toggles">
      <button className={noise?"on":""} onClick={()=>setNoise(!noise)}>Redução de ruído <span>{noise?"ON":"OFF"}</span></button>
      <button className={echo?"on":""} onClick={()=>setEcho(!echo)}>Cancelamento de eco <span>{echo?"ON":"OFF"}</span></button>
      <button className={agc?"on":""} onClick={()=>setAgc(!agc)}>Ganho automático <span>{agc?"ON":"OFF"}</span></button>
     </div>
    </section>

    <section className="voice-group voice-test-group">
     <div className="voice-group-title"><Mic size={15}/><div><b>Teste de microfone</b><span>Ouça sua própria voz em tempo real</span></div></div>
     <div className="mic-test-box">
      <div className="mic-test-status"><div className={testing?"recording":""}/><span>{testing?"Monitoramento ativo — você está ouvindo o microfone":"Pronto para testar continuamente"}</span></div>
      <div className="mic-test-actions">
       {!testing
        ? <button className="primary" onClick={runMicTest}><Mic size={15}/>Testar microfone</button>
        : <button className="voice-danger" onClick={stopMicTest}><MicOff size={15}/>Sair do teste</button>}
      </div>
      <p className="voice-note"><Headphones size={13}/> Use fones de ouvido durante o teste para evitar eco ou microfonia.</p>
     </div>
    </section>
   </div>

   <div className="voice-modal-footer"><span>As preferências ficam preparadas para o mixer WebRTC.</span><button className="primary" onClick={()=>setOpen(false)}>Concluir</button></div>
  </div>
 </div>}
 </>
}

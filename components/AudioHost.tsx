"use client";
import {useEffect,useRef,useState} from "react";
import {AudioPreferences,AudioMode,AudioVoice,loadAudioPreferences,playAudioEvent,saveAudioPreferences} from "@/lib/audio";
import {
  Mic,MicOff,Headphones,SlidersHorizontal,Radio,PhoneOff,
  X,Volume2,AudioLines,Settings2
} from "lucide-react";

type Props={enabled:boolean};

export default function AudioHost({enabled}:Props){
 const [open,setOpen]=useState(false),[active,setActive]=useState(false),[muted,setMuted]=useState(false);
 const [input,setInput]=useState(125),[output,setOutput]=useState(80),[sensitivity,setSensitivity]=useState(38);
 const [noise,setNoise]=useState(true),[echo,setEcho]=useState(true),[agc,setAgc]=useState(false),[level,setLevel]=useState(0);
 const [testMode,setTestMode]=useState<"direct"|"processed">("processed"),[applied,setApplied]=useState<Partial<MediaTrackSettings>>({});
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]),[micId,setMicId]=useState(""),[speakerId,setSpeakerId]=useState("");
 const [testing,setTesting]=useState(false);
 const [audioPreferences,setAudioPreferences]=useState<AudioPreferences>(loadAudioPreferences);
 const stream=useRef<MediaStream|null>(null),ctx=useRef<AudioContext|null>(null),gain=useRef<GainNode|null>(null),outputGain=useRef<GainNode|null>(null),raf=useRef<number|undefined>(undefined);
 const testStream=useRef<MediaStream|null>(null),testAudio=useRef<HTMLAudioElement|null>(null);

 async function refreshDevices(){
  const d=await navigator.mediaDevices.enumerateDevices();
  setDevices(d);
 }
 function constraints(processed=true){
  return {
   deviceId:micId?{exact:micId}:undefined,
   sampleRate:{ideal:48000},
   sampleSize:{ideal:16},
   channelCount:{ideal:1},
   echoCancellation:processed?echo:false,
   noiseSuppression:processed?noise:false,
   autoGainControl:processed?agc:false
  } as MediaTrackConstraints;
 }
 function updateApplied(s:MediaStream){
  const track=s.getAudioTracks()[0];
  if(track)setApplied(track.getSettings());
 }
 async function applyProcessing(s:MediaStream,processed=true){
  const track=s.getAudioTracks()[0];
  if(!track)return;
  try{
   await track.applyConstraints({echoCancellation:processed?echo:false,noiseSuppression:processed?noise:false,autoGainControl:processed?agc:false});
   updateApplied(s);
  }catch(e){console.warn("As configurações de processamento não puderam ser aplicadas",e)}
 }
 function setSmoothGain(node:GainNode|null,value:number){
  if(!node||!ctx.current)return;
  const now=ctx.current.currentTime;
  node.gain.cancelScheduledValues(now);
  node.gain.setTargetAtTime(value,now,0.035);
 }
 function stopMeter(){
  if(raf.current) cancelAnimationFrame(raf.current);
  raf.current=undefined;
  ctx.current?.close().catch(()=>{});
  ctx.current=null;
  gain.current=null;
  outputGain.current=null;
  setLevel(0);
 }
 function startMeter(s:MediaStream,monitor=false){
  stopMeter();
  const ac=new AudioContext();
  ctx.current=ac;
  const src=ac.createMediaStreamSource(s),inputGain=ac.createGain(),an=ac.createAnalyser();
  gain.current=inputGain;
  an.fftSize=256;
  src.connect(inputGain);
  inputGain.connect(an);
    setSmoothGain(inputGain,input/100);
  if(monitor){
     const destination=ac.createMediaStreamDestination(),monitorGain=ac.createGain();
     outputGain.current=monitorGain;
     inputGain.connect(monitorGain);
     monitorGain.connect(destination);
     setSmoothGain(monitorGain,output/100);
   const audio=testAudio.current;
     if(audio){audio.srcObject=destination.stream;audio.volume=1}
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
  updateApplied(s);
   setActive(true);
  playAudioEvent("mic_active",audioPreferences);
  playAudioEvent("connected",audioPreferences);
   await refreshDevices();
  startMeter(s);
  }catch(e){
   console.error(e);
   setActive(false);
   alert("Não foi possível acessar o microfone. Confira a permissão do navegador.");
  }
 }
 function disconnect(notify=true){
  const wasActive=active;
  stopMicTest();
  stream.current?.getTracks().forEach(t=>t.stop());
  stream.current=null;
  stopMeter();
  setActive(false);
  if(notify&&wasActive)playAudioEvent("disconnected",audioPreferences);
 }
 function toggleMute(){
  const next=!muted;
  setMuted(next);
  stream.current?.getAudioTracks().forEach(t=>t.enabled=!next);
  playAudioEvent("mic_muted",audioPreferences);
 }
 async function runMicTest(mode=testMode){
  try{
   stopMicTest();
  const s=await navigator.mediaDevices.getUserMedia({audio:constraints(mode==="processed"),video:false});
   testStream.current=s;
  playAudioEvent("mic_test",audioPreferences);
   updateApplied(s);
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
  if(active&&stream.current){
   updateApplied(stream.current);
   startMeter(stream.current);
  }
  setTesting(false);
 }
 useEffect(()=>{refreshDevices().catch(()=>{});return()=>disconnect(false)},[]);
 useEffect(()=>{if(active)connect()},[micId]);
 useEffect(()=>{
  if(testAudio.current)testAudio.current.volume=1;
  setSmoothGain(gain.current,input/100);
  setSmoothGain(outputGain.current,output/100);
 },[input,output]);
 useEffect(()=>{
  if(stream.current)applyProcessing(stream.current,true).catch(()=>{});
  if(testStream.current)applyProcessing(testStream.current,testMode==="processed").catch(()=>{});
 },[noise,echo,agc]);
 async function chooseTestMode(mode:"direct"|"processed"){
  setTestMode(mode);
  if(testing){stopMicTest();await runMicTest(mode)}
 }
 function updateAudioPreferences(next:Partial<AudioPreferences>){
  setAudioPreferences(current=>{
   const updated={...current,...next};
   saveAudioPreferences(updated);
   return updated;
  });
 }

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
      <button className="voice-danger" onClick={()=>disconnect()}><PhoneOff size={16}/>Sair do áudio</button>
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
       <button className={!noise&&!echo&&!agc?"on":""} onClick={()=>{setNoise(false);setEcho(false);setAgc(false)}}>Áudio Natural <span>PRESET</span></button>
       <button className={noise&&echo&&!agc?"on":""} onClick={()=>{setNoise(true);setEcho(true);setAgc(false)}}>Voz Competitiva <span>PRESET</span></button>
      </div>
     <div className="voice-toggles">
      <button className={noise?"on":""} onClick={()=>setNoise(!noise)}>Redução de ruído <span>{noise?"ON":"OFF"}</span></button>
      <button className={echo?"on":""} onClick={()=>setEcho(!echo)}>Cancelamento de eco <span>{echo?"ON":"OFF"}</span></button>
      <button className={agc?"on":""} onClick={()=>setAgc(!agc)}>Ganho automático <span>{agc?"ON":"OFF"}</span></button>
     </div>
      <div className="voice-note">Aplicado: {applied.sampleRate||"—"} Hz · {applied.sampleSize||"—"} bit · {applied.channelCount||"—"} canal · NS {applied.noiseSuppression?"ON":"OFF"} · EC {applied.echoCancellation?"ON":"OFF"} · AGC {applied.autoGainControl?"ON":"OFF"}</div>
    </section>

    <section className="voice-group audio-alerts-group">
     <div className="voice-group-title"><Radio size={15}/><div><b>Sons e avisos</b><span>Alertas da sala e preferências de reprodução</span></div></div>
     <div className="voice-toggles">
      <button className={audioPreferences.soundsEnabled?"on":""} onClick={()=>updateAudioPreferences({soundsEnabled:!audioPreferences.soundsEnabled})}>Sons de interface <span>{audioPreferences.soundsEnabled?"ON":"OFF"}</span></button>
      <button className={audioPreferences.voiceEnabled?"on":""} onClick={()=>updateAudioPreferences({voiceEnabled:!audioPreferences.voiceEnabled})}>Avisos por voz <span>{audioPreferences.voiceEnabled?"ON":"OFF"}</span></button>
     </div>
     <label>Voz<select value={audioPreferences.voice} onChange={e=>updateAudioPreferences({voice:e.target.value as AudioVoice})}><option value="laura">Laura</option><option value="adam">Adam</option></select></label>
     <label>Modo<select value={audioPreferences.mode} onChange={e=>updateAudioPreferences({mode:e.target.value as AudioMode})}><option value="sound">Som apenas</option><option value="voice">Voz apenas</option><option value="both">Ambos</option><option value="disabled">Desativado</option></select></label>
     <label>Volume dos sons <b>{Math.round(audioPreferences.soundsVolume*100)}%</b><input type="range" min="0" max="100" value={Math.round(audioPreferences.soundsVolume*100)} onChange={e=>updateAudioPreferences({soundsVolume:+e.target.value/100})}/></label>
     <label>Volume da voz <b>{Math.round(audioPreferences.voiceVolume*100)}%</b><input type="range" min="0" max="100" value={Math.round(audioPreferences.voiceVolume*100)} onChange={e=>updateAudioPreferences({voiceVolume:+e.target.value/100})}/></label>
    </section>

    <section className="voice-group voice-test-group">
     <div className="voice-group-title"><Mic size={15}/><div><b>Teste de microfone</b><span>Ouça sua própria voz em tempo real</span></div></div>
     <div className="mic-test-box">
      <div className="mic-test-status"><div className={testing?"recording":""}/><span>{testing?"Monitoramento ativo — você está ouvindo o microfone":"Pronto para testar continuamente"}</span></div>
      <div className="voice-toggles mic-test-modes">
       <button className={testMode==="direct"?"on":""} onClick={()=>chooseTestMode("direct")}>Direto <span>SEM PROCESSAMENTO</span></button>
       <button className={testMode==="processed"?"on":""} onClick={()=>chooseTestMode("processed")}>Processado <span>CONFIGURAÇÃO ATUAL</span></button>
      </div>
      <div className="mic-test-actions">
       {!testing
        ? <button className="primary" onClick={()=>runMicTest()}><Mic size={15}/>Testar microfone</button>
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

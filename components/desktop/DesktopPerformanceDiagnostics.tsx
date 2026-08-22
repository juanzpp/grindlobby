"use client";

import {useEffect,useRef,useState} from "react";
import {Activity,Clipboard,Microchip,X} from "lucide-react";
import {ConnectionState,LocalAudioTrack,LocalVideoTrack,RemoteAudioTrack,RemoteVideoTrack,Track,type Room} from "livekit-client";
import {subscribeActiveLiveKitRoom} from "@/lib/webrtc/useLobbyVoice";

type NativeSnapshot={
  appPid:number;appMemoryBytes:number;appVirtualMemoryBytes:number;appCpuPercentRaw:number;appCpuPercentNormalized:number;
  processTreeMemoryBytes:number;processTreeVirtualMemoryBytes:number;processTreeCpuPercentRaw:number;processTreeCpuPercentNormalized:number;
  childProcesses:number;systemMemoryTotalBytes:number;systemMemoryUsedBytes:number;systemCpuPercent:number;logicalCpuCount:number;
  processUptimeSeconds:number;diskReadBytesDelta:number;diskWrittenBytesDelta:number;
};
type BrowserSnapshot={uiFps:number|null;longTasks:number;longTaskMs:number;jsHeapUsedBytes:number|null;jsHeapTotalBytes:number|null;jsHeapLimitBytes:number|null;hardwareConcurrency:number|null;deviceMemoryGb:number|null;networkRttMs:number|null;downlinkMbps:number|null;effectiveType:string|null};
type MediaSnapshot={connectionState:string;participantCount:number;rttMs:number|null;jitterMs:number|null;packetLossPercent:number|null;audioBitrateKbps:number|null;videoBitrateKbps:number|null;videoWidth:number|null;videoHeight:number|null;videoFps:number|null;framesDropped:number|null;encodeMsPerFrame:number|null;decodeMsPerFrame:number|null};
type ByteBaseline={at:number;audio:number;video:number};

declare global{
  interface Window{
    __TAURI__?:{core?:{invoke:<T>(command:string,args?:Record<string,unknown>)=>Promise<T>}};
  }
  interface Performance{memory?:{usedJSHeapSize:number;totalJSHeapSize:number;jsHeapSizeLimit:number}}
  interface Navigator{deviceMemory?:number;connection?:{rtt?:number;downlink?:number;effectiveType?:string}}
}

const emptyBrowser:BrowserSnapshot={uiFps:null,longTasks:0,longTaskMs:0,jsHeapUsedBytes:null,jsHeapTotalBytes:null,jsHeapLimitBytes:null,hardwareConcurrency:null,deviceMemoryGb:null,networkRttMs:null,downlinkMbps:null,effectiveType:null};
const emptyMedia:MediaSnapshot={connectionState:"sem call",participantCount:0,rttMs:null,jitterMs:null,packetLossPercent:null,audioBitrateKbps:null,videoBitrateKbps:null,videoWidth:null,videoHeight:null,videoFps:null,framesDropped:null,encodeMsPerFrame:null,decodeMsPerFrame:null};

function mb(bytes:number|null|undefined){return bytes==null?"—":`${(bytes/1024/1024).toFixed(bytes>1024*1024*1024?0:1)} MB`}
function pct(value:number|null|undefined){return value==null?"—":`${value.toFixed(1)}%`}
function num(value:number|null|undefined,suffix=""){return value==null?"—":`${value.toFixed(value<10?1:0)}${suffix}`}

async function readMedia(room:Room,baseline:ByteBaseline|null):Promise<{snapshot:MediaSnapshot;baseline:ByteBaseline}>{
  const tracks:(LocalAudioTrack|RemoteAudioTrack|LocalVideoTrack|RemoteVideoTrack)[]=[];
  const localMic=room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
  const localScreen=room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
  if(localMic instanceof LocalAudioTrack)tracks.push(localMic);
  if(localScreen instanceof LocalVideoTrack)tracks.push(localScreen);
  for(const participant of room.remoteParticipants.values()){
    const mic=participant.getTrackPublication(Track.Source.Microphone)?.track;
    const screen=participant.getTrackPublication(Track.Source.ScreenShare)?.track;
    if(mic instanceof RemoteAudioTrack)tracks.push(mic);
    if(screen instanceof RemoteVideoTrack)tracks.push(screen);
  }

  let rtt:number|null=null,jitter:number|null=null,lost=0,received=0,audioBytes=0,videoBytes=0,width:number|null=null,height:number|null=null,fps:number|null=null,dropped=0,framesEncoded=0,framesDecoded=0,totalEncode=0,totalDecode=0;
  for(const track of tracks){
    try{
      const report=await (track as typeof track&{getRTCStatsReport?:()=>Promise<RTCStatsReport>}).getRTCStatsReport?.();
      report?.forEach(entry=>{
        const row=entry as RTCStats&{kind?:string;mediaType?:string;currentRoundTripTime?:number;roundTripTime?:number;jitter?:number;packetsLost?:number;packetsReceived?:number;bytesReceived?:number;bytesSent?:number;frameWidth?:number;frameHeight?:number;framesPerSecond?:number;framesDropped?:number;framesEncoded?:number;framesDecoded?:number;totalEncodeTime?:number;totalDecodeTime?:number;state?:string};
        if(row.type==="candidate-pair"&&row.state==="succeeded"&&typeof row.currentRoundTripTime==="number")rtt=rtt==null?row.currentRoundTripTime*1000:Math.min(rtt,row.currentRoundTripTime*1000);
        if(row.type==="remote-inbound-rtp"&&typeof row.roundTripTime==="number")rtt=rtt==null?row.roundTripTime*1000:Math.min(rtt,row.roundTripTime*1000);
        if((row.type==="inbound-rtp"||row.type==="remote-inbound-rtp")&&typeof row.jitter==="number")jitter=Math.max(jitter??0,row.jitter*1000);
        if(typeof row.packetsLost==="number"&&row.packetsLost>0)lost+=row.packetsLost;
        if(typeof row.packetsReceived==="number"&&row.packetsReceived>0)received+=row.packetsReceived;
        const kind=row.kind??row.mediaType;
        const bytes=(row.bytesReceived??0)+(row.bytesSent??0);
        if(kind==="audio")audioBytes+=bytes;
        if(kind==="video")videoBytes+=bytes;
        if(typeof row.frameWidth==="number")width=Math.max(width??0,row.frameWidth);
        if(typeof row.frameHeight==="number")height=Math.max(height??0,row.frameHeight);
        if(typeof row.framesPerSecond==="number")fps=Math.max(fps??0,row.framesPerSecond);
        if(typeof row.framesDropped==="number")dropped+=row.framesDropped;
        if(typeof row.framesEncoded==="number")framesEncoded+=row.framesEncoded;
        if(typeof row.framesDecoded==="number")framesDecoded+=row.framesDecoded;
        if(typeof row.totalEncodeTime==="number")totalEncode+=row.totalEncodeTime;
        if(typeof row.totalDecodeTime==="number")totalDecode+=row.totalDecodeTime;
      });
    }catch{}
  }
  const now=performance.now(),elapsed=baseline?(now-baseline.at)/1000:0;
  const audioBitrate=baseline&&elapsed>0&&audioBytes>=baseline.audio?(audioBytes-baseline.audio)*8/elapsed/1000:null;
  const videoBitrate=baseline&&elapsed>0&&videoBytes>=baseline.video?(videoBytes-baseline.video)*8/elapsed/1000:null;
  return {snapshot:{
    connectionState:room.state===ConnectionState.Connected?"conectado":room.state===ConnectionState.Reconnecting?"reconectando":String(room.state),participantCount:room.numParticipants,
    rttMs:rtt==null?null:Math.round(rtt),jitterMs:jitter==null?null:Math.round(jitter*10)/10,packetLossPercent:received+lost>0?Math.round(lost/(received+lost)*1000)/10:null,
    audioBitrateKbps:audioBitrate==null?null:Math.round(audioBitrate),videoBitrateKbps:videoBitrate==null?null:Math.round(videoBitrate),videoWidth:width,videoHeight:height,videoFps:fps==null?null:Math.round(fps),framesDropped:dropped||null,
    encodeMsPerFrame:framesEncoded>0?Math.round(totalEncode/framesEncoded*10000)/10:null,decodeMsPerFrame:framesDecoded>0?Math.round(totalDecode/framesDecoded*10000)/10:null,
  },baseline:{at:now,audio:audioBytes,video:videoBytes}};
}

export default function DesktopPerformanceDiagnostics(){
  const [lite,setLite]=useState(false),[open,setOpen]=useState(false),[native,setNative]=useState<NativeSnapshot|null>(null),[browser,setBrowser]=useState<BrowserSnapshot>(emptyBrowser),[media,setMedia]=useState<MediaSnapshot>(emptyMedia),[copied,setCopied]=useState(false);
  const roomRef=useRef<Room|null>(null),baselineRef=useRef<ByteBaseline|null>(null),longTasks=useRef({count:0,ms:0});

  useEffect(()=>{setLite(new URLSearchParams(location.search).get("desktop")==="lite")},[]);
  useEffect(()=>{
    if(!lite)return;
    return subscribeActiveLiveKitRoom(room=>{roomRef.current=room;baselineRef.current=null;if(!room)setMedia(emptyMedia)});
  },[lite]);
  useEffect(()=>{
    if(!lite||!open)return;
    let frames=0,last=performance.now(),raf=0,disposed=false;
    const tick=(now:number)=>{frames+=1;if(now-last>=1000){const fpsValue=Math.round(frames*1000/(now-last));frames=0;last=now;setBrowser(current=>({...current,uiFps:fpsValue}))}raf=requestAnimationFrame(tick)};
    raf=requestAnimationFrame(tick);
    let observer:PerformanceObserver|null=null;
    try{
      observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){longTasks.current.count+=1;longTasks.current.ms+=entry.duration}});
      observer.observe({entryTypes:["longtask"]});
    }catch{}
    const sample=async()=>{
      if(disposed)return;
      const memory=performance.memory,connection=navigator.connection;
      setBrowser(current=>({...current,longTasks:longTasks.current.count,longTaskMs:Math.round(longTasks.current.ms),jsHeapUsedBytes:memory?.usedJSHeapSize??null,jsHeapTotalBytes:memory?.totalJSHeapSize??null,jsHeapLimitBytes:memory?.jsHeapSizeLimit??null,hardwareConcurrency:navigator.hardwareConcurrency||null,deviceMemoryGb:navigator.deviceMemory??null,networkRttMs:connection?.rtt??null,downlinkMbps:connection?.downlink??null,effectiveType:connection?.effectiveType??null}));
      const invoke=window.__TAURI__?.core?.invoke;
      if(invoke)invoke<NativeSnapshot>("performance_snapshot").then(value=>{if(!disposed)setNative(value)}).catch(()=>{});
      const room=roomRef.current;
      if(room){const result=await readMedia(room,baselineRef.current);baselineRef.current=result.baseline;if(!disposed)setMedia(result.snapshot)}
    };
    void sample();const timer=window.setInterval(()=>void sample(),3000);
    return()=>{disposed=true;cancelAnimationFrame(raf);observer?.disconnect();window.clearInterval(timer)};
  },[lite,open]);

  if(!lite)return null;
  const snapshot={capturedAt:new Date().toISOString(),native,browser,media,userAgent:navigator.userAgent};
  const copy=async()=>{await navigator.clipboard.writeText(JSON.stringify(snapshot,null,2));setCopied(true);setTimeout(()=>setCopied(false),1200)};
  return <div className={`lite-diagnostics ${open?"open":""}`}>
    {!open?<button className="lite-diag-toggle" onClick={()=>setOpen(true)} title="Abrir diagnóstico"><Activity/>DIAG</button>:<section className="lite-diag-panel">
      <header><div><Microchip/><span><b>Performance Monitor</b><small>coleta local · 3 s</small></span></div><div><button onClick={()=>void copy()} title="Copiar JSON"><Clipboard/>{copied?"OK":"JSON"}</button><button onClick={()=>setOpen(false)} title="Fechar"><X/></button></div></header>
      <div className="lite-diag-grid">
        <article><small>CPU APP + WEBVIEW</small><b>{pct(native?.processTreeCpuPercentNormalized)}</b><span>raw {pct(native?.processTreeCpuPercentRaw)} · {native?.childProcesses??"—"} filhos</span></article>
        <article><small>RAM APP + WEBVIEW</small><b>{mb(native?.processTreeMemoryBytes)}</b><span>shell {mb(native?.appMemoryBytes)}</span></article>
        <article><small>UI FPS</small><b>{browser.uiFps??"—"}</b><span>{browser.longTasks} long tasks · {browser.longTaskMs} ms</span></article>
        <article><small>JS HEAP</small><b>{mb(browser.jsHeapUsedBytes)}</b><span>alocado {mb(browser.jsHeapTotalBytes)}</span></article>
        <article><small>VOICE RTT / JITTER</small><b>{num(media.rttMs," ms")}</b><span>{num(media.jitterMs," ms")} jitter · {num(media.packetLossPercent,"%")} loss</span></article>
        <article><small>ÁUDIO WEBRTC</small><b>{num(media.audioBitrateKbps," kbps")}</b><span>{media.connectionState} · {media.participantCount} participantes</span></article>
        <article><small>TRANSMISSÃO</small><b>{media.videoWidth&&media.videoHeight?`${media.videoWidth}×${media.videoHeight}`:"—"}</b><span>{num(media.videoFps," fps")} · {num(media.videoBitrateKbps," kbps")}</span></article>
        <article><small>ENCODE / DECODE</small><b>{num(media.encodeMsPerFrame," ms")}</b><span>decode {num(media.decodeMsPerFrame," ms")} · dropped {media.framesDropped??"—"}</span></article>
        <article><small>SISTEMA</small><b>{native?`${pct(native.systemCpuPercent)} CPU`:"—"}</b><span>{native?`${mb(native.systemMemoryUsedBytes)} / ${mb(native.systemMemoryTotalBytes)}`:"Disponível somente no EXE"}</span></article>
        <article><small>REDE ESTIMADA</small><b>{num(browser.networkRttMs," ms")}</b><span>{num(browser.downlinkMbps," Mbps")} · {browser.effectiveType??"—"}</span></article>
      </div>
    </section>}
  </div>;
}
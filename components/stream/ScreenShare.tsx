"use client";

import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {
  Expand,Maximize2,Minimize2,MonitorUp,PanelRight,PictureInPicture2,Radio,
  Square,Volume2,X,Zap,
} from "lucide-react";
import {
  AudioPresets,
  ConnectionState,
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteAudioTrack,
  RemoteVideoTrack,
  Room,
  RoomEvent,
  Track,
  type LocalTrack,
  type VideoTrack,
} from "livekit-client";
import GrindPortalLoading from "@/components/feedback/GrindPortalLoading";
import {
  loadAudioOutputPreferences,
  subscribeAudioOutput,
  type AudioOutputPreferences,
} from "@/lib/audio-output";
import {subscribeActiveLiveKitRoom} from "@/lib/webrtc/useLobbyVoice";
import {shouldUseScreenSimulcast} from "@/lib/webrtc/mediaPolicy";

type Entitlement={
  tier:"free"|"pro";
  maxWidth:number;
  maxHeight:number;
  maxFps:number;
  allowed?:boolean;
  reason?:string|null;
};

type Share={
  ownerId:string;
  ownerName:string;
  track:VideoTrack;
  audioTrack:RemoteAudioTrack|null;
  audioPublished:boolean;
  local:boolean;
  quality:string;
};

type ScreenAudioState={supported:boolean;available:boolean|null;published:boolean};
type QualityPreset={height:360|480|720|1080;width:number;fps:number;bitrate:number;label:string};
type ViewMode="player"|"split"|"floating"|"minimized";
type StreamStats={rtt:number|null;bitrate:number|null;fps:number|null;dropped:number|null;packetLoss:number|null};

const qualityPresets:QualityPreset[]=[
  {height:360,width:640,fps:30,bitrate:750_000,label:"360p"},
  {height:480,width:854,fps:30,bitrate:1_250_000,label:"480p"},
  {height:720,width:1280,fps:30,bitrate:2_800_000,label:"720p"},
  {height:1080,width:1920,fps:60,bitrate:6_500_000,label:"1080p"},
];
const freeEntitlement:Entitlement={tier:"free",maxWidth:1280,maxHeight:720,maxFps:30,allowed:true,reason:null};
const streamVolumeKey="grindlobby.stream.volume.v2";

function supportsScreenCapture(){return typeof window!=="undefined"&&window.isSecureContext&&typeof navigator.mediaDevices?.getDisplayMedia==="function"}
function clamp01(value:number){return Math.max(0,Math.min(1,value))}
function perceptualGain(percent:number){const normalized=clamp01(percent/100);return normalized*normalized}
function trackQuality(track:VideoTrack){const settings=track.mediaStreamTrack.getSettings(),width=settings.width,height=settings.height,fps=settings.frameRate;return width&&height?`${width}×${height}${fps?` · ${Math.round(fps)} FPS`:""}`:"Qualidade adaptativa"}
function loadStreamVolume(){if(typeof window==="undefined")return 30;const raw=Number(localStorage.getItem(streamVolumeKey));return Number.isFinite(raw)?Math.max(0,Math.min(100,raw)):30}

function snapshot(room:Room|null):Share[]{
  if(!room||room.state===ConnectionState.Disconnected)return[];
  const shares:Share[]=[];
  const localVideo=room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
  const localAudioPublication=room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
  if(localVideo instanceof LocalVideoTrack){shares.push({ownerId:room.localParticipant.identity,ownerName:room.localParticipant.name||"Você",track:localVideo,audioTrack:null,audioPublished:Boolean(localAudioPublication),local:true,quality:trackQuality(localVideo)})}
  for(const participant of room.remoteParticipants.values()){
    const video=participant.getTrackPublication(Track.Source.ScreenShare)?.track;
    const audioPublication=participant.getTrackPublication(Track.Source.ScreenShareAudio);
    const audio=audioPublication?.track;
    if(video instanceof RemoteVideoTrack)shares.push({ownerId:participant.identity,ownerName:participant.name||"Player",track:video,audioTrack:audio instanceof RemoteAudioTrack?audio:null,audioPublished:Boolean(audioPublication),local:false,quality:trackQuality(video)});
  }
  return shares;
}

function StreamVideo({share,volume}:{share:Share;volume:number}){
  const videoRef=useRef<HTMLVideoElement>(null),audioRef=useRef<HTMLAudioElement>(null);
  const [output,setOutput]=useState<AudioOutputPreferences>(loadAudioOutputPreferences);
  const [playbackBlocked,setPlaybackBlocked]=useState(false);
  const gain=useMemo(()=>perceptualGain(volume)*perceptualGain(Math.min(100,output.volume)),[volume,output.volume]);

  useEffect(()=>subscribeAudioOutput(setOutput),[]);
  useEffect(()=>{
    const element=videoRef.current;if(!element)return;
    share.track.attach(element);element.autoplay=true;element.playsInline=true;element.muted=true;
    element.play().catch(()=>{});
    return()=>{share.track.detach(element)};
  },[share.track]);
  useEffect(()=>{
    const element=audioRef.current,track=share.audioTrack;if(!element||!track)return;
    setPlaybackBlocked(false);track.attach(element);element.autoplay=true;element.volume=1;element.muted=gain<=0;
    track.setVolume(gain);
    if(output.deviceId)track.setSinkId(output.deviceId).catch(()=>{});
    if(gain>0)element.play().catch(()=>setPlaybackBlocked(true));
    return()=>{track.detach(element);track.setVolume(1)};
  },[share.audioTrack,output.deviceId]);
  useEffect(()=>{
    const element=audioRef.current,track=share.audioTrack;if(!track)return;
    track.setVolume(gain);if(element)element.muted=gain<=0;
    if(element&&gain>0&&element.paused)element.play().catch(()=>setPlaybackBlocked(true));
  },[share.audioTrack,gain]);

  async function resumeAudio(){const element=audioRef.current;if(!element)return;element.muted=false;await element.play();setPlaybackBlocked(false)}
  return <><video ref={videoRef} autoPlay playsInline muted/><audio ref={audioRef} autoPlay playsInline/>{playbackBlocked?<button className="stream-unlock-audio" onClick={()=>resumeAudio().catch(()=>{})}><Volume2 size={15}/>Ativar áudio da transmissão</button>:null}</>;
}

export default function ScreenShare({isPro=false,gameName="GrindLobby",gameBanner="/lobby-games/grind.svg"}:{isPro?:boolean;gameName?:string;gameBanner?:string}){
  const initialEntitlement=isPro?{tier:"pro" as const,maxWidth:1920,maxHeight:1080,maxFps:60,allowed:true,reason:null}:freeEntitlement;
  const [room,setRoom]=useState<Room|null>(null),[shares,setShares]=useState<Share[]>([]),[panel,setPanel]=useState(false),[viewerId,setViewerId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[reconnecting,setReconnecting]=useState(false),[surface,setSurface]=useState<"monitor"|"window"|"browser">("browser");
  const [quality,setQuality]=useState<360|480|720|1080>(720),[volume,setVolume]=useState(loadStreamVolume),[error,setError]=useState("");
  const [entitlement,setEntitlement]=useState<Entitlement>(initialEntitlement),[screenAudio,setScreenAudio]=useState<ScreenAudioState>(()=>({supported:supportsScreenCapture(),available:null,published:false}));
  const [mode,setMode]=useState<ViewMode>("player"),[stats,setStats]=useState<StreamStats>({rtt:null,bitrate:null,fps:null,dropped:null,packetLoss:null});
  const [floatPos,setFloatPos]=useState({x:0,y:0}),dragRef=useRef<{x:number;y:number;left:number;top:number}|null>(null),playerRef=useRef<HTMLDivElement>(null),bytesRef=useRef<{bytes:number;at:number}|null>(null);
  const roomRef=useRef<Room|null>(null),operationRef=useRef<"start"|"stop"|null>(null),stopRequestedRef=useRef(false);

  useEffect(()=>subscribeActiveLiveKitRoom(next=>{roomRef.current=next;setRoom(next)}),[]);
  useEffect(()=>{localStorage.setItem(streamVolumeKey,String(volume))},[volume]);
  useEffect(()=>{getServerEntitlement().catch(()=>{})},[]);
  useEffect(()=>{
    if(!room){setShares([]);setReconnecting(false);return}
    const sync=()=>{const next=snapshot(room);setShares(next);const local=next.find(item=>item.local);setScreenAudio(current=>({...current,published:Boolean(local?.audioPublished)}));setViewerId(current=>current&&next.some(item=>item.ownerId===current)?current:(next.find(item=>!item.local)?.ownerId??next.find(item=>item.local)?.ownerId??null))};
    const onConnected=()=>{setReconnecting(false);sync()},onReconnecting=()=>{setReconnecting(true);sync()},onReconnected=()=>{setReconnecting(false);sync()},onDisconnected=()=>{setReconnecting(false);sync()};
    setReconnecting(room.state===ConnectionState.Reconnecting);sync();
    room.on(RoomEvent.Connected,onConnected).on(RoomEvent.ParticipantConnected,sync).on(RoomEvent.ParticipantDisconnected,sync).on(RoomEvent.TrackPublished,sync).on(RoomEvent.TrackUnpublished,sync).on(RoomEvent.TrackSubscribed,sync).on(RoomEvent.TrackUnsubscribed,sync).on(RoomEvent.LocalTrackPublished,sync).on(RoomEvent.LocalTrackUnpublished,sync).on(RoomEvent.Reconnecting,onReconnecting).on(RoomEvent.Reconnected,onReconnected).on(RoomEvent.ConnectionStateChanged,sync).on(RoomEvent.Disconnected,onDisconnected);
    return()=>{room.off(RoomEvent.Connected,onConnected).off(RoomEvent.ParticipantConnected,sync).off(RoomEvent.ParticipantDisconnected,sync).off(RoomEvent.TrackPublished,sync).off(RoomEvent.TrackUnpublished,sync).off(RoomEvent.TrackSubscribed,sync).off(RoomEvent.TrackUnsubscribed,sync).off(RoomEvent.LocalTrackPublished,sync).off(RoomEvent.LocalTrackUnpublished,sync).off(RoomEvent.Reconnecting,onReconnecting).off(RoomEvent.Reconnected,onReconnected).off(RoomEvent.ConnectionStateChanged,sync).off(RoomEvent.Disconnected,onDisconnected)};
  },[room]);

  const localShare=shares.find(item=>item.local),remoteShares=shares.filter(item=>!item.local),viewer=shares.find(item=>item.ownerId===viewerId)??null;

  useEffect(()=>{const mediaTrack=localShare?.track.mediaStreamTrack;if(!mediaTrack||!room)return;const ended=()=>{void stop()};mediaTrack.addEventListener("ended",ended,{once:true});return()=>mediaTrack.removeEventListener("ended",ended)},[localShare?.track,room]);
  useEffect(()=>{
    bytesRef.current=null;
    if(!viewer){setStats({rtt:null,bitrate:null,fps:null,dropped:null,packetLoss:null});return}
    let cancelled=false,inFlight=false;
    const read=async()=>{
      if(inFlight)return;inFlight=true;
      try{
        const report=await (viewer.track as VideoTrack&{getRTCStatsReport?:()=>Promise<RTCStatsReport>}).getRTCStatsReport?.();if(!report||cancelled)return;
        let rtt:number|null=null,bytes:number|null=null,fps:number|null=null,dropped:number|null=null,packetLoss:number|null=null;
        report.forEach(row=>{const stat=row as RTCStats&{currentRoundTripTime?:number;bytesReceived?:number;bytesSent?:number;framesPerSecond?:number;framesDropped?:number;packetsLost?:number;packetsReceived?:number;state?:string};if(stat.type==="candidate-pair"&&stat.state==="succeeded"&&typeof stat.currentRoundTripTime==="number")rtt=Math.round(stat.currentRoundTripTime*1000);if(stat.type==="inbound-rtp"&&!(stat as RTCInboundRtpStreamStats).kind?.includes("audio")){bytes=stat.bytesReceived??null;fps=stat.framesPerSecond??null;dropped=stat.framesDropped??null;const received=stat.packetsReceived??0,lost=stat.packetsLost??0;if(received+lost>0)packetLoss=lost/(received+lost)*100}}
        );
        const now=performance.now();let bitrate:number|null=null;if(bytes!=null&&bytesRef.current){const deltaBytes=bytes-bytesRef.current.bytes,deltaSeconds=(now-bytesRef.current.at)/1000;if(deltaBytes>=0&&deltaSeconds>0)bitrate=Math.round(deltaBytes*8/deltaSeconds/1000)}if(bytes!=null)bytesRef.current={bytes,at:now};
        const measuredPacketLoss = packetLoss as number | null;
        setStats({rtt,bitrate,fps:fps?Math.round(fps):null,dropped,packetLoss:measuredPacketLoss==null?null:Math.round(measuredPacketLoss*10)/10});
      }catch{}finally{inFlight=false}
    };
    void read();const timer=window.setInterval(()=>void read(),2000);return()=>{cancelled=true;window.clearInterval(timer);bytesRef.current=null};
  },[viewer?.track]);
  useEffect(()=>{
    const move=(event:PointerEvent)=>{const drag=dragRef.current;if(!drag)return;setFloatPos({x:Math.max(-window.innerWidth/2,Math.min(window.innerWidth/2,drag.left+event.clientX-drag.x)),y:Math.max(-window.innerHeight/2,Math.min(window.innerHeight/2,drag.top+event.clientY-drag.y))})};
    const up=()=>{dragRef.current=null};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up)};
  },[]);

  async function getServerEntitlement(){const response=await fetch("/api/me/capabilities",{cache:"no-store"});if(!response.ok)throw new Error("Não foi possível validar o plano da conta.");const data=await response.json() as {screenShare:Entitlement};setEntitlement(data.screenShare);return data.screenShare}
  async function openPanel(){setError("");try{const capability=await getServerEntitlement();if(capability.allowed===false)throw new Error(capability.reason||"Transmissão indisponível para esta conta.");setPanel(true)}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível validar a transmissão.")}}
  async function start(){
    const targetRoom=room;
    if(operationRef.current)return;
    if(!targetRoom||targetRoom.state!==ConnectionState.Connected){setError("Entre no lobby antes de compartilhar a tela.");return}if(!screenAudio.supported){setError("Seu navegador não oferece captura de tela neste contexto.");return}
    operationRef.current="start";setBusy(true);setError("");setScreenAudio(current=>({...current,available:null,published:false}));let createdTracks:LocalTrack[]=[];
    try{
      const capability=await getServerEntitlement();
      if(capability.allowed===false)throw new Error(capability.reason||"Transmissão indisponível para esta conta.");
      const selected=qualityPresets.find(item=>item.height===quality)??qualityPresets[2];
      if(selected.height>capability.maxHeight)throw new Error(`Seu plano permite transmissão até ${capability.maxHeight}p.`);
      const maxFps=Math.min(selected.fps,capability.maxFps);
      const tracks=await targetRoom.localParticipant.createScreenTracks({audio:true,video:{displaySurface:surface},resolution:{width:selected.width,height:selected.height,frameRate:maxFps},contentHint:"motion",surfaceSwitching:"include",systemAudio:"include",suppressLocalAudioPlayback:false});
      createdTracks=tracks;
      if(roomRef.current!==targetRoom||targetRoom.state!==ConnectionState.Connected)throw new Error("A sala mudou enquanto a captura de tela era preparada.");
      const video=tracks.find(track=>track instanceof LocalVideoTrack) as LocalVideoTrack|undefined,audio=tracks.find(track=>track instanceof LocalAudioTrack) as LocalAudioTrack|undefined;if(!video)throw new Error("O navegador não retornou uma faixa de vídeo da tela.");
      await video.mediaStreamTrack.applyConstraints({width:{max:Math.min(selected.width,capability.maxWidth)},height:{max:Math.min(selected.height,capability.maxHeight)},frameRate:{max:Math.min(maxFps,capability.maxFps)}}).catch(()=>{});setScreenAudio(current=>({...current,available:Boolean(audio),published:false}));
      if(roomRef.current!==targetRoom||targetRoom.state!==ConnectionState.Connected)throw new Error("A sala mudou antes da publicação da transmissão.");
      await targetRoom.localParticipant.publishTrack(video,{source:Track.Source.ScreenShare,simulcast:shouldUseScreenSimulcast(selected.height,Math.min(maxFps,capability.maxFps)),videoCodec:"vp8",degradationPreference:"maintain-framerate",screenShareEncoding:{maxBitrate:selected.bitrate,maxFramerate:Math.min(maxFps,capability.maxFps)}});
      if(audio){try{if(roomRef.current!==targetRoom)throw new Error("room_changed");await targetRoom.localParticipant.publishTrack(audio,{source:Track.Source.ScreenShareAudio,audioPreset:AudioPresets.musicHighQualityStereo,dtx:false,forceStereo:true});setScreenAudio(current=>({...current,published:true}))}catch{audio.stop();setError("A tela está sendo transmitida, mas o áudio não pôde ser publicado.")}}
      setShares(snapshot(targetRoom));setViewerId(targetRoom.localParticipant.identity);setPanel(false);
    }catch(cause){for(const track of createdTracks){const publication=targetRoom.localParticipant.getTrackPublication(track.source);if(publication?.track)await targetRoom.localParticipant.unpublishTrack(publication.track,true).catch(()=>{});else track.stop()}if((cause as DOMException)?.name!=="NotAllowedError")setError(cause instanceof Error?cause.message:"Não foi possível iniciar a transmissão.")}finally{operationRef.current=null;setBusy(false);if(stopRequestedRef.current){stopRequestedRef.current=false;void stop()}}
  }
  async function stop(){
    const targetRoom=roomRef.current;
    if(!targetRoom)return;
    if(operationRef.current==="start"){stopRequestedRef.current=true;return}
    if(operationRef.current)return;
    operationRef.current="stop";setBusy(true);
    try{const publications=[targetRoom.localParticipant.getTrackPublication(Track.Source.ScreenShare),targetRoom.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio)];await Promise.all(publications.map(publication=>publication?.track?targetRoom.localParticipant.unpublishTrack(publication.track,true):Promise.resolve()));setScreenAudio(current=>({...current,available:null,published:false}));setViewerId(current=>current===targetRoom.localParticipant.identity?null:current);setShares(snapshot(targetRoom))}finally{operationRef.current=null;setBusy(false)}
  }
  async function fullscreen(){const target=playerRef.current;if(!target)return;if(document.fullscreenElement)await document.exitFullscreen();else await target.requestFullscreen()}
  function beginDrag(event:ReactPointerEvent){if(mode!=="floating"&&mode!=="minimized")return;dragRef.current={x:event.clientX,y:event.clientY,left:floatPos.x,top:floatPos.y}}

  const localAudioLabel=screenAudio.published?"Compartilhando áudio":localShare?"Compartilhando apenas vídeo":screenAudio.supported?"Áudio da tela disponível":"Áudio da tela não disponível neste navegador";
  const playerClass=`stream-player-shell stream-mode-${mode}`;

  return <section className="stream-card stream-center-card">
    <header className="stream-card-head"><div><small>TRANSMISSÃO</small><h2>Compartilhamento de tela</h2></div>{localShare?<span className="stream-live"><Radio size={12}/>{reconnecting?"RECONECTANDO":"AO VIVO"}</span>:<span className="stream-ready">BAIXA LATÊNCIA</span>}</header>
    <div className="stream-stage-home" style={{backgroundImage:`linear-gradient(180deg,rgba(4,4,8,.1),rgba(4,4,8,.82)),url(${gameBanner})`}}>
      {viewer?<div ref={playerRef} className={playerClass} style={mode==="floating"||mode==="minimized"?{transform:`translate(${floatPos.x}px,${floatPos.y}px)`}:undefined}>
        <header className="stream-player-head" onPointerDown={beginDrag}><div><i className={reconnecting?"is-reconnecting":""}/><span>{reconnecting?"Reconectando":"Tela ao vivo"}</span><b>{viewer.ownerName}</b></div><div className="stream-view-buttons"><button onClick={()=>setMode("player")} title="Player integrado"><PanelRight size={15}/></button><button onClick={()=>setMode("split")} title="Split view"><Expand size={15}/></button><button onClick={()=>setMode("floating")} title="Janela flutuante"><PictureInPicture2 size={15}/></button><button onClick={()=>setMode("minimized")} title="Minimizar"><Minimize2 size={15}/></button><button onClick={()=>fullscreen().catch(()=>{})} title="Tela cheia"><Maximize2 size={15}/></button><button onClick={()=>setViewerId(null)} title="Fechar"><X size={15}/></button></div></header>
        <div className="stream-stage"><StreamVideo share={viewer} volume={volume}/><div className="stream-stage-badges"><span>{viewer.quality}</span>{stats.rtt!=null?<span>{stats.rtt}ms RTT</span>:null}{stats.bitrate!=null?<span>{stats.bitrate} kbps</span>:null}{stats.packetLoss!=null?<span className={stats.packetLoss>3?"warn":""}>{stats.packetLoss}% loss</span>:null}</div></div>
        <footer className="stream-player-footer"><div className="stream-volume-control"><Volume2 size={15}/><input aria-label="Volume da transmissão" type="range" min="0" max="100" value={volume} onChange={event=>setVolume(Number(event.target.value))}/><b>{volume}%</b></div><div className="stream-tech-stats">{stats.fps!=null?<span>{stats.fps} FPS</span>:null}{stats.dropped!=null?<span>{stats.dropped} dropped</span>:null}</div></footer>
      </div>:<div className="stream-empty-stage"><img src="/brand/grindlobby-official.png" alt=""/><b>{gameName}</b><p>Nenhuma transmissão aberta. Quando alguém compartilhar a tela, ela aparece aqui sem bloquear o lobby.</p></div>}
    </div>

    <div className="stream-command-row">
      {localShare?<><div className="stream-active-copy"><b>{localShare.quality}</b><span>{localAudioLabel}</span></div><button onClick={()=>setViewerId(localShare.ownerId)}><Expand size={14}/>Abrir minha tela</button><button className="danger" onClick={stop} disabled={busy}><Square size={13}/>Parar</button></>:<button className="stream-start" onClick={openPanel} disabled={!room||reconnecting}><MonitorUp size={16}/>Compartilhar tela</button>}
    </div>
    {remoteShares.length?<div className="stream-friends-live"><small>TRANSMISSÕES NA SALA</small>{remoteShares.map(share=><button className="stream-available stream-available-rich" key={share.ownerId} onClick={()=>{setViewerId(share.ownerId);setMode("player")}}><span className="stream-share-icon"><MonitorUp size={16}/><i/></span><span className="stream-share-copy"><b>{share.ownerName}</b><small><Radio size={10}/> AO VIVO · {share.quality} · {share.audioPublished?"com áudio":"só vídeo"}</small></span><strong>Assistir</strong></button>)}</div>:null}
    {error?<p className="stream-error">{error}</p>:null}

    {panel?<div className="stream-modal-bg" role="dialog" aria-modal="true" aria-labelledby="share-title"><div className="stream-modal"><button className="modal-close" onClick={()=>setPanel(false)} aria-label="Fechar"><X/></button><small>PREPARAR TRANSMISSÃO</small><h2 id="share-title">O que você quer compartilhar?</h2><p>720p30 é o padrão recomendado para menor atraso. 1080p60 continua disponível no plano PRO.</p><div className="source-grid">{[["browser","Aba"],["window","Janela"],["monitor","Tela inteira"]].map(([value,label])=><button type="button" className={surface===value?"selected":""} onClick={()=>setSurface(value as typeof surface)} key={value}><MonitorUp/>{label}</button>)}</div><div className="stream-capability"><Volume2 size={16}/><span>{screenAudio.supported?"Áudio da tela disponível quando a fonte e o navegador oferecerem essa opção.":"Áudio da tela não disponível neste navegador."}</span></div><div className="stream-quality-picker"><div><span>Qualidade de captura</span><small><Zap size={12}/> 720p30 prioriza encode único; 1080p60 usa camadas adaptativas</small></div><div className="stream-quality-options">{qualityPresets.map(option=>{const locked=option.height>entitlement.maxHeight;return <button type="button" key={option.height} disabled={locked} className={quality===option.height?"selected":""} onClick={()=>setQuality(option.height)}><b>{option.label}</b><small>{option.fps} FPS{locked?" · PRO":""}</small></button>})}</div></div><div className="quality-row"><span>Plano {entitlement.tier.toUpperCase()}</span><b>Selecionado: {quality}p · até {Math.min(qualityPresets.find(item=>item.height===quality)?.fps??30,entitlement.maxFps)} FPS</b></div><button className="auth-primary" onClick={start} disabled={busy}>{busy?<GrindPortalLoading label="Preparando transmissão…"/>:"Abrir seletor do navegador"}</button></div></div>:null}
  </section>;
}

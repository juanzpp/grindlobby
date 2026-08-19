"use client";

import {useEffect,useRef,useState} from "react";
import {Expand,MonitorUp,Radio,Square,Volume2,X,Zap} from "lucide-react";
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

type ScreenAudioState={
  supported:boolean;
  available:boolean|null;
  published:boolean;
};
type QualityPreset={height:360|480|720|1080;width:number;fps:number;bitrate:number;label:string};
const qualityPresets:QualityPreset[]=[
  {height:360,width:640,fps:24,bitrate:650_000,label:"360p"},
  {height:480,width:854,fps:30,bitrate:1_100_000,label:"480p"},
  {height:720,width:1280,fps:30,bitrate:2_200_000,label:"720p"},
  {height:1080,width:1920,fps:60,bitrate:5_000_000,label:"1080p"},
];

const freeEntitlement:Entitlement={tier:"free",maxWidth:1280,maxHeight:720,maxFps:30,allowed:true,reason:null};

function supportsScreenCapture(){
  return typeof window!=="undefined"&&window.isSecureContext&&typeof navigator.mediaDevices?.getDisplayMedia==="function";
}

function trackQuality(track:VideoTrack){
  const settings=track.mediaStreamTrack.getSettings(),width=settings.width,height=settings.height,fps=settings.frameRate;
  return width&&height?`${width}×${height}${fps?` · ${Math.round(fps)} FPS`:""}`:"Qualidade adaptativa";
}

function snapshot(room:Room|null):Share[]{
  if(!room||room.state===ConnectionState.Disconnected)return[];
  const shares:Share[]=[];
  const localVideo=room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
  const localAudioPublication=room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
  if(localVideo instanceof LocalVideoTrack){
    shares.push({
      ownerId:room.localParticipant.identity,
      ownerName:room.localParticipant.name||"Você",
      track:localVideo,
      audioTrack:null,
      audioPublished:Boolean(localAudioPublication),
      local:true,
      quality:trackQuality(localVideo),
    });
  }
  for(const participant of room.remoteParticipants.values()){
    const video=participant.getTrackPublication(Track.Source.ScreenShare)?.track;
    const audioPublication=participant.getTrackPublication(Track.Source.ScreenShareAudio);
    const audio=audioPublication?.track;
    if(video instanceof RemoteVideoTrack){
      shares.push({
        ownerId:participant.identity,
        ownerName:participant.name||"Player",
        track:video,
        audioTrack:audio instanceof RemoteAudioTrack?audio:null,
        audioPublished:Boolean(audioPublication),
        local:false,
        quality:trackQuality(video),
      });
    }
  }
  return shares;
}

function StreamVideo({share,volume}:{share:Share;volume:number}){
  const videoRef=useRef<HTMLVideoElement>(null),audioRef=useRef<HTMLAudioElement>(null);
  const [output,setOutput]=useState<AudioOutputPreferences>(loadAudioOutputPreferences);
  const [playbackBlocked,setPlaybackBlocked]=useState(false);

  useEffect(()=>subscribeAudioOutput(setOutput),[]);
  useEffect(()=>{
    const element=videoRef.current;
    if(!element)return;
    share.track.attach(element);
    return()=>{share.track.detach(element)};
  },[share.track]);
  useEffect(()=>{
    const element=audioRef.current,track=share.audioTrack;
    if(!element||!track)return;
    setPlaybackBlocked(false);
    track.attach(element);
    element.autoplay=true;
    element.muted=false;
    track.setVolume(Math.min(1,Math.max(0,(volume/100)*(output.volume/100))));
    if(output.deviceId)track.setSinkId(output.deviceId).catch(()=>{});
    element.play().catch(()=>setPlaybackBlocked(true));
    return()=>{track.detach(element)};
  },[share.audioTrack,output.deviceId]);
  useEffect(()=>{
    const track=share.audioTrack;
    if(!track)return;
    track.setVolume(Math.min(1,Math.max(0,(volume/100)*(output.volume/100))));
  },[share.audioTrack,volume,output.volume]);

  async function resumeAudio(){
    const element=audioRef.current;
    if(!element)return;
    element.muted=false;
    await element.play();
    setPlaybackBlocked(false);
  }

  return <>
    <video ref={videoRef} autoPlay playsInline muted/>
    <audio ref={audioRef} autoPlay playsInline/>
    {playbackBlocked?<button className="stream-unlock-audio" onClick={()=>resumeAudio().catch(()=>{})}><Volume2 size={15}/>Ativar áudio da transmissão</button>:null}
  </>;
}

export default function ScreenShare({isPro=false}:{isPro?:boolean}){
  const initialEntitlement=isPro?{tier:"pro" as const,maxWidth:1920,maxHeight:1080,maxFps:60,allowed:true,reason:null}:freeEntitlement;
  const [room,setRoom]=useState<Room|null>(null);
  const [shares,setShares]=useState<Share[]>([]);
  const [panel,setPanel]=useState(false);
  const [viewerId,setViewerId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [reconnecting,setReconnecting]=useState(false);
  const [surface,setSurface]=useState<"monitor"|"window"|"browser">("browser");
  const [quality,setQuality]=useState<360|480|720|1080>(isPro?1080:720);
  const [volume,setVolume]=useState(100);
  const [error,setError]=useState("");
  const [entitlement,setEntitlement]=useState<Entitlement>(initialEntitlement);
  const [screenAudio,setScreenAudio]=useState<ScreenAudioState>(()=>({supported:supportsScreenCapture(),available:null,published:false}));

  useEffect(()=>subscribeActiveLiveKitRoom(setRoom),[]);
  useEffect(()=>{
    getServerEntitlement().catch(()=>{});
  },[]);
  useEffect(()=>{
    if(!room){setShares([]);return}
    const sync=()=>{
      const next=snapshot(room);
      setShares(next);
      const local=next.find(item=>item.local);
      setScreenAudio(current=>({...current,published:Boolean(local?.audioPublished)}));
    };
    const onReconnecting=()=>{setReconnecting(true);sync()};
    const onReconnected=()=>{setReconnecting(false);sync()};
    sync();
    room.on(RoomEvent.Connected,sync)
      .on(RoomEvent.ParticipantConnected,sync)
      .on(RoomEvent.ParticipantDisconnected,sync)
      .on(RoomEvent.TrackPublished,sync)
      .on(RoomEvent.TrackUnpublished,sync)
      .on(RoomEvent.TrackSubscribed,sync)
      .on(RoomEvent.TrackUnsubscribed,sync)
      .on(RoomEvent.LocalTrackPublished,sync)
      .on(RoomEvent.LocalTrackUnpublished,sync)
      .on(RoomEvent.Reconnecting,onReconnecting)
      .on(RoomEvent.Reconnected,onReconnected)
      .on(RoomEvent.ConnectionStateChanged,sync)
      .on(RoomEvent.Disconnected,sync);
    return()=>{
      room.off(RoomEvent.Connected,sync)
        .off(RoomEvent.ParticipantConnected,sync)
        .off(RoomEvent.ParticipantDisconnected,sync)
        .off(RoomEvent.TrackPublished,sync)
        .off(RoomEvent.TrackUnpublished,sync)
        .off(RoomEvent.TrackSubscribed,sync)
        .off(RoomEvent.TrackUnsubscribed,sync)
        .off(RoomEvent.LocalTrackPublished,sync)
        .off(RoomEvent.LocalTrackUnpublished,sync)
        .off(RoomEvent.Reconnecting,onReconnecting)
        .off(RoomEvent.Reconnected,onReconnected)
        .off(RoomEvent.ConnectionStateChanged,sync)
        .off(RoomEvent.Disconnected,sync);
    };
  },[room]);

  const localShare=shares.find(item=>item.local),remoteShares=shares.filter(item=>!item.local),viewer=shares.find(item=>item.ownerId===viewerId)??null;

  useEffect(()=>{
    const mediaTrack=localShare?.track.mediaStreamTrack;
    if(!mediaTrack||!room)return;
    const ended=()=>{void stop()};
    mediaTrack.addEventListener("ended",ended,{once:true});
    return()=>mediaTrack.removeEventListener("ended",ended);
  },[localShare?.track,room]);

  async function getServerEntitlement(){
    const response=await fetch("/api/me/capabilities",{cache:"no-store"});
    if(!response.ok)throw new Error("Não foi possível validar o plano da conta.");
    const data=await response.json() as {screenShare:Entitlement};
    setEntitlement(data.screenShare);
    return data.screenShare;
  }

  async function openPanel(){
    setError("");
    try{
      const capability=await getServerEntitlement();
      if(capability.allowed===false)throw new Error(capability.reason||"Transmissão indisponível para esta conta.");
      setPanel(true);
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível validar a transmissão.")}
  }

  async function start(){
    if(!room||room.state!==ConnectionState.Connected){setError("Entre na voz antes de compartilhar a tela.");return}
    if(!screenAudio.supported){setError("Seu navegador não oferece captura de tela neste contexto.");return}
    setBusy(true);setError("");setScreenAudio(current=>({...current,available:null,published:false}));
    let createdTracks:LocalTrack[]=[];
    try{
      const selected=qualityPresets.find(item=>item.height===quality)??qualityPresets[2];
      if(selected.height>entitlement.maxHeight){setError(`Seu plano permite transmissão até ${entitlement.maxHeight}p.`);setBusy(false);return}
      const maxFps=Math.min(selected.fps,entitlement.maxFps);
      const capturePromise=room.localParticipant.createScreenTracks({
        audio:true,
        video:{displaySurface:surface},
        resolution:{width:selected.width,height:selected.height,frameRate:maxFps},
        contentHint:"motion",
        surfaceSwitching:"include",
        systemAudio:"include",
        suppressLocalAudioPlayback:false,
      });
      const capabilityPromise=getServerEntitlement();
      const [tracks,capability]=await Promise.all([capturePromise,capabilityPromise]);
      createdTracks=tracks;
      if(capability.allowed===false)throw new Error(capability.reason||"Transmissão indisponível para esta conta.");
      const video=tracks.find(track=>track instanceof LocalVideoTrack) as LocalVideoTrack|undefined;
      const audio=tracks.find(track=>track instanceof LocalAudioTrack) as LocalAudioTrack|undefined;
      if(!video)throw new Error("O navegador não retornou uma faixa de vídeo da tela.");
      await video.mediaStreamTrack.applyConstraints({
        width:{max:Math.min(selected.width,capability.maxWidth)},
        height:{max:Math.min(selected.height,capability.maxHeight)},
        frameRate:{max:Math.min(maxFps,capability.maxFps)},
      }).catch(()=>{});
      setScreenAudio(current=>({...current,available:Boolean(audio),published:false}));
      await room.localParticipant.publishTrack(video,{
        source:Track.Source.ScreenShare,
        simulcast:true,
        videoCodec:"vp8",
        degradationPreference:"balanced",
        screenShareEncoding:{maxBitrate:selected.bitrate,maxFramerate:Math.min(maxFps,capability.maxFps)},
      });
      if(audio){
        try{
          await room.localParticipant.publishTrack(audio,{
            source:Track.Source.ScreenShareAudio,
            audioPreset:AudioPresets.musicHighQualityStereo,
            dtx:false,
            forceStereo:true,
          });
          setScreenAudio(current=>({...current,published:true}));
        }catch{
          audio.stop();
          setError("A tela está sendo transmitida, mas a faixa de áudio não pôde ser publicada.");
        }
      }
      setShares(snapshot(room));
      setPanel(false);
    }catch(cause){
      for(const track of createdTracks){
        const publication=room.localParticipant.getTrackPublication(track.source);
        if(publication?.track)await room.localParticipant.unpublishTrack(publication.track,true).catch(()=>{});
        else track.stop();
      }
      if((cause as DOMException)?.name!=="NotAllowedError")setError(cause instanceof Error?cause.message:"Não foi possível iniciar a transmissão.");
    }finally{setBusy(false)}
  }

  async function stop(){
    if(!room)return;
    setBusy(true);
    try{
      const publications=[
        room.localParticipant.getTrackPublication(Track.Source.ScreenShare),
        room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio),
      ];
      await Promise.all(publications.map(publication=>publication?.track?room.localParticipant.unpublishTrack(publication.track,true):Promise.resolve()));
      setScreenAudio(current=>({...current,available:null,published:false}));
      setViewerId(current=>current===room.localParticipant.identity?null:current);
      setShares(snapshot(room));
    }finally{setBusy(false)}
  }

  const localAudioLabel=screenAudio.published?"Compartilhando áudio":localShare?"Compartilhando apenas vídeo":screenAudio.supported?"Áudio da tela disponível":"Áudio da tela não disponível neste navegador";

  return <section className="stream-card">
    <header><div><small>LIVEKIT STREAM</small><h2>Compartilhamento de tela</h2></div>{localShare?<span className="stream-live"><Radio size={12}/>{reconnecting?"RECONECTANDO":"LIVE"}</span>:null}</header>
    {localShare?<div className="stream-active"><b>{localShare.quality}</b><span>{localAudioLabel}</span><span>{Math.max(0,(room?.numParticipants||1)-1)} participante(s) na sala</span><div><button onClick={()=>setViewerId(localShare.ownerId)}><Expand size={14}/>Abrir tela</button><button onClick={stop} disabled={busy}><Square size={13}/>Parar</button></div></div>:<button className="stream-start" onClick={openPanel} disabled={!room||reconnecting}><MonitorUp size={16}/>Compartilhar tela</button>}
    {remoteShares.length?<div className="stream-friends-live"><small>AMIGOS TRANSMITINDO</small>{remoteShares.map(share=><button className="stream-available stream-available-rich" key={share.ownerId} onClick={()=>setViewerId(share.ownerId)}><span className="stream-share-icon"><MonitorUp size={16}/><i/></span><span className="stream-share-copy"><b>{share.ownerName}</b><small><Radio size={10}/> AO VIVO · {share.quality} · {share.audioPublished?"com áudio":"só vídeo"}</small></span><strong>Assistir</strong></button>)}</div>:null}
    {error?<p className="stream-error">{error}</p>:null}
    {panel?<div className="stream-modal-bg" role="dialog" aria-modal="true" aria-labelledby="share-title"><div className="stream-modal"><button className="modal-close" onClick={()=>setPanel(false)} aria-label="Fechar"><X/></button><small>PREPARAR TRANSMISSÃO</small><h2 id="share-title">O que você quer compartilhar?</h2><p>A escolha final e a disponibilidade de áudio dependem do seletor seguro do navegador.</p><div className="source-grid">{[["browser","Aba"],["window","Janela"],["monitor","Tela inteira"]].map(([value,label])=><button type="button" className={surface===value?"selected":""} onClick={()=>setSurface(value as typeof surface)} key={value}><MonitorUp/>{label}</button>)}</div><div className="stream-capability"><Volume2 size={16}/><span>{screenAudio.supported?"Áudio da tela disponível quando a fonte e o navegador oferecerem essa opção.":"Áudio da tela não disponível neste navegador."}</span></div><div className="stream-quality-picker"><div><span>Qualidade da transmissão</span><small><Zap size={12}/> Menor resolução reduz atraso e uso de banda</small></div><div className="stream-quality-options">{qualityPresets.map(option=>{const locked=option.height>entitlement.maxHeight;return <button type="button" key={option.height} disabled={locked} className={quality===option.height?"selected":""} onClick={()=>setQuality(option.height)}><b>{option.label}</b><small>{option.fps} FPS{locked?" · PRO":""}</small></button>})}</div></div><div className="quality-row"><span>Plano {entitlement.tier.toUpperCase()}</span><b>Selecionado: {quality}p · até {Math.min(qualityPresets.find(item=>item.height===quality)?.fps??30,entitlement.maxFps)} FPS</b></div><button className="auth-primary" onClick={start} disabled={busy}>{busy?<GrindPortalLoading label="Preparando transmissão…"/>:"Abrir seletor do navegador"}</button></div></div>:null}
    {viewer?<div className="stream-viewer" role="dialog" aria-modal="true"><header><div><span>LIVE</span><b>{viewer.ownerName}</b><small>{viewer.local?"Prévia local":"Transmissão LiveKit"} · {viewer.audioPublished?"com áudio":"somente vídeo"}</small></div><button onClick={()=>setViewerId(null)} aria-label="Fechar viewer"><X/></button></header><div className="stream-stage"><StreamVideo share={viewer} volume={volume}/></div><footer><span>{viewer.quality}</span><label><Volume2 size={14}/><input aria-label="Volume da transmissão" type="range" min="0" max="100" value={volume} onChange={event=>setVolume(Number(event.target.value))}/></label><button onClick={()=>document.querySelector<HTMLDivElement>(".stream-stage")?.requestFullscreen()}><Expand size={14}/>Fullscreen</button></footer></div>:null}
  </section>;
}

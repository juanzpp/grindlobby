"use client";
import {useEffect,useRef} from "react";

type Props={stream:MediaStream|null;volume:number;muted:boolean};
const remoteContexts=new Set<AudioContext>();
let userUnlockedRemoteAudio=false;
const devLog=(event:string,details:Record<string,unknown>={})=>{if(process.env.NODE_ENV==="development")console.debug(`[GrindLobby Voice] ${event}`,details)};

export async function unlockRemoteAudioContexts(){
 userUnlockedRemoteAudio=true;
 await Promise.all([...remoteContexts].map(async audioContext=>{
  devLog("remote-audio-context-state",{state:audioContext.state});
  if(audioContext.state!=="suspended")return;
  try{await audioContext.resume();devLog("remote-audio-context-resumed",{state:audioContext.state});}
  catch(error){devLog("remote-audio-context-resume-failed",{error:String(error)});}
 }));
}

export default function RemoteVoiceAudio({stream,volume,muted}:Props){
 const audio=useRef<HTMLAudioElement|null>(null);
 const context=useRef<AudioContext|null>(null);
 const source=useRef<MediaStreamAudioSourceNode|null>(null);
 const gain=useRef<GainNode|null>(null);
 async function useDirectOutput(element:HTMLAudioElement){
  const boundedVolume=muted?0:Math.min(1,Math.max(0,volume/100));
  element.volume=boundedVolume;
  devLog("remote-audio-context-state",{state:context.current?.state??"direct-fallback",fallback:true,volume:boundedVolume});
 }
 async function resumeAndPlay(){
  const element=audio.current;
  if(!element||!stream)return;
  const tracks=stream.getAudioTracks();
  if(!tracks.length)return;
  const audioContext=context.current;
  if(audioContext?.state==="suspended"){
   try{await audioContext.resume();devLog("remote-audio-context-resumed",{state:audioContext.state});}
   catch(error){devLog("remote-audio-context-resume-failed",{error:String(error)});await useDirectOutput(element);}
  }
  if(audioContext?.state!=="running")await useDirectOutput(element);
  else element.volume=0;
  try{await element.play();devLog("remote-audio-play",{audioMuted:element.muted,audioVolume:element.volume,audioPaused:element.paused});}
  catch(error){devLog("remote-audio-play-failed",{error:String(error),audioMuted:element.muted,audioVolume:element.volume,audioPaused:element.paused});}
 }
 useEffect(()=>{
  const element=audio.current;
  if(!element)return;
    devLog("remote-audio-element-created",{hasElement:true,streamPresent:Boolean(stream)});
  element.autoplay=true;element.setAttribute("playsinline","");element.muted=false;element.volume=0;element.srcObject=stream;
    if(!stream){source.current?.disconnect();gain.current?.disconnect();context.current?.close().catch(error=>devLog("remote-audio-context-close-failed",{error:String(error)}));source.current=null;gain.current=null;context.current=null;return}
  const tracks=stream.getAudioTracks();
  if(!tracks.length){devLog("remote-track-state",{state:"missing-audio-track"});return}
  const track=tracks[0];
    devLog("remote-track-received",{trackKind:track.kind,trackId:track.id,readyState:track.readyState,muted:track.muted,enabled:track.enabled,audioTrackCount:tracks.length});
  track.onmute=()=>devLog("remote-track-state",{trackId:track.id,state:"muted"});
  track.onunmute=()=>devLog("remote-track-state",{trackId:track.id,state:"unmuted"});
  track.onended=()=>devLog("remote-track-state",{trackId:track.id,state:"ended"});
  const audioContext=new AudioContext();
  remoteContexts.add(audioContext);
  devLog("remote-audio-context-created",{state:audioContext.state});
  const mediaSource=audioContext.createMediaStreamSource(stream);
  const outputGain=audioContext.createGain();
  mediaSource.connect(outputGain);outputGain.connect(audioContext.destination);
  context.current=audioContext;source.current=mediaSource;gain.current=outputGain;
  outputGain.gain.setTargetAtTime(muted?0:Math.min(2,Math.max(0,volume/100)),audioContext.currentTime,.035);
  devLog("remote-audio-context-state",{state:audioContext.state});
  if(userUnlockedRemoteAudio)resumeAndPlay().catch(error=>devLog("remote-audio-play-failed",{error:String(error)}));else useDirectOutput(element).then(()=>resumeAndPlay()).catch(error=>devLog("remote-audio-play-failed",{error:String(error)}));
    return()=>{element.pause();element.srcObject=null;track.onmute=null;track.onunmute=null;track.onended=null;mediaSource.disconnect();outputGain.disconnect();remoteContexts.delete(audioContext);audioContext.close().catch(error=>devLog("remote-audio-context-close-failed",{error:String(error)}));context.current=null;source.current=null;gain.current=null};
 },[stream]);
 useEffect(()=>{const node=gain.current;const audioContext=context.current;if(!node||!audioContext)return;node.gain.cancelScheduledValues(audioContext.currentTime);node.gain.setTargetAtTime(muted?0:Math.min(2,Math.max(0,volume/100)),audioContext.currentTime,.035);if(audioContext.state!=="running")useDirectOutput(audio.current!);else if(audio.current)audio.current.volume=0},[volume,muted]);
 useEffect(()=>{const retry=()=>{unlockRemoteAudioContexts().finally(()=>resumeAndPlay())};window.addEventListener("pointerdown",retry);window.addEventListener("touchstart",retry);window.addEventListener("keydown",retry);return()=>{window.removeEventListener("pointerdown",retry);window.removeEventListener("touchstart",retry);window.removeEventListener("keydown",retry)}},[stream]);
 return <audio ref={audio} autoPlay playsInline muted={false} aria-hidden="true"/>;
}

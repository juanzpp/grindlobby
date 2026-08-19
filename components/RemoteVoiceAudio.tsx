"use client";
import {useEffect,useRef} from "react";

type Props={stream:MediaStream|null;volume:number;muted:boolean};
export default function RemoteVoiceAudio({stream,volume,muted}:Props){
 const audio=useRef<HTMLAudioElement|null>(null);
 const context=useRef<AudioContext|null>(null);
 const source=useRef<MediaStreamAudioSourceNode|null>(null);
 const gain=useRef<GainNode|null>(null);
 const devLog=(event:string,details:Record<string,unknown>={})=>{if(process.env.NODE_ENV==="development")console.debug(`[voice] ${event}`,details)};
 useEffect(()=>{
  const element=audio.current;
  if(!element)return;
    element.autoplay=true;element.setAttribute("playsinline","");element.muted=false;element.volume=0;element.srcObject=stream;
  if(!stream){source.current?.disconnect();gain.current?.disconnect();context.current?.close().catch(()=>{});source.current=null;gain.current=null;context.current=null;return}
  const audioContext=new AudioContext();
  const mediaSource=audioContext.createMediaStreamSource(stream);
  const outputGain=audioContext.createGain();
  mediaSource.connect(outputGain);outputGain.connect(audioContext.destination);
  context.current=audioContext;source.current=mediaSource;gain.current=outputGain;
  outputGain.gain.setTargetAtTime(muted?0:Math.min(2,Math.max(0,volume/100)),audioContext.currentTime,.035);
  audioContext.resume().catch(()=>{});
  element.play().then(()=>devLog("remote-audio-play")).catch(error=>devLog("remote-audio-play-failed",{error:String(error)}));
  return()=>{element.pause();element.srcObject=null;mediaSource.disconnect();outputGain.disconnect();audioContext.close().catch(()=>{});context.current=null;source.current=null;gain.current=null};
 },[stream]);
 useEffect(()=>{const node=gain.current;const audioContext=context.current;if(!node||!audioContext)return;node.gain.cancelScheduledValues(audioContext.currentTime);node.gain.setTargetAtTime(muted?0:Math.min(2,Math.max(0,volume/100)),audioContext.currentTime,.035)},[volume,muted]);
 useEffect(()=>{const retry=()=>{const element=audio.current;if(!element||!stream)return;element.play().then(()=>devLog("remote-audio-play")).catch(error=>devLog("remote-audio-play-failed",{error:String(error),retry:true}))};window.addEventListener("pointerdown",retry,{once:true});return()=>window.removeEventListener("pointerdown",retry)},[stream]);
 return <audio ref={audio} autoPlay playsInline muted={false} aria-hidden="true"/>;
}

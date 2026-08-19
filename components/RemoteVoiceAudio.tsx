"use client";
import {useEffect,useRef} from "react";

type Props={stream:MediaStream|null;volume:number;muted:boolean};
export default function RemoteVoiceAudio({stream,volume,muted}:Props){
 const audio=useRef<HTMLAudioElement|null>(null);
 useEffect(()=>{
  const element=audio.current;
  if(!element)return;
  element.srcObject=stream;
  if(stream)element.play().catch(()=>{});
  return()=>{element.pause();element.srcObject=null};
 },[stream]);
 useEffect(()=>{if(audio.current)audio.current.volume=muted?0:Math.min(2,Math.max(0,volume/100))},[volume,muted]);
 return <audio ref={audio} autoPlay aria-hidden="true"/>;
}

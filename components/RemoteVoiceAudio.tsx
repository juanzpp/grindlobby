"use client";
import {useEffect,useRef,useState} from "react";
import type {RemoteAudioTrack} from "livekit-client";
import {AudioOutputPreferences,loadAudioOutputPreferences,subscribeAudioOutput} from "@/lib/audio-output";
import {getRemoteVoicePeerId} from "@/lib/webrtc/useLobbyVoice";

type Props={stream:RemoteAudioTrack|null;volume:number;muted:boolean};
const voiceDebug=process.env.NODE_ENV==="development"||process.env.NEXT_PUBLIC_VOICE_DEBUG==="true";
const log=(event:string,details:Record<string,unknown>={})=>{if(voiceDebug)console.debug(`[GrindLobby Voice] ${event}`,details)};
const blockedRemoteAudio=new Set<HTMLAudioElement>();

export async function unlockRemoteAudioContexts(){
 const elements=[...blockedRemoteAudio];
 await Promise.all(elements.map(async element=>{try{await element.play();blockedRemoteAudio.delete(element)}catch{}}));
}

export default function RemoteVoiceAudio({stream:track,volume,muted}:Props){
 const audio=useRef<HTMLAudioElement|null>(null),[output,setOutput]=useState<AudioOutputPreferences>(loadAudioOutputPreferences),peerId=getRemoteVoicePeerId(track)??"unknown";
 useEffect(()=>{const unsubscribe=subscribeAudioOutput(setOutput);return()=>{unsubscribe()}},[]);
 useEffect(()=>{
  const element=audio.current;if(!element||!track)return;
  let disposed=false;
  const retry=()=>{if(disposed||element.muted)return;void element.play().then(()=>{blockedRemoteAudio.delete(element);window.removeEventListener("pointerdown",retry,true);window.removeEventListener("touchend",retry,true)}).catch(()=>{})};
  track.attach(element);element.autoplay=true;element.muted=muted;track.setVolume(Math.min(1,Math.max(0,(volume/100)*(output.volume/100))));
  if(output.deviceId)track.setSinkId(output.deviceId).catch(error=>log("remote-audio-output-device-failed",{peerId,error:String(error)}));
  element.play().then(()=>log("remote-audio-play",{peerId})).catch(error=>{log("remote-audio-play-failed",{peerId,error:String(error)});blockedRemoteAudio.add(element);window.addEventListener("pointerdown",retry,true);window.addEventListener("touchend",retry,true)});
  return()=>{disposed=true;blockedRemoteAudio.delete(element);window.removeEventListener("pointerdown",retry,true);window.removeEventListener("touchend",retry,true);track.detach(element)};
 },[track]);
 useEffect(()=>{if(!track)return;const element=audio.current;if(element){element.muted=muted;if(!muted&&blockedRemoteAudio.has(element))void unlockRemoteAudioContexts()}track.setVolume(Math.min(1,Math.max(0,(volume/100)*(output.volume/100))));if(output.deviceId)track.setSinkId(output.deviceId).catch(error=>log("remote-audio-output-device-failed",{peerId,error:String(error)}))},[track,volume,muted,output]);
 return <audio ref={audio} autoPlay playsInline aria-hidden="true" data-grind-remote-voice="true"/>;
}

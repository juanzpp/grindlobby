"use client";
import {useEffect,useRef,useState} from "react";
import type {RemoteAudioTrack} from "livekit-client";
import {AudioOutputPreferences,loadAudioOutputPreferences,subscribeAudioOutput} from "@/lib/audio-output";
import {getRemoteVoicePeerId} from "@/lib/webrtc/useLobbyVoice";

type Props={stream:RemoteAudioTrack|null;volume:number;muted:boolean};
const voiceDebug=process.env.NODE_ENV==="development"||process.env.NEXT_PUBLIC_VOICE_DEBUG==="true";
const log=(event:string,details:Record<string,unknown>={})=>{if(voiceDebug)console.debug(`[GrindLobby Voice] ${event}`,details)};
export async function unlockRemoteAudioContexts(){return Promise.resolve()}

export default function RemoteVoiceAudio({stream:track,volume,muted}:Props){
 const audio=useRef<HTMLAudioElement|null>(null),[output,setOutput]=useState<AudioOutputPreferences>(loadAudioOutputPreferences),peerId=getRemoteVoicePeerId(track)??"unknown";
 useEffect(()=>{const unsubscribe=subscribeAudioOutput(setOutput);return()=>{unsubscribe()}},[]);
 useEffect(()=>{
  const element=audio.current;if(!element||!track)return;
  track.attach(element);element.autoplay=true;element.muted=muted;track.setVolume(Math.min(1,Math.max(0,(volume/100)*(output.volume/100))));
  if(output.deviceId)track.setSinkId(output.deviceId).catch(error=>log("remote-audio-output-device-failed",{peerId,error:String(error)}));
  element.play().then(()=>log("remote-audio-play",{peerId})).catch(error=>log("remote-audio-play-failed",{peerId,error:String(error)}));
  return()=>{track.detach(element)};
 },[track]);
 useEffect(()=>{if(!track)return;const element=audio.current;if(element)element.muted=muted;track.setVolume(Math.min(1,Math.max(0,(volume/100)*(output.volume/100))));if(output.deviceId)track.setSinkId(output.deviceId).catch(error=>log("remote-audio-output-device-failed",{peerId,error:String(error)}))},[track,volume,muted,output]);
 return <audio ref={audio} autoPlay playsInline aria-hidden="true"/>;
}

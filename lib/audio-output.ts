"use client";

import {MAX_OUTPUT_VOLUME_PERCENT,clampMediaPercent} from "@/lib/webrtc/mediaPolicy";

export type AudioOutputPreferences = {deviceId:string;volume:number};
export const defaultAudioOutputPreferences:AudioOutputPreferences={deviceId:"",volume:100};
const storageKey="grindlobby.audio-output";
const listeners=new Set<(preferences:AudioOutputPreferences)=>void>();

export function loadAudioOutputPreferences():AudioOutputPreferences{
 if(typeof window==="undefined")return defaultAudioOutputPreferences;
 try{
  const stored=JSON.parse(localStorage.getItem(storageKey)||"null") as Partial<AudioOutputPreferences>|null;
  return {deviceId:typeof stored?.deviceId==="string"?stored.deviceId:"",volume:clampMediaPercent(Number(stored?.volume??100),MAX_OUTPUT_VOLUME_PERCENT)};
 }catch{return defaultAudioOutputPreferences;}
}
export function saveAudioOutputPreferences(preferences:AudioOutputPreferences){
 const normalized={deviceId:preferences.deviceId,volume:clampMediaPercent(preferences.volume,MAX_OUTPUT_VOLUME_PERCENT)};
 if(typeof window!=="undefined")localStorage.setItem(storageKey,JSON.stringify(normalized));
 listeners.forEach(listener=>listener(normalized));
}
export function subscribeAudioOutput(listener:(preferences:AudioOutputPreferences)=>void){
 listeners.add(listener);return()=>{listeners.delete(listener)};
}

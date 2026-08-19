"use client";

export type AudioOutputPreferences = {deviceId:string;volume:number};
export const defaultAudioOutputPreferences:AudioOutputPreferences={deviceId:"",volume:100};
const storageKey="grindlobby.audio-output";
const listeners=new Set<(preferences:AudioOutputPreferences)=>void>();

export function loadAudioOutputPreferences():AudioOutputPreferences{
 if(typeof window==="undefined")return defaultAudioOutputPreferences;
 try{
  const stored=JSON.parse(localStorage.getItem(storageKey)||"null") as Partial<AudioOutputPreferences>|null;
  return {deviceId:typeof stored?.deviceId==="string"?stored.deviceId:"",volume:Math.min(200,Math.max(0,Number(stored?.volume??100)))};
 }catch{return defaultAudioOutputPreferences;}
}
export function saveAudioOutputPreferences(preferences:AudioOutputPreferences){
 if(typeof window!=="undefined")localStorage.setItem(storageKey,JSON.stringify(preferences));
 listeners.forEach(listener=>listener(preferences));
}
export function subscribeAudioOutput(listener:(preferences:AudioOutputPreferences)=>void){
 listeners.add(listener);return()=>{listeners.delete(listener)};
}

"use client";
import {useState} from "react";
import {Radio,Volume2} from "lucide-react";
import {AudioMode,AudioPreferences,AudioVoice,loadAudioPreferences,saveAudioPreferences} from "@/lib/audio";

export default function AudioSettings(){
 const [preferences,setPreferences]=useState<AudioPreferences>(loadAudioPreferences);
 function update(next:Partial<AudioPreferences>){
  setPreferences(current=>{
   const updated={...current,...next};
   saveAudioPreferences(updated);
   return updated;
  });
 }
 return <section>
  <div><p className="lovable-label">General settings</p><h1 className="mt-1 font-display text-3xl font-bold">Sons e avisos</h1><p className="mt-1 text-sm text-muted-foreground">Controle como o GrindLobby sinaliza eventos da sala.</p></div>
  <div className="mt-6 grid gap-4 lg:grid-cols-2">
   <section className="rounded-xl border border-border bg-panel/50 p-5">
    <div className="flex items-center gap-3 text-primary-glow"><Radio size={18}/><div><b className="block text-sm text-foreground">Reprodução</b><span className="text-xs text-muted-foreground">Escolha quais avisos ouvir</span></div></div>
    <div className="mt-5 grid gap-2">
     <button className={`flex items-center justify-between rounded-lg border px-3 py-3 text-sm ${preferences.soundsEnabled?"border-primary/40 bg-primary/15 text-foreground":"border-border bg-secondary text-muted-foreground"}`} onClick={()=>update({soundsEnabled:!preferences.soundsEnabled})}>Sons de interface <span>{preferences.soundsEnabled?"ON":"OFF"}</span></button>
     <button className={`flex items-center justify-between rounded-lg border px-3 py-3 text-sm ${preferences.voiceEnabled?"border-primary/40 bg-primary/15 text-foreground":"border-border bg-secondary text-muted-foreground"}`} onClick={()=>update({voiceEnabled:!preferences.voiceEnabled})}>Avisos por voz <span>{preferences.voiceEnabled?"ON":"OFF"}</span></button>
    </div>
    <label className="mt-4 block text-xs text-muted-foreground">Voz<select className="lovable-select mt-2 w-full" value={preferences.voice} onChange={event=>update({voice:event.target.value as AudioVoice})}><option value="laura">Laura</option><option value="adam">Adam</option></select></label>
    <label className="mt-4 block text-xs text-muted-foreground">Modo<select className="lovable-select mt-2 w-full" value={preferences.mode} onChange={event=>update({mode:event.target.value as AudioMode})}><option value="sound">Som</option><option value="voice">Voz</option><option value="both">Ambos</option><option value="disabled">Desativado</option></select></label>
   </section>
   <section className="rounded-xl border border-border bg-panel/50 p-5">
    <div className="flex items-center gap-3 text-primary-glow"><Volume2 size={18}/><div><b className="block text-sm text-foreground">Volume</b><span className="text-xs text-muted-foreground">Equilibre efeitos e avisos</span></div></div>
    <label className="mt-6 block text-sm text-muted-foreground">Volume dos efeitos <b className="float-right text-primary-glow">{Math.round(preferences.soundsVolume*100)}%</b><input className="mt-3 w-full accent-violet-500" type="range" min="0" max="100" value={Math.round(preferences.soundsVolume*100)} onChange={event=>update({soundsVolume:Number(event.target.value)/100})}/></label>
    <label className="mt-7 block text-sm text-muted-foreground">Volume dos avisos por voz <b className="float-right text-primary-glow">{Math.round(preferences.voiceVolume*100)}%</b><input className="mt-3 w-full accent-violet-500" type="range" min="0" max="100" value={Math.round(preferences.voiceVolume*100)} onChange={event=>update({voiceVolume:Number(event.target.value)/100})}/></label>
   </section>
  </div>
 </section>;
}

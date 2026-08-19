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
 return <section className="dashboard-view settings-view">
  <div className="section-head settings-heading">
   <div><small>GENERAL SETTINGS</small><h2>Sons e avisos</h2><p>Controle como o GrindLobby sinaliza eventos da sala.</p></div>
  </div>
  <div className="settings-grid">
   <section className="settings-panel">
    <div className="settings-panel-title"><Radio size={17}/><div><b>Reprodução</b><span>Escolha quais avisos ouvir</span></div></div>
    <div className="voice-toggles settings-toggles">
    <button className={preferences.soundsEnabled?"on":""} onClick={()=>update({soundsEnabled:!preferences.soundsEnabled})}>Sons de interface <span>{preferences.soundsEnabled?"ON":"OFF"}</span></button>
    <button className={preferences.voiceEnabled?"on":""} onClick={()=>update({voiceEnabled:!preferences.voiceEnabled})}>Avisos por voz <span>{preferences.voiceEnabled?"ON":"OFF"}</span></button>
    </div>
    <label className="settings-label">Voz<select value={preferences.voice} onChange={e=>update({voice:e.target.value as AudioVoice})}><option value="laura">Laura</option><option value="adam">Adam</option></select></label>
    <label className="settings-label">Modo<select value={preferences.mode} onChange={e=>update({mode:e.target.value as AudioMode})}><option value="sound">Som</option><option value="voice">Voz</option><option value="both">Ambos</option><option value="disabled">Desativado</option></select></label>
   </section>
   <section className="settings-panel">
    <div className="settings-panel-title"><Volume2 size={17}/><div><b>Volume</b><span>Equilibre efeitos e avisos</span></div></div>
    <label className="settings-label">Volume dos efeitos <b>{Math.round(preferences.soundsVolume*100)}%</b><input type="range" min="0" max="100" value={Math.round(preferences.soundsVolume*100)} onChange={e=>update({soundsVolume:+e.target.value/100})}/></label>
    <label className="settings-label">Volume dos avisos por voz <b>{Math.round(preferences.voiceVolume*100)}%</b><input type="range" min="0" max="100" value={Math.round(preferences.voiceVolume*100)} onChange={e=>update({voiceVolume:+e.target.value/100})}/></label>
   </section>
  </div>
 </section>;
}

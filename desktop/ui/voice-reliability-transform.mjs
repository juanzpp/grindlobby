export function voiceReliabilityTransformPlugin(){
  return {
    name:'grindlobby-desktop-voice-reliability',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('main.jsx'))return null;
      let fixed=code;
      fixed=fixed.replace(
        'const{token,url}=tokenResponse.data;',
        'const{token,url,screenShare}=tokenResponse.data;'
      );
      fixed=fixed.replace(
        'setCall({lobby,connected:true,participants:[...room.remoteParticipants.values()].map(p=>({id:p.identity,name:p.name||p.identity}))});',
        'setCall({lobby,connected:true,screenShare,participants:[...room.remoteParticipants.values()].map(p=>({id:p.identity,name:p.name||p.identity}))});'
      );
      fixed=fixed.replace(
        'room.on(RoomEvent.TrackSubscribed,track=>{if(track.kind===Track.Kind.Audio){const element=track.attach();element.autoplay=true;element.volume=(readJson(LS.settings,{volume:78}).volume??78)/100;document.getElementById("remote-audio-host")?.appendChild(element)}refresh()});room.on(RoomEvent.Disconnected,()=>setCall(prev=>prev?{...prev,connected:false}:prev));',
        'room.on(RoomEvent.TrackSubscribed,track=>{if(track.kind===Track.Kind.Audio){const element=track.attach();element.autoplay=true;element.volume=(readJson(LS.settings,{volume:78}).volume??78)/100;document.getElementById("remote-audio-host")?.appendChild(element)}refresh()});room.on(RoomEvent.TrackUnsubscribed,track=>{track.detach().forEach(element=>element.remove());refresh()});room.on(RoomEvent.Reconnecting,()=>setCall(prev=>prev?{...prev,connected:false}:prev));room.on(RoomEvent.Reconnected,refresh);room.on(RoomEvent.LocalTrackUnpublished,publication=>{if(publication.source===Track.Source.ScreenShare)setSharing(false);if(publication.source===Track.Source.Camera)setCamera(false)});room.on(RoomEvent.Disconnected,()=>{document.getElementById("remote-audio-host")?.replaceChildren();setCall(prev=>prev?{...prev,connected:false}:prev);window.setTimeout(()=>{if(roomRef.current===room){roomRef.current=null;void connectVoice(lobby).catch(error=>notify(error?.message||"Não foi possível reconectar a call.","error"))}},1500)});'
      );
      fixed=fixed.replace(
        'const toggleShare=async()=>{const room=roomRef.current;if(!room)return notify("Nenhuma call ativa.","error");const next=!sharing;try{await room.localParticipant.setScreenShareEnabled(next,{audio:true});setSharing(next);notify(next?"Transmissão iniciada.":"Transmissão encerrada.")}catch(error){notify(error?.message||"Não foi possível compartilhar a tela.","error")}};',
        'const toggleShare=async()=>{const room=roomRef.current;if(!room)return notify("Nenhuma call ativa.","error");const next=!sharing;const policy=call?.screenShare;const capture={audio:true,...(policy?{resolution:{width:policy.maxWidth,height:policy.maxHeight,frameRate:policy.maxFps}}:{})};try{await room.localParticipant.setScreenShareEnabled(next,capture);setSharing(next);notify(next?`Transmissão iniciada (${policy?.tier==="pro"?"1080p60":"720p30"}).`:"Transmissão encerrada.")}catch(error){if(next){try{await room.localParticipant.setScreenShareEnabled(true,{...capture,audio:false});setSharing(true);notify("Transmissão iniciada sem áudio do sistema.");return}catch{}}notify(error?.message||"Não foi possível compartilhar a tela.","error")}};'
      );
      fixed=fixed.replace(
        'const leaveCall=async()=>{const lobby=call?.lobby;roomRef.current?.disconnect();roomRef.current=null;setCall(null);',
        'const leaveCall=async()=>{const lobby=call?.lobby;roomRef.current?.disconnect();roomRef.current=null;document.getElementById("remote-audio-host")?.replaceChildren();setCall(null);'
      );
      return fixed===code?null:{code:fixed,map:null};
    }
  };
}

export function lobbyMusicAudioTransformPlugin(){
  return {
    name:"grindlobby-desktop-lobby-music-audio",
    enforce:"post",
    transform(code,id){
      if(!id.endsWith("main.jsx"))return null;
      let fixed=code;

      fixed=fixed.replace(
        'function errorText(response,fallback){return response?.data?.error||fallback}',
        'function errorText(response,fallback){return response?.data?.error||fallback}\nfunction getAudioSettings(){return readJson(LS.settings,{volume:78,musicVolume:55,noise:true,echo:true,agc:true})}\nfunction isLobbyMusicTrack(participant,publication){const identity=participant?.identity||"",name=publication?.trackName||publication?.name||"";return identity.startsWith("grind-music-bot:")||identity==="grind-music-bot"||name==="grind-music"||name.startsWith("grind-music:")}\nfunction applyLobbyMusicVolume(value){const next=Math.max(0,Math.min(100,Number(value)||0));document.querySelectorAll("#remote-audio-host audio[data-grind-music-bot=\\"1\\"]").forEach(el=>{el.volume=next/100;el.muted=next===0});const settings={...getAudioSettings(),musicVolume:next};localStorage.setItem(LS.settings,JSON.stringify(settings));return next}'
      );

      fixed=fixed.replace(
        'room.on(RoomEvent.TrackSubscribed,track=>{if(track.kind===Track.Kind.Audio){const element=track.attach();element.autoplay=true;element.volume=(readJson(LS.settings,{volume:78}).volume??78)/100;document.getElementById("remote-audio-host")?.appendChild(element)}refresh()});',
        'room.on(RoomEvent.TrackSubscribed,(track,publication,participant)=>{if(track.kind===Track.Kind.Audio){const element=track.attach();element.autoplay=true;const music=isLobbyMusicTrack(participant,publication);const settings=getAudioSettings();element.dataset.grindMusicBot=music?"1":"0";element.dataset.grindParticipant=participant?.identity||"";element.volume=((music?settings.musicVolume:settings.volume)??(music?55:78))/100;element.muted=music&&((settings.musicVolume??55)===0);document.getElementById("remote-audio-host")?.appendChild(element)}refresh()});'
      );

      fixed=fixed.replace(
        'const[query,setQuery]=useState(""),[source,setSource]=useState("all"),[results,setResults]=useState([]),[queue,setQueue]=useState([]),[current,setCurrent]=useState(null),[loading,setLoading]=useState(false),[playing,setPlaying]=useState(false),[volume,setVolume]=useState(72),[configured,setConfigured]=useState({youtube:false,spotify:false});',
        'const[query,setQuery]=useState(""),[source,setSource]=useState("all"),[results,setResults]=useState([]),[queue,setQueue]=useState([]),[current,setCurrent]=useState(null),[loading,setLoading]=useState(false),[playing,setPlaying]=useState(false),[volume,setVolume]=useState(()=>getAudioSettings().musicVolume??55),[configured,setConfigured]=useState({youtube:false,spotify:false});'
      );

      fixed=fixed.replace(
        '<input type="range" min="0" max="100" value={volume} onChange={e=>setVolume(Number(e.target.value))}/><span>{volume}%</span>',
        '<input type="range" min="0" max="100" value={volume} onChange={e=>{const next=applyLobbyMusicVolume(e.target.value);setVolume(next);sendPlayer("setVolume",[next])}}/><span>{volume}%</span>'
      );

      fixed=fixed.replace(
        '<p>A reprodução desta versão ocorre no seu cliente. A transmissão sincronizada para todos da call será ligada a um publicador de mídia server-side, sem depender do áudio do seu PC.</p>',
        '<p>Quando o bot estiver no lobby, a música chega em uma faixa separada da voz. Este volume é só seu: 0% silencia a música sem mutar jogadores e sem pausar a faixa para o restante da sala.</p>'
      );

      fixed=fixed.replace(
        'const update=(key,value)=>{const next={...settings,[key]:value};setSettings(next);localStorage.setItem(LS.settings,JSON.stringify(next));if(key==="volume")document.querySelectorAll("#remote-audio-host audio").forEach(el=>el.volume=value/100);notify("Configuração salva.")};',
        'const update=(key,value)=>{const next={...settings,[key]:value};setSettings(next);localStorage.setItem(LS.settings,JSON.stringify(next));if(key==="volume")document.querySelectorAll("#remote-audio-host audio[data-grind-music-bot=\\"0\\"]").forEach(el=>el.volume=value/100);if(key==="musicVolume")applyLobbyMusicVolume(value);notify("Configuração salva.")};'
      );

      fixed=fixed.replace(
        '<Setting label="Volume remoto"><input type="range" value={settings.volume} onChange={e=>update("volume",Number(e.target.value))}/></Setting>',
        '<Setting label="Volume das vozes"><input type="range" value={settings.volume} onChange={e=>update("volume",Number(e.target.value))}/></Setting><Setting label="Volume do bot de música"><input type="range" min="0" max="100" value={settings.musicVolume??55} onChange={e=>update("musicVolume",Number(e.target.value))}/></Setting>'
      );

      return fixed===code?null:{code:fixed,map:null};
    }
  };
}

function replaceBetween(code,startToken,endToken,replacement){
  const start=code.indexOf(startToken);
  if(start<0)return code;
  const end=code.indexOf(endToken,start);
  if(end<0)return code;
  return code.slice(0,start)+replacement+"\n"+code.slice(end);
}

function keepLastSingleLineFunction(code,name){
  const marker=`function ${name}(`;
  let fixed=code;
  while(true){
    const first=fixed.indexOf(marker);
    if(first<0)break;
    const second=fixed.indexOf(marker,first+marker.length);
    if(second<0)break;
    const lineStart=fixed.lastIndexOf("\n",first)+1;
    const lineEnd=fixed.indexOf("\n",first);
    if(lineEnd<0)break;
    fixed=fixed.slice(0,lineStart)+fixed.slice(lineEnd+1);
  }
  return fixed;
}

export function referenceFinalSafetyTransformPlugin(){
  return {
    name:"grindlobby-reference-final-safety",
    transform(code,id){
      if(!id.endsWith("main.jsx"))return null;
      let fixed=code;

      fixed=fixed.replaceAll("<Lock/>","<CircleHelp/>");
      fixed=fixed.replaceAll('["history","Histórico",Activity]','["history","Histórico",CalendarDays]');
      fixed=fixed.replaceAll('["Otimização",Activity]','["Otimização",RefreshCw]');

      fixed=fixed.replaceAll('<CommunityView data={dashboard} notify={notify}/>','<CommunityView data={dashboard} notify={notify} onJoin={joinLobby}/>');
      fixed=fixed.replaceAll('<TournamentsView/>','<TournamentsView data={dashboard}/>');
      fixed=fixed.replaceAll('<EventsView/>','<EventsView data={dashboard}/>');
      fixed=fixed.replaceAll('<EventsView notify={notify}/>','<EventsView data={dashboard}/>');

      // Music is a dedicated desktop surface. Older compositions added the
      // navigation item but failed to add its render branch when Friends and
      // Messages were also present. Guarantee that clicking Música never opens
      // an empty content area.
      if(fixed.includes('function MusicView(')&&!fixed.includes('view==="music"&&<MusicView')){
        const eventBranch='{view==="events"&&<EventsView data={dashboard}/>}'
        if(fixed.includes(eventBranch))fixed=fixed.replace(eventBranch,'{view==="music"&&<MusicView notify={notify}/>} '+eventBranch)
      }

      // The approved store has distinct Destaques and Molduras tabs. Both used
      // the same internal "frames" id before, which could highlight two tabs at
      // once. Destaques now aliases the frames catalog without sharing tab state.
      fixed=fixed.replace('useState("frames"),[busy,setBusy]=useState("")','useState("featured"),[busy,setBusy]=useState("")');
      fixed=fixed.replace('const tabs=[["frames","Destaques"],["banners","Banners"],["badges","Avatares"],["frames","Molduras"],["cardStyles","Fundos"],["effects","Efeitos"]],items=catalog?.catalog?.[tab]||[]',
        'const tabs=[["featured","Destaques"],["banners","Banners"],["badges","Avatares"],["frames","Molduras"],["cardStyles","Fundos"],["effects","Efeitos"]],items=catalog?.catalog?.[tab==="featured"?"frames":tab]||[]');
      fixed=fixed.replace('className={(tab===id&&i===0)||tab===id&&label!=="Destaques"?"active":""}','className={tab===id?"active":""}');

      if(fixed.includes('function EventsView()')&&fixed.includes('const STORE_ITEMS=')){
        const events=`function EventsView({data}){const rows=data?.events||[];return <div className="ref-page ref-events"><header className="ref-social-head"><h1>Eventos</h1></header><nav className="ref-tabs"><button className="active">Todos</button><button>Meus eventos</button><button>Inscrições</button></nav><section className="ref-event-list">{rows.length?rows.slice(0,10).map((e,i)=><article key={e.id||i}><span className={'ref-event-art tone-'+i}>{e.image?<img src={e.image} alt=""/>:<CalendarDays/>}</span><div><b>{e.title||e.name}</b><small>{e.description||e.type||"Evento GrindLobby"}</small></div><time>{e.startsAt?new Date(e.startsAt).toLocaleString("pt-BR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"A definir"}</time><button className={i?"primary":""}>{i?"Participar":"Ver detalhes"}</button></article>):<div className="ref-event-empty"><CalendarDays/><h2>Nenhum evento publicado</h2><p>Eventos reais aparecerão aqui assim que forem publicados.</p></div>}</section></div>}`;
        fixed=replaceBetween(fixed,'function EventsView()','const STORE_ITEMS=',events);
      }

      for(const name of ["formatNativeBytes","SettingRow","RefToggle"]){
        fixed=keepLastSingleLineFunction(fixed,name);
      }

      return fixed===code?null:{code:fixed,map:null};
    }
  };
}

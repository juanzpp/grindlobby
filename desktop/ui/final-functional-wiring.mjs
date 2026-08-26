export function finalFunctionalWiringPlugin(){
  return {
    name:"grindlobby-final-functional-wiring",
    enforce:"post",
    transform(code,id){
      if(!id.endsWith("main.jsx"))return null;
      let fixed=code;
      if(fixed.includes("function MusicView(")&&!fixed.includes('view==="music"&&<MusicView')){
        fixed=fixed.replace(
          '{view==="lobbies"&&<LobbiesView data={dashboard} onJoin={joinLobby} onCreate={()=>setCreateOpen(true)}/>} ',
          '{view==="lobbies"&&<LobbiesView data={dashboard} onJoin={joinLobby} onCreate={()=>setCreateOpen(true)}/>} {view==="music"&&<MusicView notify={notify}/>} '
        );
      }
      const tournamentStart=fixed.indexOf('function TournamentsView(');
      const eventsStart=fixed.indexOf('function EventsView(',tournamentStart);
      if(tournamentStart!==-1&&eventsStart>tournamentStart){
        const replacement=`function TournamentsView(){return <Page className="final-tournaments" title="Torneios" subtitle="Competições só aparecem quando existem dados persistidos no backend."><section className="final-tournament-empty"><Trophy/><span className="eyebrow">COMPETITIVO</span><h2>Nenhum torneio publicado agora</h2><p>O GrindLobby não preenche esta área com campeonatos fictícios. Quando um torneio real for publicado, inscrição, datas, equipes e chaves aparecerão aqui.</p></section></Page>}\n`;
        fixed=fixed.slice(0,tournamentStart)+replacement+fixed.slice(eventsStart);
      }
      return fixed===code?null:{code:fixed,map:null};
    }
  };
}

export function fixDesktopDeadTabs(code) {
  let fixed = code;

  // Only expose top-level modules that have a real server-backed flow in the
  // native client. Unsupported friendship/DM/tournament placeholders remain
  // out of the navigation until their APIs exist.
  fixed = fixed.replace(
    'const nav=[["home","Início",Home],["lobbies","Lobbies",Gamepad2],["community","Community",Users],["friends","Amigos",UserRound],["messages","Mensagens",MessageCircle],["tournaments","Torneios",Trophy],["events","Eventos",CalendarDays],["store","Loja",Store],["settings","Configurações",Settings]];',
    'const nav=[["home","Início",Home],["lobbies","Lobbies",Gamepad2],["community","Community",Users],["events","Eventos",CalendarDays],["store","Loja",Store],["settings","Configurações",Settings]];'
  );

  fixed = fixed.replace(
    '{view==="community"&&<CommunityView data={dashboard} notify={notify}/>} ',
    '{view==="community"&&<CommunityView data={dashboard} notify={notify} onJoin={joinLobby}/>} '
  );

  fixed = fixed.replace(
    '{view==="events"&&<EventsView/>}',
    '{view==="events"&&<EventsView notify={notify}/>}'
  );

  // Dashboard shortcuts must never route into hidden/unsupported modules.
  fixed = fixed.replace(
    '<OnlineFriends online={online} onView={()=>onView("friends")}/>',
    '<OnlineFriends online={online} onView={()=>onView("community")}/>'
  );
  fixed = fixed.replace(
    '<button onClick={()=>onView("tournaments")}>Ver módulo <ChevronRight/></button>',
    '<button onClick={()=>onView("events")}>Ver eventos <ChevronRight/></button>'
  );
  fixed = fixed.replace(
    '<small>TORNEIOS</small><h3>Módulo em preparação</h3><p>O cliente não registra inscrições falsas enquanto o backend competitivo não estiver disponível.</p>',
    '<small>COMMUNITY</small><h3>Eventos do GrindLobby</h3><p>Acompanhe eventos reais das Communities em que você participa.</p>'
  );

  const communityStart = fixed.indexOf('function CommunityView(');
  const friendsStart = fixed.indexOf('function FriendsView(');
  if (communityStart !== -1 && friendsStart !== -1 && friendsStart > communityStart) {
    const communityImpl = `function CommunityView({data,notify,onJoin}){const[communities,setCommunities]=useState([]),[loading,setLoading]=useState(true),[tab,setTab]=useState("overview"),[selected,setSelected]=useState(null),[detail,setDetail]=useState(null),[detailLoading,setDetailLoading]=useState(false);useEffect(()=>{let live=true;(async()=>{const r=await API("GET","/api/communities");if(!live)return;if(r?.ok){const list=r.data.communities||[];setCommunities(list);setSelected(list[0]||null)}else notify(errorText(r,"Não foi possível carregar Communities."),"error");setLoading(false)})();return()=>{live=false}},[notify]);useEffect(()=>{let live=true;if(!selected?.id){setDetail(null);return()=>{live=false}}setDetailLoading(true);(async()=>{const r=await API("GET",\`/api/communities/\${selected.id}\`);if(!live)return;if(r?.ok)setDetail(r.data);else{setDetail(null);notify(errorText(r,"Não foi possível carregar a Community."),"error")}setDetailLoading(false)})();return()=>{live=false}},[selected?.id,notify]);const community=detail?.community||selected;const members=detail?.members||[],events=detail?.events||[],posts=detail?.posts||[],environments=detail?.environments||[];const invite=async()=>{if(!community)return notify("Você ainda não participa de uma Community.","error");const r=await API("POST",\`/api/communities/\${community.id}/invite\`,{expiresInHours:24,maxUses:25});if(!r?.ok)return notify(errorText(r,"Não foi possível criar o convite."),"error");const url=\`https://grindlobby.onrender.com\${r.data.url}\`;try{await navigator.clipboard.writeText(url);notify("Link de convite copiado.")}catch{window.prompt("Copie o link de convite",url)}};const openEnvironment=async env=>{if(!env?.lobby_id)return notify("Este ambiente não tem uma sala ativa agora.","error");const lobby=(data?.lobbies||[]).find(x=>String(x.id)===String(env.lobby_id));if(!lobby)return notify("A sala deste ambiente não está disponível nesta sessão.","error");await onJoin(lobby)};return <Page className="community-page" title="Community" subtitle="Comunidades privadas, salas e eventos com dados reais do backend.">{loading?<div className="info-card">Carregando Communities...</div>:<><div className="community-hero"><div className="community-symbol">G</div><div><span className="eyebrow">{community?"SUA COMMUNITY":"COMMUNITY"}</span><h2>{community?.name||"Nenhuma Community"} {community&&<Check/>}</h2><p>{community?.description||"Entre em uma Community para acessar os módulos privados."}</p><small><i/> {detail?.stats?.members??community?.memberCount??0} membros</small></div><button className="primary" disabled={!community||!['owner','admin','moderator'].includes(community?.role)} onClick={invite}><UserPlus/> Convidar</button><button disabled={!communities.length} onClick={()=>{if(communities.length<2)return notify("Você só participa desta Community.");const i=communities.findIndex(x=>x.id===community?.id);setSelected(communities[(i+1)%communities.length])}}><MoreHorizontal/></button></div><div className="community-tabs">{[["overview","Visão geral"],["channels","Salas"],["events","Eventos"],["members","Membros"]].map(([id,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}</div>{detailLoading?<div className="info-card">Atualizando Community...</div>:<div className="community-grid"><section className="channels">{tab==="overview"?<>{posts.length?<div className="event-list large">{posts.map(post=><article key={post.id}><span className="datebox">{new Date(post.created_at).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}</span><div><b>{post.title||"Atualização"}</b><small>{post.body||post.type||"Community"}</small></div></article>)}</div>:<section className="info-card"><h3>Nenhuma publicação recente</h3><p>As atualizações reais da Community aparecerão aqui.</p></section>}</>:tab==="channels"?<>{environments.length?<div className="event-list large">{environments.map(env=><article key={env.id}><Headphones/><div><b>{env.name}</b><small>{env.description||env.type||"Sala da Community"}</small></div><button disabled={!env.lobby_id} onClick={()=>openEnvironment(env)}>{env.lobby_id?"Entrar":"Offline"}</button></article>)}</div>:<section className="info-card"><h3>Nenhuma sala configurada</h3><p>Quando a Community tiver ambientes persistidos, eles aparecerão aqui.</p></section>}</>:tab==="events"?<>{events.length?<div className="event-list large">{events.map(event=><article key={event.id}><span className="datebox">{new Date(event.starts_at).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}</span><div><b>{event.title}</b><small>{new Date(event.starts_at).toLocaleString("pt-BR")} · {event.type}</small></div><span className="status-good"><i/> {event.status||"agendado"}</span></article>)}</div>:<section className="info-card"><h3>Nenhum evento agendado</h3><p>Eventos persistidos pelo backend aparecerão aqui automaticamente.</p></section>}</>:<>{members.length?<div className="friend-list">{members.map(member=>{const p=member.profile||{};const name=p.display_name||p.username||"Membro";return <article key={member.user_id}><Avatar name={name} url={p.avatar}/><div><b>{name}</b><small>{member.role||"member"} · {p.status||"offline"}</small></div></article>})}</div>:<section className="info-card"><h3>Nenhum membro carregado</h3></section>}</>}</section><aside><section className="info-card"><h3>Sobre a comunidade</h3><p>{community?.description||"Nenhuma Community selecionada."}</p></section><section className="info-card"><h3>Status</h3><p>{detail?.stats?.online||0} online · {detail?.stats?.activeRooms||0} salas ativas</p></section></aside></div>}</>}</Page>}

`;
    fixed = fixed.slice(0, communityStart) + communityImpl + fixed.slice(friendsStart);
  }

  const eventsStart = fixed.indexOf('function EventsView()');
  const storeStart = fixed.indexOf('const STORE_ITEMS=');
  if (eventsStart !== -1 && storeStart !== -1 && storeStart > eventsStart) {
    const eventsImpl = `function EventsView({notify}){const[events,setEvents]=useState([]),[loading,setLoading]=useState(true);useEffect(()=>{let live=true;(async()=>{const communitiesResponse=await API("GET","/api/communities");if(!live)return;if(!communitiesResponse?.ok){setLoading(false);return notify(errorText(communitiesResponse,"Não foi possível carregar eventos."),"error")}const communities=communitiesResponse.data.communities||[];const details=await Promise.all(communities.map(c=>API("GET",\`/api/communities/\${c.id}\`)));if(!live)return;const merged=[];details.forEach((r,index)=>{if(!r?.ok)return;const community=communities[index];(r.data.events||[]).forEach(event=>merged.push({...event,communityName:community.name}))});merged.sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));setEvents(merged);setLoading(false)})();return()=>{live=false}},[notify]);return <Page title="Eventos" subtitle="Agenda real das Communities em que você participa.">{loading?<div className="info-card">Carregando eventos...</div>:events.length?<div className="event-list large">{events.map(event=><article key={event.id}><span className="datebox">{new Date(event.starts_at).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}</span><div><b>{event.title}</b><small>{event.communityName} · {new Date(event.starts_at).toLocaleString("pt-BR")} · {event.type}</small></div><span className="status-good"><i/> {event.status||"agendado"}</span></article>)}</div>:<section className="info-card"><h3>Nenhum evento agendado</h3><p>Quando uma Community criar um evento, ele aparecerá aqui automaticamente.</p></section>}</Page>}

`;
    fixed = fixed.slice(0, eventsStart) + eventsImpl + fixed.slice(storeStart);
  }

  return fixed;
}

export function deadTabsTransformPlugin() {
  return {
    name: "grindlobby-desktop-dead-tabs",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith("main.jsx")) return null;
      const fixed = fixDesktopDeadTabs(code);
      if (fixed === code) return null;
      return { code: fixed, map: null };
    }
  };
}

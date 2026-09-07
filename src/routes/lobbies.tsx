import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Copy,
  Crown,
  DoorOpen,
  Gamepad2,
  Globe2,
  Headphones,
  Home,
  LockKeyhole,
  LogOut,
  Mic,
  MicOff,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { callSession } from "@/lib/call-session";
import portalBg from "@/assets/login-portal.jpg";

export const Route = createFileRoute("/lobbies")({ component: LobbiesPage });

type LobbyVisibility = "public" | "private";
type Presence = {
  userId: string;
  lobbyId: string;
  name: string;
  game: string;
  maxPlayers: number;
  sharing?: boolean;
  updatedAt: string;
};
type PublicLobby = {
  id: string;
  name: string;
  game: string;
  maxPlayers: number;
  members: number;
  sharing: number;
};
type SavedLobby = {
  id: string;
  name: string;
  game: string;
  maxPlayers: number;
  owner: boolean;
  visibility: LobbyVisibility;
};

const nav = [
  ["Início", "/", Home],
  ["Lobbies", "/lobbies", Gamepad2],
  ["Top Elos", "/rank", Trophy],
  ["Loja", "/loja", ShoppingBag],
  ["Perfil", "/perfil", UserRound],
  ["Configurações", "/configuracoes", Settings],
] as const;

function LobbiesPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("Meu lobby");
  const [game, setGame] = useState("EA FC 27");
  const [visibility, setVisibility] = useState<LobbyVisibility>("public");
  const [activeTab, setActiveTab] = useState<LobbyVisibility>("public");
  const [gameFilter, setGameFilter] = useState("Todos os jogos");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");
  const [presence, setPresence] = useState<Presence[]>([]);
  const [saved, setSaved] = useState<SavedLobby[]>([]);
  const [publicLobbyIds, setPublicLobbyIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [userName, setUserName] = useState("Jogador");
  const call = useSyncExternalStore(callSession.subscribe, () => callSession.snapshot, () => callSession.snapshot);

  async function loadMine() {
    await supabase.rpc("cleanup_stale_lobbies");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaved([]);
      return;
    }
    setUserName(user.user_metadata?.display_name || user.user_metadata?.username || user.email?.split("@")[0] || "Jogador");
    const { data } = await supabase
      .from("lobbies")
      .select("route_code,name,game_label,max_members,owner_id,status,visibility")
      .neq("status", "closed")
      .eq("owner_id", user.id);
    setSaved(
      (data || [])
        .filter((row: any) => row.route_code)
        .map((row: any) => ({
          id: row.route_code,
          name: row.name || `Lobby ${row.route_code}`,
          game: row.game_label || "Outro",
          maxPlayers: row.max_members || 10,
          owner: true,
          visibility: row.visibility === "private" ? "private" : "public",
        })),
    );
  }

  async function syncPublicLobbyIds() {
    const { data, error } = await supabase
      .from("lobbies")
      .select("route_code")
      .eq("visibility", "public")
      .neq("status", "closed");
    if (error) {
      setPublicLobbyIds(new Set());
      return;
    }
    setPublicLobbyIds(new Set((data || []).map((row: any) => row.route_code).filter(Boolean)));
  }

  useEffect(() => {
    const queryCode = new URLSearchParams(location.search).get("join");
    if (queryCode) setJoinCode(queryCode.toUpperCase());
    void loadMine();
    void syncPublicLobbyIds();

    const channel = supabase.channel("grind:lobby-directory");
    channel
      .on("presence", { event: "sync" }, () => {
        setPresence(
          Object.values(channel.presenceState<Presence>())
            .flat()
            .map((value) => value as unknown as Presence),
        );
        void syncPublicLobbyIds();
      })
      .subscribe();

    const mineTimer = window.setInterval(() => void loadMine(), 60000);
    const visibilityTimer = window.setInterval(() => void syncPublicLobbyIds(), 15000);
    return () => {
      clearInterval(mineTimer);
      clearInterval(visibilityTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  const publicLobbies = useMemo(() => {
    const lobbyMap = new Map<string, PublicLobby>();
    for (const person of presence) {
      if (!person.lobbyId || !publicLobbyIds.has(person.lobbyId)) continue;
      const existing = lobbyMap.get(person.lobbyId);
      if (existing) {
        existing.members++;
        if (person.sharing) existing.sharing++;
      } else {
        lobbyMap.set(person.lobbyId, {
          id: person.lobbyId,
          name: person.name || `Lobby ${person.lobbyId}`,
          game: person.game || "Outro",
          maxPlayers: person.maxPlayers || 10,
          members: 1,
          sharing: person.sharing ? 1 : 0,
        });
      }
    }
    return [...lobbyMap.values()].sort((a, b) => b.members - a.members);
  }, [presence, publicLobbyIds]);

  const visiblePublic = useMemo(
    () => publicLobbies.filter((lobby) => gameFilter === "Todos os jogos" || lobby.game === gameFilter),
    [gameFilter, publicLobbies],
  );
  const privateRooms = useMemo(() => saved.filter((room) => room.visibility === "private"), [saved]);
  const publicMine = useMemo(() => saved.filter((room) => room.visibility === "public"), [saved]);
  const visibleCards = activeTab === "public" ? visiblePublic : privateRooms;

  const enter = (id: string) => {
    localStorage.setItem("grind:activeLobby", id);
    navigate({ to: "/sala/$lobbyId", params: { lobbyId: id } });
  };

  async function createLobby() {
    setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("Faça login para criar uma sala.");
      return;
    }
    const id = `GL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const payload = {
      owner_id: user.id,
      name: name.trim() || "Meu lobby",
      visibility,
      max_members: 10,
      status: "open",
      route_code: id,
      game_label: game,
    };
    const { error } = await supabase.from("lobbies").insert(payload);
    if (error) {
      setMessage(`Não foi possível criar a sala: ${error.message}`);
      return;
    }
    localStorage.setItem(`grind:lobby-meta:${id}`, JSON.stringify({ id, name: payload.name, game, maxPlayers: 10, visibility }));
    await Promise.all([loadMine(), syncPublicLobbyIds()]);
    enter(id);
  }

  async function join() {
    const code = joinCode.trim().toUpperCase();
    if (!/^GL-[A-Z0-9]{4,12}$/.test(code)) {
      setMessage("Código inválido. Use GL-XXXXXX.");
      return;
    }
    await supabase.rpc("cleanup_stale_lobbies");
    const { data } = await supabase
      .from("lobbies")
      .select("route_code,status,name,game_label,max_members,visibility")
      .eq("route_code", code)
      .maybeSingle();
    if (!data || data.status === "closed") {
      setMessage("Essa sala não existe mais ou já foi encerrada.");
      return;
    }
    localStorage.setItem(
      `grind:lobby-meta:${code}`,
      JSON.stringify({ id: code, name: data.name, game: data.game_label, maxPlayers: data.max_members, visibility: data.visibility === "private" ? "private" : "public" }),
    );
    enter(code);
  }

  async function copy(id: string) {
    await navigator.clipboard.writeText(`${location.origin}/lobbies?join=${encodeURIComponent(id)}`);
    setMessage("Convite copiado.");
  }

  async function disconnect() {
    try {
      const { livekitSession } = await import("@/lib/livekit-session");
      await livekitSession.disconnect(true);
    } catch {
      callSession.leave();
    }
  }

  function renderPublicCard(lobby: PublicLobby) {
    return (
      <article className="gl-lobby-card" key={lobby.id}>
        <div className="gl-lobby-card-head">
          <div className="gl-game-icon">{lobby.game.slice(0, 2).toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="gl-row-name">{lobby.game}</div>
            <div className="gl-row-sub" style={{ color: "#20e68a" }}>● Voz ativa</div>
          </div>
          <div className="gl-score">{lobby.members}/{lobby.maxPlayers}</div>
        </div>
        <div className="gl-lobby-card-title">{lobby.name}</div>
        <div className="gl-lobby-card-meta">
          <span className="gl-chip"><Globe2 size={9} /> Público</span>
          {lobby.sharing > 0 && <span className="gl-chip green">{lobby.sharing} tela(s) ao vivo</span>}
        </div>
        <div className="gl-lobby-card-foot">
          <div className="gl-mini-avatars">
            {Array.from({ length: Math.min(4, lobby.members) }).map((_, index) => <div key={index} className="gl-avatar">{index + 1}</div>)}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="gl-secondary" style={{ minHeight: 30, padding: "0 10px" }} onClick={() => void copy(lobby.id)} type="button" aria-label="Copiar convite"><Copy size={12} /></button>
            <button className="gl-primary" style={{ minHeight: 30, padding: "0 15px" }} onClick={() => enter(lobby.id)} type="button">Entrar</button>
          </div>
        </div>
      </article>
    );
  }

  function renderPrivateCard(lobby: SavedLobby) {
    return (
      <article className="gl-lobby-card" key={lobby.id}>
        <div className="gl-lobby-card-head">
          <div className="gl-game-icon">{lobby.game.slice(0, 2).toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}><div className="gl-row-name">{lobby.game}</div><div className="gl-row-sub">Sala vinculada à sua conta</div></div>
          <LockKeyhole size={15} color="#ba80ff" />
        </div>
        <div className="gl-lobby-card-title">{lobby.name}</div>
        <div className="gl-lobby-card-meta"><span className="gl-chip"><LockKeyhole size={9} /> Privado</span><span className="gl-chip">{lobby.id}</span></div>
        <div className="gl-lobby-card-foot">
          <span className="gl-row-sub">Até {lobby.maxPlayers} jogadores</span>
          <div style={{ display: "flex", gap: 6 }}><button className="gl-secondary" style={{ minHeight: 30, padding: "0 10px" }} onClick={() => void copy(lobby.id)} type="button"><Copy size={12} /></button><button className="gl-primary" style={{ minHeight: 30, padding: "0 15px" }} onClick={() => enter(lobby.id)} type="button">Abrir</button></div>
        </div>
      </article>
    );
  }

  return (
    <div className="gl-app">
      <div className="gl-shell">
        <aside className="gl-sidebar">
          <div className="gl-brand"><img src="/grindlobby-logo.png" alt="GrindLobby" className="gl-brand-mark" /><div className="gl-brand-name">GrindLobby</div><div className="gl-brand-tag">Jogue. Conecte. Evolua.</div></div>
          <nav className="gl-nav" aria-label="Navegação principal">
            {nav.map(([label, to, Icon]) => <Link key={label} to={to} data-active={to === "/lobbies" ? "true" : "false"}><Icon /><span>{label}</span></Link>)}
          </nav>
          <Link to="/pro" className="gl-premium-card"><div className="gl-premium-title"><Crown size={19} /><span>Seja Premium</span></div><div className="gl-premium-sub">1080p liberado, cosméticos e recursos exclusivos.</div></Link>
          <div className="gl-sidebar-meta">GrindLobby v1.0.0<br />Jogue maior.</div>
        </aside>

        <main className="gl-content">
          <header className="gl-topbar">
            <div className="gl-search"><Search size={15} /><span>Filtrar lobbies e jogadores...</span></div>
            <div className="gl-topbar-spacer" /><Bell size={16} color="#aaa3bb" />
            <div className="gl-user"><div className="gl-user-avatar" /><span><span className="gl-user-name">{userName}</span><span className="gl-user-tier">★ GrindLobby</span></span></div>
          </header>

          <section className="gl-hero gl-enter" style={{ minHeight: 123, backgroundImage: `url(${portalBg})`, backgroundPosition: "center 47%" }}>
            <div className="gl-hero-copy" style={{ top: 22 }}>
              <h1 style={{ fontSize: 28 }}>Lobbies criam partidas.<br />Comunidades criam <em>histórias.</em></h1>
              <p style={{ marginTop: 8 }}>Encontre seu time. Jogue junto. Evolua sempre.</p>
            </div>
          </section>

          <div className="gl-lobbies-layout gl-enter gl-enter-d1">
            <section>
              <div className="gl-lobby-toolbar">
                <div className="gl-segment">
                  <button type="button" className={activeTab === "public" ? "active" : ""} onClick={() => setActiveTab("public")}><Globe2 size={14} style={{ display: "inline", marginRight: 7 }} />Lobbies Públicos</button>
                  <button type="button" className={activeTab === "private" ? "active" : ""} onClick={() => setActiveTab("private")}><LockKeyhole size={14} style={{ display: "inline", marginRight: 7 }} />Privados</button>
                </div>
                <div style={{ flex: 1 }} />
                <button type="button" className="gl-primary" style={{ minHeight: 39, minWidth: 160 }} onClick={() => setShowCreate((value) => !value)}><Plus size={15} /> Criar Lobby</button>
              </div>

              <div className="gl-filter-row">
                <select className="gl-filter" value={gameFilter} onChange={(event) => setGameFilter(event.target.value)}>
                  <option>Todos os jogos</option><option>EA FC 27</option><option>VALORANT</option><option>CS2</option><option>Outro</option>
                </select>
                <button type="button" className="gl-filter" onClick={() => { void loadMine(); void syncPublicLobbyIds(); }}>Mais ativos / Atualizar</button>
                <div className="gl-filter" style={{ display: "flex", alignItems: "center", gap: 7 }}><Mic size={12} /> Com voz</div>
              </div>

              {showCreate && (
                <section className="gl-panel" style={{ padding: 13, marginBottom: 10 }}>
                  <div className="gl-section-head" style={{ margin: "-13px -13px 12px" }}><h2 className="gl-panel-title">Criar novo lobby</h2><span className="gl-panel-link">Configuração real da sala</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr .9fr auto", gap: 8 }}>
                    <input className="gl-filter" style={{ width: "100%", minWidth: 0 }} value={name} onChange={(event) => setName(event.target.value)} aria-label="Nome do lobby" />
                    <select className="gl-filter" style={{ width: "100%", minWidth: 0 }} value={game} onChange={(event) => setGame(event.target.value)}><option>EA FC 27</option><option>VALORANT</option><option>CS2</option><option>Outro</option></select>
                    <select className="gl-filter" style={{ width: "100%", minWidth: 0 }} value={visibility} onChange={(event) => setVisibility(event.target.value as LobbyVisibility)}><option value="public">Público</option><option value="private">Privado</option></select>
                    <button className="gl-primary" type="button" onClick={() => void createLobby()}>Criar e entrar</button>
                  </div>
                </section>
              )}

              {visibleCards.length ? (
                <div className="gl-lobby-cards">
                  {activeTab === "public"
                    ? (visibleCards as PublicLobby[]).map(renderPublicCard)
                    : (visibleCards as SavedLobby[]).map(renderPrivateCard)}
                </div>
              ) : (
                <div className="gl-panel" style={{ minHeight: 268, display: "grid", placeItems: "center", textAlign: "center", padding: 30 }}>
                  <div><div style={{ width: 56, height: 56, borderRadius: 14, margin: "0 auto 13px", display: "grid", placeItems: "center", border: "1px solid rgba(148,92,255,.28)", background: "rgba(91,35,164,.16)", boxShadow: "0 0 34px rgba(113,35,230,.12)" }}>{activeTab === "public" ? <Globe2 size={24} color="#b674ff" /> : <LockKeyhole size={24} color="#b674ff" />}</div><div style={{ fontSize: 13, fontWeight: 800 }}>{activeTab === "public" ? "Nenhum lobby público ativo agora" : "Você ainda não tem lobby privado aberto"}</div><div style={{ marginTop: 6, fontSize: 10, color: "#827b91" }}>A lista usa presença e estado reais; nenhum lobby é inventado para preencher a interface.</div></div>
                </div>
              )}

              {publicMine.length > 0 && activeTab === "public" && (
                <section className="gl-panel" style={{ marginTop: 10 }}>
                  <div className="gl-section-head"><h2 className="gl-panel-title">Suas salas públicas</h2><span className="gl-panel-link">{publicMine.length} abertas</span></div>
                  {publicMine.map((room) => <div key={room.id} className="gl-lobby-row"><div className="gl-game-icon">{room.game.slice(0,2).toUpperCase()}</div><div className="gl-row-main"><div className="gl-row-name">{room.name}</div><div className="gl-row-sub">{room.id} · {room.game}</div></div><button type="button" className="gl-secondary" style={{ minHeight: 28, padding: "0 10px" }} onClick={() => void copy(room.id)}><Copy size={11} /></button><button type="button" className="gl-primary" style={{ minHeight: 28, padding: "0 12px", marginLeft: 6 }} onClick={() => enter(room.id)}>Abrir</button></div>)}
                </section>
              )}
            </section>

            <aside className="gl-stack">
              <section className="gl-panel gl-community-feature">
                <div className="gl-section-head" style={{ margin: "-12px -12px 10px" }}><h2 className="gl-panel-title">Acesso rápido</h2><span className="gl-panel-link">convites</span></div>
                <div className="gl-community-feature-art" />
                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800 }}>Entrar com código</div>
                <div style={{ marginTop: 5, fontSize: 9, color: "#817a90" }}>Use o convite GL-XXXXXX de uma sala existente.</div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}><input className="gl-filter" style={{ minWidth: 0, flex: 1, textTransform: "uppercase" }} value={joinCode} onChange={(event) => setJoinCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void join()} placeholder="GL-XXXXXX" /><button type="button" className="gl-primary" style={{ minHeight: 33, padding: "0 12px" }} onClick={() => void join()}><DoorOpen size={12} /> Entrar</button></div>
                {message && <div style={{ marginTop: 8, fontSize: 9, color: "#a69db4" }}>{message}</div>}
              </section>

              <section className="gl-panel">
                <div className="gl-section-head"><h2 className="gl-panel-title">Suas Salas</h2><span className="gl-panel-link">{saved.length}</span></div>
                <div className="gl-community-list">
                  {saved.length ? saved.slice(0, 5).map((room) => (
                    <div className="gl-community-row" key={room.id} style={{ paddingLeft: 11, paddingRight: 11 }}>
                      <div className="gl-game-icon">{room.game.slice(0,2).toUpperCase()}</div>
                      <div className="gl-row-main"><div className="gl-row-name">{room.name}</div><div className="gl-row-sub">{room.visibility === "private" ? "Privado" : "Público"} · {room.id}</div></div>
                      <button type="button" className="gl-primary" style={{ minHeight: 28, padding: "0 11px" }} onClick={() => enter(room.id)}>Abrir</button>
                    </div>
                  )) : <div style={{ padding: "18px 12px", fontSize: 9, color: "#817a90" }}>Nenhuma sala aberta vinculada à sua conta.</div>}
                </div>
              </section>

              <section className="gl-panel" style={{ padding: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Users size={15} color="#b76eff" /><div><div className="gl-row-name">Descoberta em tempo real</div><div className="gl-row-sub">{publicLobbies.length} lobby(s) público(s) com presença ativa</div></div></div>
              </section>
            </aside>
          </div>
        </main>
      </div>

      <footer className="gl-bottom-dock">
        <div className="gl-dock-call"><span style={{ width: 10, height: 10, borderRadius: 99, border: `2px solid ${call.lobbyId ? "#20e68a" : "#6b6477"}`, boxShadow: call.lobbyId ? "0 0 12px rgba(32,230,138,.68)" : "none" }} /><div><div style={{ fontSize: 8, fontWeight: 700, color: call.lobbyId ? "#20e68a" : "#827b91" }}>{call.lobbyId ? "Chamada de Voz Ativa" : "Sem call ativa"}</div><div style={{ marginTop: 2, fontSize: 10, color: "#d4cfdb" }}>{call.lobbyId || "Encontre um lobby"}</div></div></div>
        <div className="gl-dock-members"><div style={{ fontSize: 9, color: "#80798d" }}>{publicLobbies.length} lobbies públicos ativos</div></div>
        <div className="gl-dock-controls"><button type="button" className="gl-round-btn" disabled={!call.lobbyId} onClick={() => void callSession.setMuted(!call.muted)}>{call.muted ? <MicOff size={15} /> : <Mic size={15} />}</button>{call.lobbyId ? <Link to="/sala/$lobbyId" params={{ lobbyId: call.lobbyId }} className="gl-round-btn"><Headphones size={15} /></Link> : <button className="gl-round-btn" type="button" onClick={() => setShowCreate(true)}><Plus size={15} /></button>}<Link to="/configuracoes" className="gl-round-btn"><Settings size={15} /></Link><button type="button" className="gl-round-btn danger" disabled={!call.lobbyId} onClick={() => void disconnect()}><LogOut size={15} /></button></div>
        <div className="gl-dock-audio"><Gamepad2 size={18} color="#9e53ff" /><div><div style={{ fontSize: 7, color: "#70697d" }}>GrindLobby</div><div style={{ fontSize: 9, fontWeight: 700 }}>Lobby Browser</div></div></div>
      </footer>
    </div>
  );
}

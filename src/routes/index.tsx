import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  Crown,
  Gamepad2,
  Headphones,
  Home,
  LogOut,
  Mic,
  MicOff,
  MonitorUp,
  Music2,
  Search,
  Settings,
  ShoppingBag,
  Trophy,
  UserRound,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { callSession } from "@/lib/call-session";
import { PlayerProvider, usePlayer } from "@/lib/player-store";
import { getTier } from "@/lib/levels";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ProfileSettings } from "@/components/ProfileSettings";
import portalBg from "@/assets/login-portal.jpg";
import rankEmblem from "@/assets/rank-emblem.png";

export const Route = createFileRoute("/")({ component: Dashboard });

type Presence = {
  userId: string;
  name: string;
  avatar?: string | null;
  speaking?: boolean;
  sharing?: boolean;
};

type LobbyRow = {
  route_code: string;
  name: string;
  visibility: string;
  max_members: number;
  status: string;
  game_label: string | null;
  owner_id: string;
};

type OnlineProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar: string | null;
  last_seen_at: string | null;
  status: string | null;
};

const nav = [
  ["Início", "/", Home],
  ["Lobbies", "/lobbies", Gamepad2],
  ["Top Elos", "/rank", Trophy],
  ["Loja", "/loja", ShoppingBag],
  ["Perfil", "/perfil", UserRound],
  ["Configurações", "/configuracoes", Settings],
] as const;

function fmtAgo(iso: string | null) {
  if (!iso) return "agora";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.floor(minutes / 60)} h`;
}

function fmtDuration(start: number | null) {
  if (!start) return "00:00";
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function Dashboard() {
  return (
    <PlayerProvider>
      <DashboardInner />
    </PlayerProvider>
  );
}

function DashboardInner() {
  const { player } = usePlayer();
  const [profileOpen, setProfileOpen] = useState(false);
  const [people, setPeople] = useState<Presence[]>([]);
  const [lobby, setLobby] = useState<LobbyRow | null>(null);
  const [online, setOnline] = useState<OnlineProfile[]>([]);
  const [, setClock] = useState(0);
  const call = useSyncExternalStore(callSession.subscribe, () => callSession.snapshot, () => callSession.snapshot);
  const tier = getTier(player.level);

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,username,avatar,last_seen_at,status")
        .gte("last_seen_at", since)
        .order("last_seen_at", { ascending: false })
        .limit(8);
      setOnline((data || []) as OnlineProfile[]);
    };
    void load();
    const channel = supabase
      .channel("dashboard-online-profiles")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setPeople([]);
    setLobby(null);
    if (!call.lobbyId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void (async () => {
      const { data } = await supabase
        .from("lobbies")
        .select("route_code,name,visibility,max_members,status,game_label,owner_id")
        .eq("route_code", call.lobbyId)
        .maybeSingle();
      if (data) setLobby(data as LobbyRow);
      const source = supabase.channel(`grind:room:${call.lobbyId}`);
      channel = source;
      source
        .on("presence", { event: "sync" }, () => {
          setPeople(
            Object.values(source.presenceState<Presence>())
              .flat()
              .map((value) => value as unknown as Presence),
          );
        })
        .subscribe();
    })();
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [call.lobbyId]);

  const ranking = useMemo(() => {
    const self = {
      id: "self",
      name: player.nickname,
      avatar: player.avatarUrl || null,
      sub: `${tier.name} · Nível ${player.level}`,
      score: `${player.xp.toLocaleString("pt-BR")} XP`,
    };
    const others = online
      .filter((profile) => (profile.display_name || profile.username) !== player.nickname)
      .slice(0, 4)
      .map((profile) => ({
        id: profile.id,
        name: profile.display_name || profile.username || "Jogador",
        avatar: profile.avatar,
        sub: profile.status === "online" ? "Online agora" : fmtAgo(profile.last_seen_at),
        score: "ONLINE",
      }));
    return [self, ...others].slice(0, 5);
  }, [online, player.avatarUrl, player.level, player.nickname, player.xp, tier.name]);

  const activity = useMemo(() => {
    const inCall = people.map((person) => ({
      id: `call-${person.userId}`,
      name: person.name,
      detail: person.sharing ? "está compartilhando a tela" : person.speaking ? "está falando na call" : "está na sua call",
      avatar: person.avatar || null,
    }));
    const others = online
      .filter((profile) => !people.some((person) => person.userId === profile.id))
      .slice(0, Math.max(0, 4 - inCall.length))
      .map((profile) => ({
        id: profile.id,
        name: profile.display_name || profile.username || "Jogador",
        detail: profile.status === "online" ? "está online no GrindLobby" : `esteve online ${fmtAgo(profile.last_seen_at)}`,
        avatar: profile.avatar,
      }));
    return [...inCall, ...others].slice(0, 4);
  }, [online, people]);

  const disconnect = async () => {
    try {
      const { livekitSession } = await import("@/lib/livekit-session");
      await livekitSession.disconnect(true);
    } catch {
      callSession.leave();
    }
  };

  const isSharing = people.some((person) => person.sharing);

  return (
    <div className="gl-app">
      <div className="gl-shell">
        <aside className="gl-sidebar">
          <div className="gl-brand">
            <img src="/grindlobby-logo.png" alt="GrindLobby" className="gl-brand-mark" />
            <div className="gl-brand-name">GrindLobby</div>
            <div className="gl-brand-tag">Jogue. Conecte. Evolua.</div>
          </div>

          <nav className="gl-nav" aria-label="Navegação principal">
            {nav.map(([label, to, Icon]) => (
              <Link key={label} to={to} data-active={to === "/" ? "true" : "false"}>
                <Icon />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <Link to="/pro" className="gl-premium-card">
            <div className="gl-premium-title">
              <Crown size={19} />
              <span>Seja Premium</span>
            </div>
            <div className="gl-premium-sub">1080p liberado, cosméticos e recursos exclusivos.</div>
          </Link>
          <div className="gl-sidebar-meta">GrindLobby v1.0.0<br />Jogue maior.</div>
        </aside>

        <main className="gl-content">
          <header className="gl-topbar">
            <div className="gl-search">
              <Search size={15} />
              <span>Buscar jogadores, lobbies, comunidades...</span>
            </div>
            <div className="gl-topbar-spacer" />
            <Bell size={16} color="#aaa3bb" />
            <button className="gl-user" onClick={() => setProfileOpen(true)} type="button">
              <ProfileAvatar name={player.nickname} size={32} avatarUrl={player.avatarUrl} borderId={player.equipped.border} />
              <span>
                <span className="gl-user-name">{player.nickname}</span>
                <span className="gl-user-tier">★ {tier.name}</span>
              </span>
            </button>
          </header>

          <section className="gl-hero gl-enter" style={{ backgroundImage: `url(${portalBg})` }} aria-label="Boas-vindas">
            <div className="gl-hero-copy">
              <h1>Bem-vindo ao<br />GrindLobby, <em>{player.nickname}</em></h1>
              <p>Mais que lobbies. Uma comunidade que joga junto, evolui junto e chega mais longe.</p>
              <div className="gl-hero-actions">
                <Link to="/lobbies" className="gl-primary">Encontrar Lobbies →</Link>
                <Link to="/lobbies" className="gl-secondary">Explorar Comunidades</Link>
              </div>
            </div>
          </section>

          <div className="gl-dashboard-grid gl-enter gl-enter-d1">
            <div className="gl-stack">
              <section className="gl-panel">
                <div className="gl-section-head">
                  <h2 className="gl-panel-title">Top Elos da Semana</h2>
                  <Link to="/rank" className="gl-panel-link">Ver ranking →</Link>
                </div>
                <div>
                  {ranking.map((row, index) => (
                    <div key={row.id} className="gl-ranking-row">
                      <div className="gl-rank-num">{index + 1}</div>
                      {row.avatar ? <img className="gl-avatar" src={row.avatar} alt="" /> : <div className="gl-avatar">{row.name.slice(0, 1).toUpperCase()}</div>}
                      <div className="gl-rank-info">
                        <div className="gl-row-name">{row.name}</div>
                        <div className="gl-row-sub">{row.sub}</div>
                      </div>
                      <div className="gl-score">{row.score}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="gl-panel">
                <div className="gl-section-head">
                  <h2 className="gl-panel-title">Sua Jornada</h2>
                  <button className="gl-panel-link" type="button" onClick={() => setProfileOpen(true)}>Ver perfil →</button>
                </div>
                <div className="gl-journey">
                  <div className="gl-journey-top">
                    <img src={rankEmblem} className="gl-emblem" alt="Elo" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: "#8f88a0" }}>Elo Principal</div>
                      <div style={{ marginTop: 2, fontSize: 18, fontWeight: 800 }}>{tier.name}</div>
                      <div style={{ marginTop: 2, fontSize: 10, color: "#b7aec8" }}>{player.xp.toLocaleString("pt-BR")} XP</div>
                      <div className="gl-progress" style={{ marginTop: 10 }}><span style={{ width: `${Math.min(100, Math.max(8, (player.level % 10) * 10))}%` }} /></div>
                    </div>
                  </div>
                  <div className="gl-stats">
                    <div className="gl-stat"><strong>{player.level}</strong><span>NÍVEL</span></div>
                    <div className="gl-stat"><strong>{people.length}</strong><span>NA CALL</span></div>
                    <div className="gl-stat"><strong>{call.metrics.rttMs == null ? "—" : Math.round(call.metrics.rttMs)}</strong><span>PING MS</span></div>
                    <div className="gl-stat"><strong>{player.matchesWon}</strong><span>VITÓRIAS</span></div>
                  </div>
                </div>
              </section>
            </div>

            <div className="gl-stack">
              <section className="gl-panel">
                <div className="gl-section-head">
                  <h2 className="gl-panel-title">Lobbies ao Vivo</h2>
                  <Link to="/lobbies" className="gl-panel-link">Ver todos →</Link>
                </div>
                <div>
                  {call.lobbyId ? (
                    <div className="gl-lobby-row">
                      <div className="gl-game-icon">GL</div>
                      <div className="gl-row-main">
                        <div className="gl-row-name">{lobby?.name || `Lobby ${call.lobbyId}`}</div>
                        <div className="gl-row-sub">{lobby?.game_label || "GrindLobby"} · <span style={{ color: "#20e68a" }}>Voz ativa</span></div>
                      </div>
                      <span className="gl-chip green">{people.length}/{lobby?.max_members || 10}</span>
                      <Link to="/sala/$lobbyId" params={{ lobbyId: call.lobbyId }} className="gl-primary" style={{ minHeight: 29, padding: "0 13px", marginLeft: 8 }}>Abrir</Link>
                    </div>
                  ) : <div style={{ padding: "19px 13px", color: "#8d879d", fontSize: 10 }}>Nenhuma call ativa. Entre em um lobby para aparecer aqui.</div>}
                  {online.slice(0, 3).map((profile) => (
                    <div className="gl-lobby-row" key={profile.id}>
                      <div className="gl-game-icon">{(profile.display_name || profile.username || "G").slice(0, 1).toUpperCase()}</div>
                      <div className="gl-row-main">
                        <div className="gl-row-name">{profile.display_name || profile.username || "Jogador"}</div>
                        <div className="gl-row-sub">Disponível no GrindLobby</div>
                      </div>
                      <span className="gl-chip green">ONLINE</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="gl-panel">
                <div className="gl-section-head">
                  <h2 className="gl-panel-title">Atividade da Comunidade</h2>
                  <Link to="/lobbies" className="gl-panel-link">Ver tudo →</Link>
                </div>
                <div style={{ padding: "5px 0 9px" }}>
                  {activity.length ? activity.map((item) => (
                    <div className="gl-activity-row" key={item.id}>
                      {item.avatar ? <img src={item.avatar} className="gl-avatar" alt="" /> : <div className="gl-avatar">{item.name.slice(0,1).toUpperCase()}</div>}
                      <div className="gl-row-main"><div className="gl-row-name">{item.name}</div><div className="gl-row-sub">{item.detail}</div></div>
                    </div>
                  )) : <div style={{ padding: "18px 13px", color: "#8d879d", fontSize: 10 }}>Sem atividade recente detectada.</div>}
                </div>
              </section>
            </div>

            <div className="gl-stack">
              <section className="gl-panel gl-call-panel">
                <div className="gl-section-head">
                  <h2 className="gl-panel-title" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: call.lobbyId ? "#20e68a" : "#655f72", boxShadow: call.lobbyId ? "0 0 11px rgba(32,230,138,.7)" : "none" }} />
                    Chamada de Voz
                  </h2>
                  <span className="gl-panel-link">{call.lobbyId ? fmtDuration(call.startedAt) : "offline"}</span>
                </div>
                <div style={{ padding: "9px 13px 0" }}><div className="gl-row-name">{lobby?.name || (call.lobbyId ? `Lobby ${call.lobbyId}` : "Sem call ativa")}</div><div className="gl-row-sub">{call.lobbyId ? `${people.length} na call` : "Entre em um lobby para iniciar"}</div></div>
                <div className="gl-call-users">
                  {(people.length ? people : [{ userId: "self", name: player.nickname, avatar: player.avatarUrl, speaking: false, sharing: false }]).slice(0, 6).map((person) => (
                    <div className="gl-call-user" key={person.userId}>{person.avatar ? <img src={person.avatar} className="gl-avatar" alt="" /> : <div className="gl-avatar">{person.name.slice(0, 1).toUpperCase()}</div>}<div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{person.name}</div></div>
                  ))}
                </div>
                <div className="gl-call-controls">
                  <button className="gl-round-btn" type="button" onClick={() => void callSession.setMuted(!call.muted)} aria-label={call.muted ? "Ativar microfone" : "Mutar microfone"}>{call.muted ? <MicOff size={15} /> : <Mic size={15} />}</button>
                  {call.lobbyId ? <Link to="/sala/$lobbyId" params={{ lobbyId: call.lobbyId }} className="gl-round-btn" aria-label="Abrir sala"><Headphones size={15} /></Link> : <Link to="/lobbies" className="gl-round-btn" aria-label="Encontrar lobby"><Headphones size={15} /></Link>}
                  <Link to="/configuracoes" className="gl-round-btn" aria-label="Configurações"><Settings size={15} /></Link>
                  <button className="gl-round-btn danger" type="button" disabled={!call.lobbyId} onClick={() => void disconnect()} aria-label="Sair da call"><LogOut size={16} /></button>
                </div>
              </section>

              <section className="gl-panel">
                <div className="gl-section-head"><h2 className="gl-panel-title">Tela ao Vivo</h2><span className="gl-panel-link">{isSharing ? "transmissão ativa" : "pronta"}</span></div>
                <div className="gl-stream-body"><div className="gl-stream-preview" /><div><div style={{ fontSize: 8, fontWeight: 700, marginBottom: 7 }}>Qualidade da transmissão</div><div className="gl-quality-grid"><div className="gl-quality">480p 30</div><div className="gl-quality">480p 60</div><div className="gl-quality active">720p 30</div><div className="gl-quality">1080p Pro 👑</div></div></div></div>
              </section>

              <section className="gl-panel gl-audio-strip"><Music2 size={18} color="#20d779" /><div style={{ minWidth: 0 }}><div style={{ fontSize: 7, color: "#7d768d" }}>Tocando agora</div><div className="gl-row-name">GRIND BEATS</div></div><div className="gl-bars" aria-hidden="true">{Array.from({ length: 16 }).map((_, index) => <span key={index} />)}</div></section>

              <Link to="/loja" className="gl-panel" style={{ minHeight: 80, padding: "11px 13px", display: "flex", alignItems: "center", gap: 12 }}><div style={{ flex: 1 }}><div style={{ fontSize: 8, color: "#8d849d" }}>Destaque da Loja</div><div style={{ marginTop: 4, fontSize: 11, fontWeight: 800 }}>Itens cosméticos</div><div style={{ marginTop: 3, fontSize: 9, color: "#cfc8d8" }}>Veja a coleção disponível</div></div><div className="gl-primary" style={{ minHeight: 29, padding: "0 13px" }}>Ver loja</div></Link>
            </div>
          </div>
        </main>
      </div>

      <footer className="gl-bottom-dock">
        <div className="gl-dock-call"><span style={{ width: 10, height: 10, borderRadius: 99, border: "2px solid #20e68a", boxShadow: "0 0 12px rgba(32,230,138,.68)" }} /><div><div style={{ fontSize: 8, fontWeight: 700 }}>{call.lobbyId ? "Chamada de Voz Ativa" : "Voz disponível"}</div><div style={{ marginTop: 2, fontSize: 10, color: "#d4cfdb" }}>{lobby?.name || "Entre em um lobby"}</div></div></div>
        <div className="gl-dock-members">
          {(people.length ? people : online.slice(0, 5)).slice(0, 6).map((person: Presence | OnlineProfile) => {
            const name = "name" in person ? person.name : person.display_name || person.username || "Jogador";
            const avatar = person.avatar;
            const key = "userId" in person ? person.userId : person.id;
            return avatar ? <img key={key} src={avatar} className="gl-avatar" alt="" /> : <div key={key} className="gl-avatar">{name.slice(0,1).toUpperCase()}</div>;
          })}
        </div>
        <div className="gl-dock-controls"><button className="gl-round-btn" type="button" onClick={() => void callSession.setMuted(!call.muted)}>{call.muted ? <MicOff size={15} /> : <Mic size={15} />}</button><Link to="/configuracoes" className="gl-round-btn"><Volume2 size={15} /></Link>{call.lobbyId ? <Link to="/sala/$lobbyId" params={{ lobbyId: call.lobbyId }} className="gl-round-btn"><MonitorUp size={15} /></Link> : <Link to="/lobbies" className="gl-round-btn"><MonitorUp size={15} /></Link>}<button className="gl-round-btn danger" disabled={!call.lobbyId} type="button" onClick={() => void disconnect()}><LogOut size={15} /></button></div>
        <div className="gl-dock-audio"><Music2 size={18} color="#20d779" /><div style={{ minWidth: 0 }}><div style={{ fontSize: 7, color: "#70697d" }}>Áudio</div><div style={{ fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Player integrado</div></div></div>
      </footer>

      {profileOpen && <ProfileSettings onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

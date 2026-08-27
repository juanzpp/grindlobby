import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Copy,
  DoorOpen,
  Globe2,
  LayoutGrid,
  LockKeyhole,
  Plus,
  Settings,
  Star,
  Store,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  ["Dashboard", "/", LayoutGrid],
  ["Lobbies", "/lobbies", Users],
  ["Rank", "/rank", Trophy],
  ["Loja", "/loja", Store],
  ["Pro", "/pro", Star],
  ["Configurações", "/configuracoes", Settings],
] as const;

function Logo() {
  return <img src="/grindlobby-logo.png" alt="GrindLobby" className="mx-auto h-14 w-14 object-contain" />;
}

function LobbiesPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("Meu lobby");
  const [game, setGame] = useState("EA FC 27");
  const [visibility, setVisibility] = useState<LobbyVisibility>("public");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");
  const [presence, setPresence] = useState<Presence[]>([]);
  const [saved, setSaved] = useState<SavedLobby[]>([]);
  const [publicLobbyIds, setPublicLobbyIds] = useState<Set<string>>(new Set());

  async function loadMine() {
    await supabase.rpc("cleanup_stale_lobbies");
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaved([]);
      return;
    }

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
      // Privacy-first: if visibility cannot be verified, do not expose rooms in discovery.
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

  const enter = (id: string) => {
    localStorage.setItem("grind:activeLobby", id);
    navigate({ to: "/sala/$lobbyId", params: { lobbyId: id } });
  };

  async function createLobby() {
    setMessage("");
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    localStorage.setItem(
      `grind:lobby-meta:${id}`,
      JSON.stringify({ id, name: payload.name, game, maxPlayers: 10, visibility }),
    );

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
      JSON.stringify({
        id: code,
        name: data.name,
        game: data.game_label,
        maxPlayers: data.max_members,
        visibility: data.visibility === "private" ? "private" : "public",
      }),
    );
    enter(code);
  }

  async function copy(id: string) {
    await navigator.clipboard.writeText(`${location.origin}/lobbies?join=${encodeURIComponent(id)}`);
    setMessage("Convite copiado.");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="panel sticky top-6 p-4">
            <Logo />
            <nav className="mt-5 space-y-1">
              {nav.map(([label, to, Icon]) => (
                <Link
                  key={label}
                  to={to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    to === "/lobbies"
                      ? "bg-primary/15 text-primary-glow"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-5">
          <header>
            <p className="label-caps">GrindLobby</p>
            <h1 className="font-display text-3xl font-bold">Lobbies</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Lobbies públicos aparecem na descoberta. Lobbies privados entram apenas por convite ou código.
            </p>
          </header>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="panel p-5">
              <h2 className="font-semibold">Criar lobby</h2>
              <div className="mt-4 grid gap-3">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-lg border border-border bg-panel px-3 py-2"
                />
                <select
                  value={game}
                  onChange={(event) => setGame(event.target.value)}
                  className="rounded-lg border border-border bg-panel px-3 py-2"
                >
                  <option>EA FC 27</option>
                  <option>VALORANT</option>
                  <option>CS2</option>
                  <option>Outro</option>
                </select>

                <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-panel/50 p-1.5">
                  <button
                    type="button"
                    onClick={() => setVisibility("public")}
                    aria-pressed={visibility === "public"}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm transition ${
                      visibility === "public"
                        ? "bg-primary/15 text-primary-glow ring-1 ring-primary/30"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <Globe2 className="h-4 w-4" />
                    Público
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility("private")}
                    aria-pressed={visibility === "private"}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm transition ${
                      visibility === "private"
                        ? "bg-primary/15 text-primary-glow ring-1 ring-primary/30"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <LockKeyhole className="h-4 w-4" />
                    Privado
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  {visibility === "public"
                    ? "Público: aparece para todos na lista de lobbies ativos."
                    : "Privado: não aparece na descoberta; acesso somente por código ou link de convite."}
                </p>

                <button
                  onClick={() => void createLobby()}
                  className="btn-primary flex items-center justify-center gap-2 rounded-lg px-4 py-2.5"
                >
                  <Plus className="h-4 w-4" />
                  Criar e entrar
                </button>
              </div>
            </div>

            <div className="panel p-5">
              <h2 className="font-semibold">Entrar com código</h2>
              <div className="mt-4 flex gap-2">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void join()}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-panel px-3 py-2 uppercase"
                  placeholder="GL-XXXXXX"
                />
                <button onClick={() => void join()} className="btn-ghost flex items-center gap-2 rounded-lg px-4">
                  <DoorOpen className="h-4 w-4" />
                  Entrar
                </button>
              </div>
              {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Lobbies públicos</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Presença em tempo real — somente salas públicas e ativas aparecem aqui.
                </p>
              </div>
              <span className="text-xs text-emerald-400">{publicLobbies.length} ativos</span>
            </div>

            {publicLobbies.length === 0 ? (
              <p className="mt-5 text-sm text-muted-foreground">Nenhuma sala pública com jogadores online agora.</p>
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {publicLobbies.map((lobby) => (
                  <div key={lobby.id} className="rounded-xl border border-border bg-panel/60 p-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{lobby.name}</p>
                          <Globe2 className="h-3.5 w-3.5 text-emerald-400" aria-label="Lobby público" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {lobby.game} · {lobby.id}
                        </p>
                      </div>
                      <span className="text-xs text-emerald-400">
                        {lobby.members}/{lobby.maxPlayers}
                      </span>
                    </div>
                    {lobby.sharing > 0 && (
                      <p className="mt-2 text-xs text-purple-300">{lobby.sharing} tela(s) aberta(s)</p>
                    )}
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => enter(lobby.id)}
                        className="btn-primary flex-1 rounded-lg px-3 py-2 text-sm"
                      >
                        Entrar
                      </button>
                      <button onClick={() => void copy(lobby.id)} className="btn-ghost rounded-lg px-3">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="font-semibold">Suas salas abertas</h2>
            {saved.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nenhuma sala aberta vinculada à sua conta.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {saved.map((lobby) => (
                  <div
                    key={lobby.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-panel/60 p-4"
                  >
                    <button onClick={() => enter(lobby.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{lobby.name}</p>
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                          {lobby.visibility === "private" ? (
                            <LockKeyhole className="h-3 w-3" />
                          ) : (
                            <Globe2 className="h-3 w-3" />
                          )}
                          {lobby.visibility === "private" ? "Privado" : "Público"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lobby.id} · {lobby.game}
                      </p>
                    </button>
                    <button onClick={() => void copy(lobby.id)} className="btn-ghost rounded-lg p-2">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

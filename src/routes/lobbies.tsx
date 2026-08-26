import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, DoorOpen, LayoutGrid, Plus, Store, Trophy, Users, Settings, Star } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/lobbies")({ component: LobbiesPage });

type Lobby = { id: string; name: string; game: string; maxPlayers: number; createdAt: string };

const nav = [
  ["Dashboard", "/", LayoutGrid], ["Lobbies", "/lobbies", Users], ["Rank", "/rank", Trophy],
  ["Loja", "/loja", Store], ["Pro", "/pro", Star], ["Configurações", "/configuracoes", Settings],
] as const;

function BrandLogo({ size = 56 }: { size?: number }) {
  return <img src="/grindlobby-logo.png" alt="GrindLobby" width={size} height={size} className="mx-auto object-contain" style={{ width: size, height: size, clipPath: "circle(47% at 50% 50%)" }} />;
}

function LobbiesPage() {
  const navigate = useNavigate();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [name, setName] = useState("Meu lobby");
  const [game, setGame] = useState("VALORANT");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try { setLobbies(JSON.parse(localStorage.getItem("grind:lobbies") || "[]")); } catch { setLobbies([]); }
    const params = new URLSearchParams(location.search);
    const code = params.get("join");
    if (code) setJoinCode(code.toUpperCase());
  }, []);

  const persist = (next: Lobby[]) => {
    setLobbies(next);
    localStorage.setItem("grind:lobbies", JSON.stringify(next));
  };

  const enterRoom = (id: string) => {
    localStorage.setItem("grind:activeLobby", id);
    navigate({ to: "/sala/$lobbyId", params: { lobbyId: id } });
  };

  const createLobby = () => {
    const id = `GL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const lobby: Lobby = { id, name: name.trim() || "Meu lobby", game, maxPlayers: 8, createdAt: new Date().toISOString() };
    persist([lobby, ...lobbies.filter((item) => item.id !== id)]);
    enterRoom(id);
  };

  const joinLobby = () => {
    const code = joinCode.trim().toUpperCase();
    if (!/^GL-[A-Z0-9]{4,12}$/.test(code)) {
      setMessage("Código inválido. Use um código no formato GL-XXXXXX.");
      return;
    }
    const exists = lobbies.some((l) => l.id === code);
    if (!exists) {
      const placeholder: Lobby = { id: code, name: `Lobby ${code}`, game: "Não informado", maxPlayers: 8, createdAt: new Date().toISOString() };
      persist([placeholder, ...lobbies]);
    }
    enterRoom(code);
  };

  const copyInvite = async (id: string) => {
    const url = `${location.origin}/lobbies?join=${encodeURIComponent(id)}`;
    await navigator.clipboard.writeText(url);
    setMessage("Link de convite copiado.");
  };

  return <div className="min-h-screen bg-background text-foreground"><div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-6">
    <aside className="hidden w-56 shrink-0 lg:block"><div className="panel sticky top-6 p-4"><BrandLogo/><nav className="mt-5 space-y-1">{nav.map(([label,to,Icon]) => <Link key={label} to={to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${to==="/lobbies"?"bg-primary/15 text-primary-glow":"text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon className="h-4 w-4"/>{label}</Link>)}</nav></div></aside>
    <main className="min-w-0 flex-1 space-y-5"><header><p className="label-caps">GrindLobby</p><h1 className="font-display text-3xl font-bold">Lobbies</h1><p className="mt-1 text-sm text-muted-foreground">Ao criar ou entrar em um lobby, você é levado diretamente para a sala.</p></header>
      <section className="grid gap-4 xl:grid-cols-2"><div className="panel p-5"><h2 className="font-semibold">Criar lobby</h2><div className="mt-4 grid gap-3"><input value={name} onChange={e=>setName(e.target.value)} className="rounded-lg border border-border bg-panel px-3 py-2" placeholder="Nome do lobby"/><select value={game} onChange={e=>setGame(e.target.value)} className="rounded-lg border border-border bg-panel px-3 py-2"><option>VALORANT</option><option>EA FC 27</option><option>CS2</option><option>Outro</option></select><button onClick={createLobby} className="btn-primary flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold"><Plus className="h-4 w-4"/>Criar e entrar</button></div></div>
      <div className="panel p-5"><h2 className="font-semibold">Entrar com código</h2><div className="mt-4 flex gap-2"><input value={joinCode} onChange={e=>setJoinCode(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")joinLobby();}} className="min-w-0 flex-1 rounded-lg border border-border bg-panel px-3 py-2 uppercase" placeholder="GL-XXXXXX"/><button onClick={joinLobby} className="btn-ghost flex items-center gap-2 rounded-lg px-4 py-2"><DoorOpen className="h-4 w-4"/>Entrar</button></div>{message&&<p className="mt-3 text-xs text-muted-foreground">{message}</p>}</div></section>
      <section className="panel p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Seus lobbies</h2><span className="text-xs text-muted-foreground">{lobbies.length} salvos</span></div>{!lobbies.length?<p className="mt-5 text-sm text-muted-foreground">Nenhum lobby criado neste dispositivo.</p>:<div className="mt-4 grid gap-3">{lobbies.map(l=><div key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-panel/60 p-4"><button onClick={()=>enterRoom(l.id)} className="min-w-0 flex-1 text-left"><p className="font-semibold">{l.name}</p><p className="text-xs text-muted-foreground">{l.game} · {l.id} · até {l.maxPlayers} jogadores</p></button><button onClick={()=>copyInvite(l.id)} className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm"><Copy className="h-4 w-4"/>Convite</button><button onClick={()=>enterRoom(l.id)} className="btn-primary rounded-lg px-3 py-2 text-sm">Entrar</button></div>)}</div>}</section>
    </main></div></div>;
}

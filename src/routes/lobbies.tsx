import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, DoorOpen, LayoutGrid, Plus, Store, Trophy, Users, Settings, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/lobbies")({ component: LobbiesPage });

type Lobby = { id: string; name: string; game: string; maxPlayers: number; createdAt: string };

const nav = [
  ["Dashboard", "/", LayoutGrid], ["Lobbies", "/lobbies", Users], ["Rank", "/rank", Trophy],
  ["Loja", "/loja", Store], ["Pro", "/pro", Star], ["Configurações", "/configuracoes", Settings],
] as const;

function LobbiesPage() {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [name, setName] = useState("Meu lobby");
  const [game, setGame] = useState("VALORANT");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try { setLobbies(JSON.parse(localStorage.getItem("grind:lobbies") || "[]")); } catch { setLobbies([]); }
  }, []);
  useEffect(() => { localStorage.setItem("grind:lobbies", JSON.stringify(lobbies)); }, [lobbies]);

  const active = useMemo(() => lobbies[0], [lobbies]);
  const createLobby = () => {
    const id = `GL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setLobbies((old) => [{ id, name: name.trim() || "Meu lobby", game, maxPlayers: 8, createdAt: new Date().toISOString() }, ...old]);
    setMessage(`Lobby ${id} criado neste dispositivo.`);
  };
  const joinLobby = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return setMessage("Digite um código de lobby.");
    setMessage(`Código ${code} validado localmente. A entrada multiusuário será concluída quando o serviço de lobby estiver conectado.`);
  };
  const copyInvite = async (id: string) => {
    const url = `${location.origin}/lobbies?join=${encodeURIComponent(id)}`;
    await navigator.clipboard.writeText(url);
    setMessage("Link de convite copiado.");
  };

  return <div className="min-h-screen bg-background text-foreground"><div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-6">
    <aside className="hidden w-56 shrink-0 lg:block"><div className="panel sticky top-6 p-4"><img src="/favicon.png" alt="GrindLobby" className="mx-auto h-14 w-14 object-contain"/><nav className="mt-5 space-y-1">{nav.map(([label,to,Icon]) => <Link key={label} to={to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${to==="/lobbies"?"bg-primary/15 text-primary-glow":"text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon className="h-4 w-4"/>{label}</Link>)}</nav></div></aside>
    <main className="min-w-0 flex-1 space-y-5"><header><p className="label-caps">GrindLobby</p><h1 className="font-display text-3xl font-bold">Lobbies</h1><p className="mt-1 text-sm text-muted-foreground">Crie, organize e compartilhe lobbies. Dados locais são persistidos no navegador até a API multiusuário ser conectada.</p></header>
      <section className="grid gap-4 xl:grid-cols-2"><div className="panel p-5"><h2 className="font-semibold">Criar lobby</h2><div className="mt-4 grid gap-3"><input value={name} onChange={e=>setName(e.target.value)} className="rounded-lg border border-border bg-panel px-3 py-2" placeholder="Nome do lobby"/><select value={game} onChange={e=>setGame(e.target.value)} className="rounded-lg border border-border bg-panel px-3 py-2"><option>VALORANT</option><option>EA FC 27</option><option>CS2</option><option>Outro</option></select><button onClick={createLobby} className="btn-primary flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold"><Plus className="h-4 w-4"/>Criar lobby</button></div></div>
      <div className="panel p-5"><h2 className="font-semibold">Entrar com código</h2><div className="mt-4 flex gap-2"><input value={joinCode} onChange={e=>setJoinCode(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-panel px-3 py-2 uppercase" placeholder="GL-XXXXXX"/><button onClick={joinLobby} className="btn-ghost rounded-lg px-4 py-2"><DoorOpen className="h-4 w-4"/></button></div>{message&&<p className="mt-3 text-xs text-muted-foreground">{message}</p>}</div></section>
      <section className="panel p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Seus lobbies</h2><span className="text-xs text-muted-foreground">{lobbies.length} salvos</span></div>{!lobbies.length?<p className="mt-5 text-sm text-muted-foreground">Nenhum lobby criado neste dispositivo.</p>:<div className="mt-4 grid gap-3">{lobbies.map(l=><div key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-panel/60 p-4"><div><p className="font-semibold">{l.name}</p><p className="text-xs text-muted-foreground">{l.game} · {l.id} · até {l.maxPlayers} jogadores</p></div><button onClick={()=>copyInvite(l.id)} className="btn-ghost ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm"><Copy className="h-4 w-4"/>Copiar convite</button></div>)}</div>}</section>
      {active&&<p className="text-xs text-muted-foreground">Lobby ativo local: {active.id}</p>}
    </main></div></div>;
}

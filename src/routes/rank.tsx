import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutGrid, Settings, Star, Store, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/rank")({ component: RankPage });

const nav = [["Dashboard", "/", LayoutGrid], ["Lobbies", "/lobbies", Users], ["Rank", "/rank", Trophy], ["Loja", "/loja", Store], ["Pro", "/pro", Star], ["Configurações", "/configuracoes", Settings]] as const;

type LeaderboardRow = {
  id: string;
  name: string;
  game: string;
  rating: number;
  matches: number;
  wins: number;
};

type LeaderboardDbRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  favorite_game: string | null;
  competitive_points: number | string | null;
  matches_played: number | null;
  matches_won: number | null;
};

function RankPage() {
  const [game, setGame] = useState("Todos");
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("leaderboard_profiles")
        .select("id,display_name,username,favorite_game,competitive_points,matches_played,matches_won")
        .gt("matches_played", 0)
        .order("competitive_points", { ascending: false })
        .limit(100);

      if (!active) return;
      if (loadError) {
        setError("Não foi possível carregar o ranking agora.");
        setPlayers([]);
      } else {
        setError("");
        setPlayers(
          ((data || []) as LeaderboardDbRow[]).map((row) => ({
            id: row.id,
            name: row.display_name || row.username || "Jogador",
            game: row.favorite_game || "Outro",
            rating: Number(row.competitive_points || 0),
            matches: row.matches_played || 0,
            wins: row.matches_won || 0,
          })),
        );
      }
      setLoading(false);
    };

    void load();
    const channel = supabase
      .channel("rank-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void load())
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const games = useMemo(
    () => ["Todos", ...Array.from(new Set(players.map((player) => player.game))).sort()],
    [players],
  );

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return players.filter(
      (player) =>
        (game === "Todos" || player.game === game) &&
        (!normalizedQuery || player.name.toLowerCase().includes(normalizedQuery)),
    );
  }, [players, game, query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="panel sticky top-6 p-4">
            <img src="/grindlobby-logo.png" alt="GrindLobby" className="mx-auto h-14 w-14 object-contain" />
            <nav className="mt-5 space-y-1">
              {nav.map(([label, to, Icon]) => (
                <Link key={label} to={to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${to === "/rank" ? "bg-primary/15 text-primary-glow" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
        <main className="min-w-0 flex-1 space-y-5">
          <header>
            <p className="label-caps">Competitivo</p>
            <h1 className="font-display text-3xl font-bold">Rank</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ranking alimentado por partidas confirmadas no GrindLobby.</p>
          </header>
          <section className="panel p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jogador" className="rounded-lg border border-border bg-panel px-3 py-2" />
              <select value={game} onChange={(event) => setGame(event.target.value)} className="rounded-lg border border-border bg-panel px-3 py-2">
                {games.map((value) => <option key={value}>{value}</option>)}
              </select>
            </div>
            {loading ? (
              <p className="mt-5 text-sm text-muted-foreground">Carregando ranking real...</p>
            ) : error ? (
              <p className="mt-5 text-sm text-destructive">{error}</p>
            ) : (
              <>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                      <tr><th className="py-2">#</th><th>Jogador</th><th>Jogo</th><th>Rating</th><th>W/L</th><th>Win rate</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((player, index) => {
                        const losses = Math.max(0, player.matches - player.wins);
                        const winRate = player.matches ? Math.round((player.wins / player.matches) * 100) : 0;
                        return (
                          <tr key={player.id} className="border-t border-border">
                            <td className="py-3 font-display font-bold">{index + 1}</td>
                            <td className="font-semibold">{player.name}</td>
                            <td>{player.game}</td>
                            <td className="text-primary-glow">{player.rating}</td>
                            <td>{player.wins}/{losses}</td>
                            <td>{winRate}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!rows.length && <p className="mt-5 text-sm text-muted-foreground">Ainda não há partidas reais suficientes para este filtro.</p>}
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

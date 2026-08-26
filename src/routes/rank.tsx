import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutGrid, Settings, Star, Store, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/rank")({ component: RankPage });

const nav = [["Dashboard","/",LayoutGrid],["Lobbies","/lobbies",Users],["Rank","/rank",Trophy],["Loja","/loja",Store],["Pro","/pro",Star],["Configurações","/configuracoes",Settings]] as const;
const players = [
  {name:"juan",game:"VALORANT",rating:1842,wins:38,losses:14},
  {name:"PedroFPS",game:"VALORANT",rating:1794,wins:34,losses:18},
  {name:"DGZ",game:"CS2",rating:1712,wins:29,losses:17},
  {name:"LucasZ",game:"EA FC 27",rating:1688,wins:27,losses:13},
  {name:"Maysa",game:"VALORANT",rating:1621,wins:22,losses:16},
];

function RankPage(){
  const [game,setGame]=useState("Todos"); const [query,setQuery]=useState("");
  const data=useMemo(()=>players.filter(p=>(game==="Todos"||p.game===game)&&p.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.rating-a.rating),[game,query]);
  return <div className="min-h-screen bg-background text-foreground"><div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-6"><aside className="hidden w-56 shrink-0 lg:block"><div className="panel sticky top-6 p-4"><img src="/favicon.png" alt="GrindLobby" className="mx-auto h-14 w-14 object-contain"/><nav className="mt-5 space-y-1">{nav.map(([label,to,Icon])=><Link key={label} to={to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${to==="/rank"?"bg-primary/15 text-primary-glow":"text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Icon className="h-4 w-4"/>{label}</Link>)}</nav></div></aside><main className="min-w-0 flex-1 space-y-5"><header><p className="label-caps">Competitivo</p><h1 className="font-display text-3xl font-bold">Rank</h1><p className="mt-1 text-sm text-muted-foreground">Ranking da camada web atual. A origem destes dados ainda é local e será substituída pela API competitiva.</p></header><section className="panel p-5"><div className="grid gap-3 md:grid-cols-[1fr_220px]"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar jogador" className="rounded-lg border border-border bg-panel px-3 py-2"/><select value={game} onChange={e=>setGame(e.target.value)} className="rounded-lg border border-border bg-panel px-3 py-2"><option>Todos</option><option>VALORANT</option><option>CS2</option><option>EA FC 27</option></select></div><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2">#</th><th>Jogador</th><th>Jogo</th><th>Rating</th><th>W/L</th><th>Win rate</th></tr></thead><tbody>{data.map((p,i)=>{const total=p.wins+p.losses; return <tr key={p.name} className="border-t border-border"><td className="py-3 font-display font-bold">{i+1}</td><td className="font-semibold">{p.name}</td><td>{p.game}</td><td className="text-primary-glow">{p.rating}</td><td>{p.wins}/{p.losses}</td><td>{Math.round(p.wins/total*100)}%</td></tr>})}</tbody></table></div>{!data.length&&<p className="mt-5 text-sm text-muted-foreground">Nenhum jogador encontrado.</p>}</section></main></div></div>;
}

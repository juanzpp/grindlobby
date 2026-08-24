import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Headphones,
  LogIn,
  Mic,
  Music2,
  Plus,
  Radio,
} from "lucide-react";
import { useEffect, useState } from "react";
import { activityFeed, me, myLevel, myXp, myXpMax, users } from "@/data/mock";
import { useApp } from "@/lib/app-state";
import { AvatarStack } from "@/components/app/avatar-stack";
import { CreateLobbyDialog } from "@/components/app/create-lobby-dialog";
import { LobbyRow } from "@/components/app/lobby-row";
import { SectionHeader } from "@/components/app/section-header";
import { UserAvatar } from "@/components/app/user-avatar";
import { VoiceActivity } from "@/components/app/voice-activity";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — GrindLobby" },
      { name: "description", content: "Sua central diária: lobbies recentes, call ativa, amigos online e acesso rápido a voz, transmissão e música." },
      { property: "og:title", content: "Dashboard — GrindLobby" },
      { property: "og:description", content: "Sua central diária de lobbies, voz e comunidade." },
    ],
  }),
  component: Dashboard,
});

const quickAccess = [
  { icon: Mic, title: "Voice & Chat", desc: "Caia direto na Sala Geral", action: "voice" as const },
  { icon: Radio, title: "Transmitir", desc: "Compartilhe sua tela com o lobby", action: "stream" as const },
  { icon: Music2, title: "Música", desc: "Sua trilha de grind tocando", action: "music" as const },
];

function CallTimer({ startedAt }: { startedAt: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return <span className="text-[11px] font-semibold text-success tabular-nums">{m}:{s.toString().padStart(2, "0")}</span>;
}

function ActiveCallCard() {
  const { call, toggleMute, toggleDeafen, leaveCall } = useApp();
  const participants = [me, users[1], users[4], users[8]];
  if (!call.active) return <div className="panel p-4 text-center"><p className="text-sm font-semibold text-foreground">Nenhuma call ativa</p><p className="mt-1 text-xs text-muted-foreground">Entre em um lobby para conversar.</p></div>;
  return <div className="panel glow-soft p-4"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="animate-pulse-dot h-2 w-2 rounded-full bg-success"/><p className="truncate text-[13px] font-semibold text-foreground">{call.lobbyName}</p></div>{call.startedAt && <CallTimer startedAt={call.startedAt}/>}</div><div className="space-y-2">{participants.map((u,i)=><div key={u.id} className="flex items-center gap-2.5"><UserAvatar user={u} size="xs"/><span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{u.id === "me" ? "Você" : u.name}</span><VoiceActivity speaking={i===1} muted={u.id==="me" ? call.muted : i===3}/></div>)}</div><div className="mt-4 flex items-center justify-center gap-2"><Button size="icon" variant={call.muted?"destructive":"secondary"} className="h-9 w-9 rounded-full" onClick={toggleMute}><Mic className="h-4 w-4"/></Button><Button size="icon" variant={call.deafened?"destructive":"secondary"} className="h-9 w-9 rounded-full" onClick={toggleDeafen}><Headphones className="h-4 w-4"/></Button><Button size="icon" variant="secondary" className="h-9 w-9 rounded-full text-destructive" onClick={leaveCall}><LogIn className="h-4 w-4 rotate-180"/></Button></div></div>;
}

function Dashboard() {
  const navigate = useNavigate();
  const { lobbies, friends, joinLobby, togglePlay, playing } = useApp();
  const recent = lobbies.slice(0,5);
  const online = friends.filter((f)=>f.relation === "friend" && f.status !== "offline");
  const xpPct = Math.round((myXp/myXpMax)*100);
  const quick = (action:"voice"|"stream"|"music") => {
    if(action==="voice") joinLobby(lobbies.find((l)=>l.id==="l2") ?? lobbies[0]);
    if(action==="stream") navigate({to:"/settings"});
    if(action==="music") togglePlay();
  };
  return <div className="flex h-full min-h-0"><div className="min-w-0 flex-1 overflow-y-auto p-6"><header className="mb-6"><h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Boa noite, {me.name}.</h1><p className="mt-1 text-sm text-muted-foreground">Sua central de grind — escolha por onde começar.</p></header><div className="mb-4 grid gap-3 sm:grid-cols-2"><CreateLobbyDialog trigger={<button className="group banner-violet glow-soft flex items-center gap-4 rounded-xl border border-primary/25 p-4 text-left"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary"><Plus className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">Criar lobby</span><span className="block text-xs text-muted-foreground">Sala nova em segundos</span></span><ArrowRight className="h-4 w-4"/></button>}/><button onClick={()=>navigate({to:"/lobbies"})} className="group panel flex items-center gap-4 p-4 text-left"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><LogIn className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">Entrar em lobby</span><span className="block text-xs text-muted-foreground">Veja quem já está jogando</span></span></button></div><div className="mb-8 grid gap-3 sm:grid-cols-3">{quickAccess.map((q)=><button key={q.title} onClick={()=>quick(q.action)} className="panel flex items-center gap-3 p-3.5 text-left"><q.icon className="h-4 w-4 text-primary"/><span><span className="block text-[13px] font-semibold">{q.title}{q.action==="music"&&playing?" •":null}</span><span className="block text-[11px] text-muted-foreground">{q.desc}</span></span></button>)}</div><SectionHeader title="Lobbies recentes" description="De volta à ação em um clique"/><div className="space-y-2">{recent.map((lobby)=><LobbyRow key={lobby.id} lobby={lobby}/>)}</div><div className="panel mt-8 flex items-center gap-4 p-4"><span className="font-display text-lg font-bold text-primary">Nv. {myLevel}</span><div className="min-w-0 flex-1"><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{width:`${xpPct}%`}}/></div></div><span className="text-xs text-muted-foreground">{myXp.toLocaleString("pt-BR")} / {myXpMax.toLocaleString("pt-BR")} XP</span></div></div><aside className="hidden w-80 shrink-0 space-y-6 overflow-y-auto border-l border-border bg-sidebar/50 p-5 xl:block"><section><SectionHeader title="Atividade"/>{activityFeed.map((a)=><div key={a.id} className="flex items-start gap-2.5"><UserAvatar user={a.user} size="xs"/><p className="text-xs"><b>{a.user.name}</b> {a.text}</p></div>)}</section><section><SectionHeader title="Call ativa"/><ActiveCallCard/></section><section><SectionHeader title="Amigos online"/><div className="space-y-1">{online.slice(0,6).map((f)=><button key={f.id} onClick={()=>navigate({to:"/messages"})} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5"><UserAvatar user={f} size="sm" withStatus/><span className="truncate text-[13px]">{f.name}</span></button>)}</div><div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"><span className="text-[11px] text-muted-foreground">Na call agora</span><AvatarStack users={users.slice(0,4)} max={4}/></div></section></aside></div>;
}

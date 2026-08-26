import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Crown,
  Gift,
  Globe,
  Info,
  LayoutGrid,
  LogOut,
  MonitorUp,
  Mic,
  MicOff,
  MoreVertical,
  Pencil,
  Plus,
  Server,
  Settings,
  ShoppingCart,
  SignalHigh,
  Sparkle,
  Star,
  Store,
  Trophy,
  Users,
  UserPlus,
  Video,
  Volume2,
  Wifi,
  Activity,
  Monitor,
} from "lucide-react";

import { useState } from "react";

import logo from "@/assets/grindlobby-logo.png.asset.json";
import { EventTicker } from "@/components/EventTicker";
import { LevelHero } from "@/components/LevelHero";
import { MusicBot } from "@/components/MusicBot";
import { PingBar } from "@/components/PingBar";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ProfileSettings } from "@/components/ProfileSettings";
import { StoreSection } from "@/components/StoreSection";
import { TopElos } from "@/components/TopElos";
import { PlayerProvider, usePlayer, findItem } from "@/lib/player-store";
import { getTier } from "@/lib/levels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GrindLobby — Dashboard de lobbies e rank competitivo" },
      {
        name: "description",
        content:
          "Acompanhe seu rank, gerencie lobbies com áudio e tela compartilhada, e participe de campeonatos no GrindLobby.",
      },
      { property: "og:title", content: "GrindLobby — Dashboard competitivo" },
      {
        property: "og:description",
        content:
          "Rank, lobbies, loja e eventos em um único painel para jogadores competitivos.",
      },
    ],
  }),
  component: Dashboard,
});

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", active: true, to: "/" as const },
  { icon: Users, label: "Lobbies", to: "/lobbies" as const },
  { icon: Trophy, label: "Rank", to: "/rank" as const },
  { icon: Store, label: "Loja", to: "/loja" as const },
  { icon: Star, label: "Pro", to: "/pro" as const },
  { icon: Settings, label: "Configurações", to: "/configuracoes" as const },
];

const activity = [
  { name: "PedroFPS", text: "entrou no lobby", time: "há 2 min" },
  { name: "DGZ", text: "transmitiu a tela", time: "há 5 min" },
  { name: "Você", text: "alterou as permissões", time: "há 12 min" },
  { name: "Lucas", text: "conectou no lobby", time: "há 18 min" },
];

const members = [
  { name: "juan", handle: "@juanzin", role: "HOST", host: true, muted: false },
  { name: "PedroFPS", handle: "@pedrofps", role: "MEMBRO", host: false, muted: false },
  { name: "LucasZ", handle: "@lucasz", role: "MEMBRO", host: false, muted: false },
  { name: "DGZ", handle: "@dgzfps", role: "MEMBRO", host: false, muted: true },
  { name: "Maysa", handle: "@maysaa", role: "MEMBRO", host: false, muted: false },
];

const events = [
  {
    day: "24",
    month: "MAI",
    title: "Copa GrindLobby",
    sub: "Campeonato oficial",
    cta: "Inscrever-se",
    soon: false,
  },
  {
    day: "01",
    month: "JUN",
    title: "Torneio 5v5",
    sub: "Premiação em dinheiro",
    cta: "Inscrever-se",
    soon: false,
  },
  {
    day: "15",
    month: "JUN",
    title: "Night Cup",
    sub: "Somente convidados",
    cta: "Em breve",
    soon: true,
  },
];

function Waveform({ bars = 22, active = true }: { bars?: number; active?: boolean }) {
  return (
    <div className="flex items-end gap-[2px]" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-[2px] rounded-full ${
            active && i < bars * 0.55 ? "bg-primary-glow" : "bg-muted"
          }`}
          style={{ height: `${6 + ((i * 7) % 12)}px` }}
        />
      ))}
    </div>
  );
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow font-display text-xs font-bold text-primary-foreground"
      style={{ width: size, height: size }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
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
  const tier = getTier(player.level);
  const title = findItem(player.equipped.title)?.label;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-border bg-card/60 px-5 py-6 lg:flex">
          <div>
            <div className="flex flex-col items-center gap-3 pb-8">
              <img
                src={logo.url}
                alt="Emblema GrindLobby"
                width={512}
                height={512}
                className="h-16 w-16 object-contain drop-shadow-[0_0_18px_oklch(0.5_0.22_302/0.7)]"
              />
              <p className="font-display text-2xl font-bold italic tracking-tight">
                GRIND<span className="text-primary-glow">LOBBY</span>
              </p>
            </div>

            <nav className="space-y-1">
              {navItems.map(({ icon: Icon, label, active, to }) => (
                <Link
                  key={label}
                  to={to}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "border border-primary/40 bg-primary/15 text-foreground shadow-[0_0_20px_oklch(0.58_0.24_300/0.25)]"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="mt-6 space-y-2">
              <Link to="/lobbies" className="btn-primary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold">
                <Plus className="h-4 w-4" /> Criar lobby
              </Link>
              <Link to="/lobbies" className="btn-ghost flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium">
                <UserPlus className="h-4 w-4" /> Convidar amigos
              </Link>
            </div>

            <div className="mt-8">
              <p className="label-caps">Atividade recente</p>
              <ul className="mt-3 space-y-3">
                {activity.map((a) => (
                  <li key={a.name + a.time} className="flex items-start gap-2.5">
                    <Avatar name={a.name} size={28} />
                    <div className="text-xs leading-tight">
                      <p>
                        <span className="font-semibold">{a.name}</span>{" "}
                        <span className="text-muted-foreground">{a.text}</span>
                      </p>
                      <p className="mt-0.5 text-muted-foreground">{a.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <button
            onClick={() => setProfileOpen(true)}
            className="mt-8 flex w-full items-center gap-3 rounded-xl border border-border bg-panel p-3 text-left transition-colors hover:border-primary/40"
          >
            <ProfileAvatar name={player.nickname} size={40} borderId={player.equipped.border} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {player.nickname}
                {title && (
                  <span className="rounded border border-primary/50 bg-primary/15 px-1 text-[9px] font-bold text-primary-glow">
                    {title}
                  </span>
                )}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Level {player.level} • {tier.name}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] capitalize text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> {player.status}
              </p>
            </div>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </button>
        </aside>

        <main className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
          <header className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Crown className="h-4 w-4 text-primary-glow" />
              <span className="font-semibold">Admin ativo</span>
              <span className="text-muted-foreground">•</span>
              <span className="font-semibold text-primary-glow">PRO liberado gratuitamente</span>
              <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
              <span className="text-muted-foreground">juannsiilvah@gmail.com</span>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <Gift className="h-5 w-5" />
              <span className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
              </span>
              <SignalHigh className="h-5 w-5 text-success" />
            </div>
          </header>

          <EventTicker />
          <TopElos />
          <LevelHero onOpenProfile={() => setProfileOpen(true)} />

          <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <section className="panel p-5">
              <p className="label-caps">Lobby atual</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-2xl font-bold">GrindLobby #27</h2>
                    <Pencil className="h-4 w-4 text-primary-glow" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1.5 rounded-md border border-border bg-panel px-2 py-1"><Globe className="h-3.5 w-3.5" /> Pública</span>
                    <span className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-2 py-1"><Trophy className="h-3.5 w-3.5 text-warning" /> Competitiva</span>
                    <span className="flex items-center gap-1.5 rounded-md border border-border bg-panel px-2 py-1"><Sparkle className="h-3.5 w-3.5 text-primary-glow" /> EA FC 27</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2"><Avatar name="juan" size={34} /><div className="text-xs"><p className="text-muted-foreground">Host</p><p className="flex items-center gap-1 font-semibold">juan <Crown className="h-3.5 w-3.5 text-warning" /></p></div></div>
                  <p className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-muted-foreground" /><span className="font-semibold">5</span><span className="text-muted-foreground">/ 8</span></p>
                  <Link to="/lobbies" className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"><UserPlus className="h-4 w-4" /> Convidar</Link>
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-border bg-panel/50 p-3">
                <p className="label-caps px-1">Membros (5/8)</p>
                <ul className="mt-2 divide-y divide-border">
                  {members.map((m) => (
                    <li key={m.handle} className="flex items-center gap-3 px-1 py-2.5 text-sm">
                      <span className="relative"><Avatar name={m.name} size={32} /><span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-panel bg-success" /></span>
                      <div className="min-w-0"><p className="flex items-center gap-1.5 font-semibold">{m.name}{m.host && <Crown className="h-3.5 w-3.5 text-warning" />}</p><p className="text-xs text-muted-foreground">{m.handle}</p></div>
                      <div className="ml-auto flex items-center gap-3">{m.muted ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4 text-muted-foreground" />}<Waveform bars={14} active={!m.muted} />{m.host ? <span className="rounded-md border border-primary/40 bg-primary/20 px-2 py-1 text-[10px] font-bold tracking-wide">HOST</span> : <span className="label-caps">Membro</span>}<MoreVertical className="h-4 w-4 text-muted-foreground" /></div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Link to="/lobbies" className="btn-ghost flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"><LogOut className="h-4 w-4" /> Sair do lobby</Link>
                <Link to="/lobbies" className="btn-ghost flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"><Settings className="h-4 w-4" /> Gerenciar lobby</Link>
              </div>
            </section>

            <div className="space-y-4">
              <section className="panel p-5">
                <div className="flex items-center justify-between"><p className="label-caps">Controles de áudio</p><Activity className="h-4 w-4 text-primary-glow" /></div>
                <div className="mt-4 space-y-4">
                  <div><p className="text-sm text-muted-foreground">Microfone</p><div className="mt-2 flex items-center gap-3"><Link to="/configuracoes" className="flex flex-1 items-center justify-between rounded-lg border border-border bg-panel px-3 py-2.5 text-sm">Configurar microfone<ChevronDown className="h-4 w-4 text-muted-foreground" /></Link><Waveform /><Link to="/configuracoes" className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-panel"><Mic className="h-4 w-4" /></Link></div></div>
                  <div><p className="text-sm text-muted-foreground">Saída de áudio</p><div className="mt-2 flex items-center gap-3"><Link to="/configuracoes" className="flex flex-1 items-center justify-between rounded-lg border border-border bg-panel px-3 py-2.5 text-sm">Configurar saída<ChevronDown className="h-4 w-4 text-muted-foreground" /></Link><Waveform /><Link to="/configuracoes" className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-panel"><Volume2 className="h-4 w-4" /></Link></div></div>
                  <div className="grid gap-3 sm:grid-cols-2"><Link to="/configuracoes" className="flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-3 text-sm font-medium"><Monitor className="h-4 w-4" /> Compartilhar tela</Link><Link to="/configuracoes" className="btn-primary flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold"><MonitorUp className="h-4 w-4" /> Abrir tela</Link></div>
                </div>
              </section>

              <PingBar />

              <section className="panel p-5">
                <p className="label-caps">Status do sistema</p>
                <ul className="mt-3 space-y-2.5 text-sm">
                  <li className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Video className="h-4 w-4" /> Qualidade da transmissão</span><span className="font-medium">1080p60</span></li>
                  <li className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Wifi className="h-4 w-4" /> Conexão</span><span className="font-medium text-success">Excelente</span></li>
                  <li className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Server className="h-4 w-4" /> Servidores</span><span className="font-medium text-success">Online</span></li>
                </ul>
              </section>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <div className="space-y-4"><MusicBot /><StoreSection /></div>
            <section className="panel p-5">
              <div className="flex items-center justify-between"><p className="label-caps">Próximos eventos</p><Link to="/rank" className="flex items-center gap-1 text-sm text-primary-glow">Ver ranking <ChevronRight className="h-4 w-4" /></Link></div>
              <ul className="mt-4 space-y-3">
                {events.map((e) => (
                  <li key={e.title} className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-primary/40 bg-primary/15"><span className="font-display text-lg font-bold leading-none">{e.day}</span><span className="text-[10px] tracking-wide text-muted-foreground">{e.month}</span></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{e.title}</p><p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5 text-warning" /> {e.sub}</p></div>
                    <button disabled={e.soon} className={`rounded-lg px-3 py-2 text-xs font-semibold ${e.soon ? "cursor-not-allowed border border-border bg-secondary text-muted-foreground" : "border border-primary/40 bg-primary/15 text-foreground"}`}>{e.cta}</button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </main>
      </div>

      {profileOpen && <ProfileSettings onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

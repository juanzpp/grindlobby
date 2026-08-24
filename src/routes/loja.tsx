import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  Check,
  ChevronRight,
  Crown,
  Frame,
  Gift,
  Image as ImageIcon,
  LayoutGrid,
  MessageSquare,
  Package,
  Palette,
  Plus,
  Settings,
  Shield,
  SignalHigh,
  Sparkles,
  Star,
  Store,
  Trophy,
  Users,
  UserPlus,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";

import logo from "@/assets/grindlobby-logo.png.asset.json";
import crate from "@/assets/store-crate.jpg";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SmokeFX } from "@/components/SmokeFX";
import { PlayerProvider, usePlayer } from "@/lib/player-store";
import {
  BUNDLES,
  SHELVES,
  STORE_CATEGORIES,
  type Bundle,
  type CosmeticKind,
  type StoreCategory,
} from "@/lib/store-catalog";

export const Route = createFileRoute("/loja")({
  head: () => ({
    meta: [
      { title: "Loja de Cosméticos — GrindLobby" },
      {
        name: "description",
        content:
          "Bundles, molduras, banners, papéis de parede e efeitos de lobby para personalizar seu perfil no GrindLobby.",
      },
      { property: "og:title", content: "Loja de Cosméticos — GrindLobby" },
      {
        property: "og:description",
        content:
          "Coleções exclusivas para representar seu estilo: molduras, banners, badges, cores de chat e efeitos de lobby.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LojaPage,
});

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", to: "/" as const },
  { icon: Users, label: "Lobbies", to: "/" as const },
  { icon: Trophy, label: "Rank", to: "/" as const },
  { icon: Store, label: "Loja", to: "/loja" as const },
  { icon: Star, label: "Pro", to: "/loja" as const },
  { icon: Settings, label: "Configurações", to: "/" as const },
];

const activity = [
  { name: "PedroFPS", text: "entrou no lobby", time: "há 2 min" },
  { name: "DGZ", text: "transmitiu a tela", time: "há 5 min" },
  { name: "Você", text: "alterou as permissões", time: "há 12 min" },
  { name: "Lucas", text: "conectou no lobby", time: "há 18 min" },
];

const kindIcon: Record<CosmeticKind, typeof Frame> = {
  Moldura: Frame,
  Banner: MessageSquare,
  "Papel de parede": ImageIcon,
  "Badge de perfil": Shield,
  "Cor do chat": Palette,
  "Efeito de lobby": Sparkles,
};

function MiniAvatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow font-display text-[11px] font-bold text-primary-foreground"
      style={{ width: size, height: size }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function BundleArt({ bundle, big = false }: { bundle: Bundle; big?: boolean }) {
  return (
    <div
      className="relative grid place-items-center overflow-hidden rounded-xl"
      style={{
        height: big ? 108 : 84,
        background: `radial-gradient(80% 100% at 50% 100%, ${bundle.accent.replace(')', ' / 0.35)')}, transparent 70%), linear-gradient(160deg, oklch(0.12 0.03 290), oklch(0.05 0.01 285))`,
      }}
    >
      <div
        className="animate-crate-pulse absolute inset-x-6 bottom-0 h-2/3 blur-2xl"
        style={{ background: `radial-gradient(60% 100% at 50% 100%, ${bundle.glow}, transparent 72%)` }}
      />
      <img
        src={logo.url}
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={512}
        height={512}
        className="relative h-12 w-12 object-contain"
        style={{ filter: `drop-shadow(0 0 14px ${bundle.glow})` }}
      />
      {[-1, 1].map((s) => (
        <span
          key={s}
          className="absolute top-1/2 h-16 w-[2px] blur-[2px]"
          style={{
            left: `${50 + s * 22}%`,
            background: `linear-gradient(180deg, transparent, ${bundle.glow}, transparent)`,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

function LojaPage() {
  return (
    <PlayerProvider>
      <LojaInner />
    </PlayerProvider>
  );
}

function LojaInner() {
  const { player } = usePlayer();
  const [category, setCategory] = useState<StoreCategory>("Bundles");
  const [selected, setSelected] = useState<string>("competitive");
  const [equipped, setEquipped] = useState<string | null>(null);

  const bundle = useMemo(
    () => BUNDLES.find((b) => b.id === selected) ?? BUNDLES[0]!,
    [selected],
  );

  const shelves =
    category === "Bundles"
      ? SHELVES
      : SHELVES.map((s) => ({
          ...s,
          items: s.items.filter((i) =>
            category === "Molduras"
              ? i.kind === "Moldura"
              : category === "Banners"
                ? i.kind === "Banner"
                : category === "Papéis de parede"
                  ? i.kind === "Papel de parede"
                  : i.kind === "Efeito de lobby" || i.kind === "Badge de perfil",
          ),
        }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* Sidebar */}
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
              {navItems.map(({ icon: Icon, label, to }) => (
                <Link
                  key={label}
                  to={to}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    label === "Loja"
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
              <button className="btn-primary flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold">
                <Plus className="h-4 w-4" /> Criar lobby
              </button>
              <button className="btn-ghost flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium">
                <UserPlus className="h-4 w-4" /> Convidar amigos
              </button>
            </div>

            <div className="mt-8">
              <p className="label-caps">Atividade recente</p>
              <ul className="mt-3 space-y-3">
                {activity.map((a) => (
                  <li key={a.name + a.time} className="flex items-start gap-2.5">
                    <MiniAvatar name={a.name} />
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

          <button className="btn-ghost mt-8 w-full rounded-lg px-3 py-2.5 text-sm font-medium">
            Ver todas atividades
          </button>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
          <header className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Crown className="h-4 w-4 text-primary-glow" />
              <span className="font-semibold">Admin ativo</span>
              <span className="text-muted-foreground">•</span>
              <span className="font-semibold text-primary-glow">
                PRO liberado gratuitamente
              </span>
              <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
              <span className="text-muted-foreground">{player.email}</span>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs">
                <Package className="h-4 w-4 text-primary-glow" />
                <span className="leading-tight">
                  <span className="block font-semibold text-foreground">128</span>
                  itens liberados
                </span>
              </span>
              <Gift className="h-5 w-5" />
              <span className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  2
                </span>
              </span>
              <SignalHigh className="h-5 w-5 text-success" />
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-4">
              <div>
                <h1 className="font-display text-3xl font-bold">Loja de Cosméticos</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Personalize seu perfil e destaque-se no GrindLobby.
                </p>
              </div>

              {/* Categorias */}
              <div className="flex flex-wrap gap-2">
                {STORE_CATEGORIES.map((c) => {
                  const Icon =
                    c === "Bundles"
                      ? Package
                      : c === "Molduras"
                        ? Frame
                        : c === "Banners"
                          ? MessageSquare
                          : c === "Papéis de parede"
                            ? ImageIcon
                            : c === "Efeitos"
                              ? Wand2
                              : Star;
                  return (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        category === c
                          ? "border border-primary/50 bg-primary/20 text-foreground shadow-[0_0_18px_oklch(0.58_0.24_300/0.25)]"
                          : "border border-border bg-panel text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {c}
                    </button>
                  );
                })}
              </div>

              {/* Banner da caixa com fumaça */}
              <section className="relative overflow-hidden rounded-2xl border border-primary/25">
                <img
                  src={crate}
                  alt="Caixa de cosméticos GrindLobby envolta em névoa violeta"
                  width={1600}
                  height={640}
                  className="animate-crate-float h-[210px] w-full object-cover md:h-[240px]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.04_0.01_285/0.95),oklch(0.04_0.01_285/0.55)_46%,transparent_78%)]" />
                <SmokeFX originX={72} />
                <div className="absolute inset-y-0 left-0 flex max-w-[58%] flex-col justify-center gap-2 p-6 md:p-8">
                  <h2 className="font-display text-2xl font-bold leading-tight md:text-3xl">
                    Coleções exclusivas para
                    <br />
                    representar seu estilo.
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Todos os itens disponíveis para admins.
                  </p>
                </div>
              </section>

              {/* Bundles em destaque */}
              <section>
                <p className="label-caps flex items-center gap-2">
                  <Crown className="h-3.5 w-3.5 text-warning" /> Bundles em destaque
                </p>
                <div className="relative mt-3">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                    {BUNDLES.map((b) => {
                      const active = b.id === selected;
                      return (
                        <article
                          key={b.id}
                          onClick={() => setSelected(b.id)}
                          className={`group relative cursor-pointer rounded-2xl border p-3 transition-all duration-200 hover:-translate-y-1 ${
                            active
                              ? "border-primary/60 bg-primary/10"
                              : "border-border bg-card/70 hover:border-primary/40"
                          }`}
                          style={
                            active
                              ? { boxShadow: `0 0 26px ${b.glow.replace(")", " / 0.35)")}` }
                              : undefined
                          }
                        >
                          {active && (
                            <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                          <BundleArt bundle={b} />
                          <h3 className="mt-3 text-center text-sm font-semibold">{b.name}</h3>
                          <p className="text-center text-[11px] text-muted-foreground">
                            6 itens inclusos
                          </p>
                          <ul className="mt-3 space-y-1.5">
                            {b.items.map((it) => {
                              const Icon = kindIcon[it.kind];
                              return (
                                <li
                                  key={it.kind}
                                  className="flex items-center gap-2 text-[11px] text-muted-foreground"
                                >
                                  <Icon className="h-3 w-3" /> {it.kind}
                                </li>
                              );
                            })}
                          </ul>
                          <p className="mt-3 text-center">
                            <span className="rounded-md border border-success/40 bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                              Liberado
                            </span>
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(b.id);
                              setEquipped(b.id);
                            }}
                            className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                              equipped === b.id
                                ? "btn-primary"
                                : "border border-primary/40 bg-primary/10 hover:bg-primary/20"
                            }`}
                          >
                            {equipped === b.id ? "Equipado" : "Equipar"}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                  <button
                    aria-label="Próximos bundles"
                    className="absolute -right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-panel text-muted-foreground hover:text-foreground 2xl:grid"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </section>

              {/* Prateleiras */}
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {shelves.map((shelf) => (
                  <section key={shelf.title} className="panel p-4">
                    <div className="flex items-center justify-between">
                      <p className="label-caps">{shelf.title}</p>
                      <button className="text-[11px] font-semibold text-primary-glow hover:underline">
                        Ver todos
                      </button>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {shelf.items.length === 0 && (
                        <li className="text-xs text-muted-foreground">
                          Nenhum item nesta categoria.
                        </li>
                      )}
                      {shelf.items.map((item) => {
                        const Icon = kindIcon[item.kind];
                        return (
                          <li
                            key={item.id}
                            className="group flex items-center gap-2.5 rounded-lg border border-transparent p-1.5 transition-colors hover:border-primary/30 hover:bg-primary/5"
                          >
                            <span
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                              style={{
                                background: `radial-gradient(70% 70% at 50% 100%, ${item.accent.replace(')', ' / 0.45)')}, oklch(0.1 0.02 288))`,
                                boxShadow: `0 0 14px ${item.accent.replace(")", " / 0.3)")}`,
                              }}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold">{item.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {item.kind}
                              </p>
                            </div>
                            <button className="shrink-0 rounded-md border border-border bg-panel px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-foreground">
                              Equipar
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </div>

            {/* Pré-visualização do bundle */}
            <aside className="panel h-fit p-4 xl:sticky xl:top-6">
              <p className="label-caps">Pré-visualização do bundle</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold">{bundle.name}</h2>
                <span className="rounded-md border border-success/40 bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                  Liberado
                </span>
              </div>

              <div className="relative mt-3 overflow-hidden rounded-xl border border-border">
                <BundleArt bundle={bundle} big />
                <div
                  className="absolute inset-x-3 bottom-3 h-9 rounded-lg border"
                  style={{
                    borderColor: bundle.glow,
                    boxShadow: `0 0 18px ${bundle.glow.replace(")", " / 0.5)")} inset, 0 0 20px ${bundle.glow.replace(")", " / 0.35)")}`,
                  }}
                />
              </div>

              <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-panel/60 p-3">
                <ProfileAvatar
                  name={player.nickname}
                  size={46}
                  borderId={player.equipped.border}
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {player.nickname}
                    <Crown className="h-3.5 w-3.5 text-warning" />
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    @{player.handle}{" "}
                    <span className="rounded border border-primary/50 bg-primary/15 px-1 text-[9px] font-bold text-primary-glow">
                      ADMIN
                    </span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Online no
                    GrindLobby
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-6 gap-1.5">
                {bundle.items.map((it) => {
                  const Icon = kindIcon[it.kind];
                  return (
                    <span
                      key={it.kind}
                      title={it.kind}
                      className="grid h-8 place-items-center rounded-lg border border-border bg-panel text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  );
                })}
              </div>

              <p className="label-caps mt-4">Itens inclusos</p>
              <ul className="mt-2 space-y-2">
                {bundle.items.map((it) => {
                  const Icon = kindIcon[it.kind];
                  return (
                    <li key={it.kind} className="flex items-center gap-2.5">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                        style={{
                          background: `radial-gradient(70% 70% at 50% 100%, ${bundle.accent.replace(')', ' / 0.45)')}, oklch(0.1 0.02 288))`,
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{it.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{it.kind}</p>
                      </div>
                      <span className="rounded-md border border-success/40 bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">
                        Liberado
                      </span>
                    </li>
                  );
                })}
              </ul>

              <button
                onClick={() => setEquipped(bundle.id)}
                className="btn-primary mt-4 w-full rounded-lg px-4 py-3 text-sm font-semibold"
              >
                {equipped === bundle.id ? "Bundle equipado" : "Equipar bundle"}
              </button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Todos os itens serão aplicados ao seu perfil.
              </p>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

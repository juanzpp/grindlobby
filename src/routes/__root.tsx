import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { UserPresenceHeartbeat } from "../components/UserPresenceHeartbeat";
import { callSession } from "../lib/call-session";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "../lib/supabase";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">A página que você procura não existe ou foi movida.</p>
        <div className="mt-6">
          <Link to="/" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Esta página não carregou</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ocorreu um erro. Você pode tentar novamente ou voltar ao início.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
          <a href="/" className="rounded-md border border-input px-4 py-2 text-sm font-medium">
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: "/brand-fix.css?v=2" },
      { rel: "stylesheet", href: "/mobile.css?v=1" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,600;0,700;1,700&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/grindlobby-logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function MobileDock() {
  const location = useLocation();
  if (location.pathname === "/login" || location.pathname === "/loading" || location.pathname.startsWith("/sala/")) {
    return null;
  }
  const items = [
    ["Dashboard", "/"],
    ["Lobbies", "/lobbies"],
    ["Rank", "/rank"],
    ["Loja", "/loja"],
    ["Config", "/configuracoes"],
  ] as const;
  return (
    <nav className="mobile-dock" aria-label="Navegação mobile">
      {items.map(([label, to]) => (
        <Link key={to} to={to} data-active={location.pathname === to || (to !== "/" && location.pathname.startsWith(to)) ? "true" : "false"}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

function ActiveCallPresence() {
  const location = useLocation();
  const snap = useSyncExternalStore(callSession.subscribe, () => callSession.snapshot, () => callSession.snapshot);

  useEffect(() => {
    if (!snap.lobbyId) return;
    let stopped = false;
    let timer: number | undefined;
    let lobbyDbId: string | null = null;
    let userId: string | null = null;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (stopped || !user) return;
      userId = user.id;
      const { data: lobby } = await supabase
        .from("lobbies")
        .select("id,status")
        .eq("route_code", snap.lobbyId)
        .maybeSingle();
      if (!lobby) return;
      lobbyDbId = lobby.id;
      await supabase.from("lobbies").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", lobby.id);
      const beat = async () => {
        await supabase.from("lobby_members").upsert(
          {
            lobby_id: lobby.id,
            user_id: user.id,
            role: "member",
            joined_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "lobby_id,user_id" },
        );
      };
      await beat();
      timer = window.setInterval(() => void beat(), 20000);
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (lobbyDbId && userId) {
        const lid = lobbyDbId;
        const uid = userId;
        void (async () => {
          if (callSession.snapshot.lobbyId === snap.lobbyId) return;
          await supabase.from("lobby_members").delete().eq("lobby_id", lid).eq("user_id", uid);
          const { count } = await supabase
            .from("lobby_members")
            .select("user_id", { count: "exact", head: true })
            .eq("lobby_id", lid);
          if ((count || 0) === 0) {
            await supabase.from("lobbies").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", lid);
          }
        })();
      }
    };
  }, [snap.lobbyId]);

  useEffect(() => {
    if (!snap.lobbyId || location.pathname.startsWith("/sala/")) return;
    let active = true;
    let room: ReturnType<typeof supabase.channel> | null = null;
    let directory: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user || !snap.lobbyId) return;
      const { data: lobby } = await supabase
        .from("lobbies")
        .select("name,game_label,max_members")
        .eq("route_code", snap.lobbyId)
        .maybeSingle();
      const name = user.user_metadata?.display_name || user.user_metadata?.username || user.email?.split("@")[0] || "Jogador";
      room = supabase.channel(`grind:room:${snap.lobbyId}`, { config: { presence: { key: user.id } } });
      room.subscribe(async (status: string) => {
        if (status === "SUBSCRIBED" && room) {
          await room.track({ userId: user.id, name, avatar: user.user_metadata?.avatar_url || null, speaking: false, sharing: false });
        }
      });
      directory = supabase.channel(`grind:lobby-directory:persist:${user.id}`, { config: { presence: { key: user.id } } });
      directory.subscribe(async (status: string) => {
        if (status === "SUBSCRIBED" && directory) {
          await directory.track({
            userId: user.id,
            lobbyId: snap.lobbyId,
            name: lobby?.name || `Lobby ${snap.lobbyId}`,
            game: lobby?.game_label || "EA FC 27",
            maxPlayers: lobby?.max_members || 10,
            sharing: false,
            updatedAt: new Date().toISOString(),
          });
        }
      });
    })();

    return () => {
      active = false;
      if (room) void supabase.removeChannel(room);
      if (directory) void supabase.removeChannel(directory);
    };
  }, [snap.lobbyId, location.pathname]);

  if (!snap.lobbyId || location.pathname.startsWith("/sala/") || location.pathname === "/login" || location.pathname === "/loading") {
    return null;
  }

  const disconnect = async () => {
    try {
      const { livekitSession } = await import("../lib/livekit-session");
      await livekitSession.disconnect(true);
    } catch (error) {
      console.error("[call] failed to load LiveKit for disconnect", error);
      callSession.leave();
    }
  };

  return (
    <aside
      aria-label="Call ativa"
      className="fixed bottom-20 left-1/2 z-[90] flex w-[min(94vw,640px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-primary/35 bg-background/95 px-4 py-3 shadow-2xl backdrop-blur-xl md:bottom-5"
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.8)]" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Em call</div>
        <div className="truncate text-sm font-semibold">Lobby {snap.lobbyId}</div>
      </div>
      <button
        type="button"
        onClick={() => void callSession.setMuted(!snap.muted)}
        className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent"
      >
        {snap.muted ? "Ativar mic" : "Mutar"}
      </button>
      <Link to="/sala/$lobbyId" params={{ lobbyId: snap.lobbyId }} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
        Voltar
      </Link>
      <button
        type="button"
        onClick={() => void disconnect()}
        className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
      >
        Sair
      </button>
    </aside>
  );
}

function AuthBoundary() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const isPublic = location.pathname === "/login" || location.pathname === "/loading";

  useEffect(() => {
    let active = true;
    if (isPublic) {
      setChecking(false);
      return () => {
        active = false;
      };
    }
    setChecking(true);
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session) {
        setChecking(false);
        void navigate({ to: "/login", replace: true });
        return;
      }
      setChecking(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || session) return;
      setChecking(true);
      void navigate({ to: "/login", replace: true });
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [isPublic, location.pathname, navigate]);

  if (!isPublic && checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary-glow" />
          Validando sessão...
        </div>
      </div>
    );
  }

  return (
    <>
      <UserPresenceHeartbeat />
      <ActiveCallPresence />
      <Outlet />
      <MobileDock />
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBoundary />
    </QueryClientProvider>
  );
}

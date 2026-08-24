import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { GrindLoadingScreen } from "@/components/GrindLoadingScreen";
import {
  PROFILE_SELECT,
  supabase,
  type GrindProfile,
} from "@/lib/supabase";

export const Route = createFileRoute("/loading")({
  head: () => ({
    meta: [
      { title: "Entrando — GrindLobby" },
      {
        name: "description",
        content:
          "Inicializando o GrindLobby: perfil competitivo, conexão em tempo real e lobbies prontos em segundos.",
      },
      { property: "og:title", content: "Entrando — GrindLobby" },
      {
        property: "og:description",
        content: "Inicializando sua experiência competitiva no GrindLobby.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoadingPage,
});

function checkRealtime(userId: string) {
  return new Promise<boolean>((resolve) => {
    const channel = supabase.channel(`bootstrap:${userId}:${Date.now()}`);
    let settled = false;

    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      void supabase.removeChannel(channel);
      resolve(ready);
    };

    const timeout = window.setTimeout(() => finish(false), 5000);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") finish(true);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") finish(false);
    });
  });
}

function LoadingPage() {
  const navigate = useNavigate();
  const [isComplete, setIsComplete] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    const boot = async () => {
      setIsComplete(false);
      setBootError(null);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (!active) return;

      if (sessionError || !sessionData.session) {
        await navigate({ to: "/login", replace: true });
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !userData.user) {
        await supabase.auth.signOut({ scope: "local" });
        await navigate({ to: "/login", replace: true });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", userData.user.id)
        .single();

      if (!active) return;

      if (profileError || !profile) {
        setBootError(
          "Sua sessão foi validada, mas o perfil não pôde ser carregado. Tente novamente.",
        );
        return;
      }

      const realtimeReady = await checkRealtime(userData.user.id);

      if (!active) return;

      try {
        window.sessionStorage.setItem(
          "grind-bootstrap-profile",
          JSON.stringify(profile as GrindProfile),
        );
        window.sessionStorage.setItem(
          "grind-realtime-status",
          realtimeReady ? "ready" : "degraded",
        );
      } catch {
        // The app can continue when browser sessionStorage is unavailable.
      }

      setIsComplete(true);
    };

    void boot().catch(() => {
      if (active) {
        setBootError(
          "Não foi possível concluir a inicialização do GrindLobby. Tente novamente.",
        );
      }
    });

    return () => {
      active = false;
    };
  }, [attempt, navigate]);

  const handleComplete = useCallback(() => {
    void navigate({ to: "/", replace: true });
  }, [navigate]);

  return (
    <main className="relative min-h-screen">
      <GrindLoadingScreen isComplete={isComplete} onComplete={handleComplete} />

      {bootError && (
        <div className="fixed inset-x-4 bottom-8 z-[100] mx-auto max-w-lg rounded-xl border border-destructive/40 bg-card/95 p-4 text-center shadow-2xl backdrop-blur">
          <p className="text-sm text-foreground">{bootError}</p>
          <div className="mt-3 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => {
                void supabase.auth.signOut({ scope: "local" }).finally(() => {
                  void navigate({ to: "/login", replace: true });
                });
              }}
              className="btn-ghost rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Voltar ao login
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

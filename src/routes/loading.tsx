import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { GrindLoadingScreen } from "@/components/GrindLoadingScreen";

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

/** Modo demo da rota: apenas dispara a sequência final após um tempo. */
function useDemoBoot(durationMs = 4200) {
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setComplete(true), reduced ? 300 : durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs]);

  return complete;
}

function LoadingPage() {
  const navigate = useNavigate();
  const isComplete = useDemoBoot();

  const handleComplete = useCallback(() => {
    navigate({ to: "/" });
  }, [navigate]);

  return (
    <main>
      <GrindLoadingScreen isComplete={isComplete} onComplete={handleComplete} />
    </main>
  );
}


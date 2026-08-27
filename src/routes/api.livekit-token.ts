import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { AccessToken, TrackSource } from "livekit-server-sdk";

const FALLBACK_SUPABASE_URL = "https://eilaxaklqgyvgjgpkonv.supabase.co";
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_t_uiyr5fFapSPvusy5DtBA_M86m5bzO";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export const Route = createFileRoute("/api/livekit-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization") || "";
        const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
        if (!bearer) return json({ error: "Não autorizado." }, 401);

        const body = (await request.json().catch(() => null)) as { lobbyId?: unknown } | null;
        const lobbyId = typeof body?.lobbyId === "string" ? body.lobbyId.trim().toUpperCase() : "";
        if (!/^GL-[A-Z0-9]{4,12}$/.test(lobbyId)) return json({ error: "Lobby inválido." }, 400);

        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
        const supabaseKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          FALLBACK_PUBLISHABLE_KEY;
        const livekitUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;
        const livekitApiKey = process.env.LIVEKIT_API_KEY;
        const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

        if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
          console.error("[voice] LiveKit server environment is incomplete");
          return json({ error: "Servidor de voz indisponível." }, 503);
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${bearer}` } },
        });

        const { data: userData, error: userError } = await supabase.auth.getUser(bearer);
        const user = userData.user;
        if (userError || !user) return json({ error: "Sessão inválida." }, 401);

        const { data: lobby, error: lobbyError } = await supabase
          .from("lobbies")
          .select("route_code,owner_id,status,visibility,max_members")
          .eq("route_code", lobbyId)
          .maybeSingle();

        if (lobbyError) {
          console.error("[voice] lobby lookup failed", { code: lobbyError.code });
          return json({ error: "Não foi possível validar o lobby." }, 500);
        }
        if (!lobby || lobby.status === "closed") return json({ error: "Lobby encerrado ou inexistente." }, 404);

        const name =
          user.user_metadata?.display_name ||
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          "Jogador";

        const token = new AccessToken(livekitApiKey, livekitApiSecret, {
          identity: user.id,
          name,
          ttl: "15m",
          metadata: JSON.stringify({ lobbyId }),
        });

        token.addGrant({
          roomJoin: true,
          room: `lobby-${lobbyId}`,
          canPublish: true,
          canSubscribe: true,
          canPublishData: false,
          canPublishSources: [
            TrackSource.MICROPHONE,
            TrackSource.CAMERA,
            TrackSource.SCREEN_SHARE,
            TrackSource.SCREEN_SHARE_AUDIO,
          ],
        });

        return json({ token: await token.toJwt(), url: livekitUrl, room: `lobby-${lobbyId}` });
      },
    },
  },
});

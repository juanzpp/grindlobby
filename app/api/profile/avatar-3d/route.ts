import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { noStoreJson } from "@/lib/security/request";
import { enforceRateLimit, RateLimitExceededError, RateLimitUnavailableError, rateLimitResponse } from "@/lib/security/rate-limit";

const PROMPT = [
  "Create a premium realistic 3D gamer profile character using the supplied profile photo only as facial identity reference.",
  "Preserve recognizable facial features while rendering the person as a tasteful full-body game avatar.",
  "Wardrobe: modern black tactical streetwear with restrained violet GrindLobby accents, no weapons, no logos from other brands.",
  "Lighting: dark studio, subtle violet rim light, realistic materials, sophisticated rather than cyberpunk.",
  "Pose: neutral standing profile-preview pose, front three-quarter view.",
  "Background: transparent or near-black neutral studio. No text.",
].join(" ");

function validProviderUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return noStoreJson({ error: "Não autorizado." }, { status: 401 });
    await enforceRateLimit(request, { scope: "profile-avatar-3d", limit: 6, windowSeconds: 3600, subject: user.id });

    const providerUrl = validProviderUrl(process.env.AVATAR_3D_PROVIDER_URL);
    if (!providerUrl) {
      return noStoreJson({
        error: "A geração de avatar 3D ainda não possui um provedor configurado no servidor.",
        code: "AVATAR_3D_PROVIDER_NOT_CONFIGURED",
      }, { status: 503 });
    }

    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("avatar")
      .eq("id", user.id)
      .maybeSingle();
    if (error) return noStoreJson({ error: "Não foi possível carregar a foto do perfil." }, { status: 500 });

    const avatar = typeof profile?.avatar === "string" ? profile.avatar.trim() : "";
    if (!avatar) return noStoreJson({ error: "Adicione uma foto de perfil antes de gerar o personagem 3D." }, { status: 400 });

    const headers: Record<string, string> = { "content-type": "application/json", "accept": "application/json" };
    const token = process.env.AVATAR_3D_PROVIDER_TOKEN?.trim();
    if (token) headers.authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    let response: Response;
    try {
      response = await fetch(providerUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          imageUrl: avatar,
          prompt: PROMPT,
          purpose: "profile_preview",
          output: { format: "png", aspectRatio: "3:4" },
        }),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return noStoreJson({ error: "O provedor de avatar não conseguiu gerar a prévia." }, { status: 502 });
    }

    const result = await response.json().catch(() => null) as null | Record<string, unknown>;
    const imageUrl = typeof result?.imageUrl === "string" ? result.imageUrl : typeof result?.url === "string" ? result.url : "";
    const image = typeof result?.image === "string" ? result.image : typeof result?.b64_json === "string" ? `data:image/png;base64,${result.b64_json}` : "";
    if (!imageUrl && !image) return noStoreJson({ error: "O provedor não retornou uma imagem válida." }, { status: 502 });

    // Preview-only by design: nothing generated here is persisted to the profile or database.
    return noStoreJson({ ok: true, imageUrl: imageUrl || undefined, image: image || undefined, persisted: false });
  } catch (error) {
    if (error instanceof RateLimitExceededError || error instanceof RateLimitUnavailableError) return rateLimitResponse(error);
    if (error instanceof DOMException && error.name === "AbortError") return noStoreJson({ error: "A geração do avatar excedeu o tempo limite." }, { status: 504 });
    return noStoreJson({ error: "Não foi possível gerar a prévia 3D." }, { status: 500 });
  }
}

import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTrustedMutation, noStoreJson } from "@/lib/security/request";
import { enforceRateLimit, RateLimitExceededError, RateLimitUnavailableError, rateLimitResponse } from "@/lib/security/rate-limit";

const OPENAI_IMAGE_EDIT_URL = "https://api.openai.com/v1/images/edits";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const PROMPT = [
  "Create a premium realistic 3D gamer profile character using the supplied profile photo only as facial identity reference.",
  "Preserve the person's recognizable facial structure, skin tone, hair and key identity traits while translating the portrait into a polished full-body 3D game character.",
  "Do not beautify beyond recognition and do not change apparent age, ethnicity or gender presentation.",
  "Wardrobe: modern black tactical streetwear with restrained violet GrindLobby-inspired accents, no weapons and no third-party logos.",
  "Lighting: dark studio, subtle violet rim light, physically believable materials, premium game-render quality, sophisticated rather than cyberpunk.",
  "Pose: neutral standing profile-preview pose, front three-quarter view, full body visible.",
  "Background: transparent. No text, no watermark, no extra people.",
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

function trustedProfileAvatarUrl(value: string, userId: string) {
  try {
    const avatarUrl = new URL(value);
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (avatarUrl.protocol !== "https:" || avatarUrl.hostname !== supabaseUrl.hostname) return null;
    const decodedPath = decodeURIComponent(avatarUrl.pathname);
    const expectedPrefix = `/storage/v1/object/public/profile-assets/${userId}/avatar/`;
    if (!decodedPath.startsWith(expectedPrefix)) return null;
    return avatarUrl;
  } catch {
    return null;
  }
}

function extensionForMime(mime: string) {
  return mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
}

async function loadAvatarFile(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: controller.signal });
    if (!response.ok) throw new Error("AVATAR_FETCH_FAILED");
    const mime = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_AVATAR_MIME.has(mime)) throw new Error("AVATAR_INVALID_MIME");
    const announcedSize = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(announcedSize) && announcedSize > MAX_AVATAR_BYTES) throw new Error("AVATAR_TOO_LARGE");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_AVATAR_BYTES) throw new Error("AVATAR_TOO_LARGE");
    return new File([bytes], `profile-avatar.${extensionForMime(mime)}`, { type: mime });
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithOpenAI(avatarUrl: URL, apiKey: string) {
  const image = await loadAvatarFile(avatarUrl);
  const form = new FormData();
  form.append("model", process.env.AVATAR_3D_OPENAI_MODEL?.trim() || "gpt-image-2");
  form.append("image[]", image, image.name);
  form.append("prompt", PROMPT);
  form.append("size", "1024x1536");
  form.append("quality", "low");
  form.append("background", "transparent");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(OPENAI_IMAGE_EDIT_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
      body: form,
      signal: controller.signal,
      cache: "no-store",
    });
    const result = await response.json().catch(() => null) as null | {
      data?: Array<{ b64_json?: string; url?: string }>;
      error?: { message?: string; code?: string };
    };
    if (!response.ok) {
      const code = result?.error?.code ? String(result.error.code) : "OPENAI_IMAGE_GENERATION_FAILED";
      const error = new Error(code);
      error.name = "AvatarProviderError";
      throw error;
    }
    const first = result?.data?.[0];
    const base64 = typeof first?.b64_json === "string" ? first.b64_json : "";
    const imageUrl = typeof first?.url === "string" ? first.url : "";
    if (!base64 && !imageUrl) throw new Error("OPENAI_EMPTY_IMAGE");
    return { image: base64 ? `data:image/png;base64,${base64}` : undefined, imageUrl: imageUrl || undefined, provider: "openai" as const };
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithGenericProvider(providerUrl: URL, avatar: string, token?: string) {
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(providerUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        imageUrl: avatar,
        prompt: PROMPT,
        purpose: "profile_preview",
        output: { format: "png", aspectRatio: "3:4", background: "transparent" },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("GENERIC_PROVIDER_FAILED");
    const result = await response.json().catch(() => null) as null | Record<string, unknown>;
    const imageUrl = typeof result?.imageUrl === "string" ? result.imageUrl : typeof result?.url === "string" ? result.url : "";
    const image = typeof result?.image === "string" ? result.image : typeof result?.b64_json === "string" ? `data:image/png;base64,${result.b64_json}` : "";
    if (!imageUrl && !image) throw new Error("GENERIC_PROVIDER_EMPTY_IMAGE");
    return { imageUrl: imageUrl || undefined, image: image || undefined, provider: "external" as const };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await getCurrentUser(request);
    if (!user) return noStoreJson({ error: "Não autorizado." }, { status: 401 });
    await enforceRateLimit(request, { scope: "profile-avatar-3d", limit: 6, windowSeconds: 3600, subject: user.id });

    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("avatar")
      .eq("id", user.id)
      .maybeSingle();
    if (error) return noStoreJson({ error: "Não foi possível carregar a foto do perfil." }, { status: 500 });

    const avatar = typeof profile?.avatar === "string" ? profile.avatar.trim() : "";
    if (!avatar) return noStoreJson({ error: "Adicione uma foto de perfil antes de gerar o personagem 3D." }, { status: 400 });

    const trustedAvatar = trustedProfileAvatarUrl(avatar, user.id);
    if (!trustedAvatar) {
      return noStoreJson({
        error: "Por segurança, gere o personagem usando uma foto enviada pelo próprio editor de perfil do GrindLobby.",
        code: "AVATAR_3D_UNTRUSTED_PROFILE_IMAGE",
      }, { status: 400 });
    }

    const openAiKey = process.env.OPENAI_API_KEY?.trim();
    const genericProviderUrl = validProviderUrl(process.env.AVATAR_3D_PROVIDER_URL);
    let generated: { image?: string; imageUrl?: string; provider: "openai" | "external" };

    if (openAiKey) {
      generated = await generateWithOpenAI(trustedAvatar, openAiKey);
    } else if (genericProviderUrl) {
      generated = await generateWithGenericProvider(genericProviderUrl, avatar, process.env.AVATAR_3D_PROVIDER_TOKEN?.trim());
    } else {
      return noStoreJson({
        error: "A geração 3D está instalada, mas falta a credencial do provedor de IA no servidor.",
        code: "AVATAR_3D_PROVIDER_NOT_CONFIGURED",
      }, { status: 503 });
    }

    // Preview-only by design: generated output is returned to the browser and is never written to profile storage or database here.
    return noStoreJson({ ok: true, imageUrl: generated.imageUrl, image: generated.image, provider: generated.provider, persisted: false });
  } catch (error) {
    if (error instanceof RateLimitExceededError || error instanceof RateLimitUnavailableError) return rateLimitResponse(error);
    if (error instanceof DOMException && error.name === "AbortError") return noStoreJson({ error: "A geração do personagem excedeu o tempo limite." }, { status: 504 });
    if (error instanceof Error && error.name === "AvatarProviderError") return noStoreJson({ error: "O provedor de IA recusou ou não conseguiu gerar a prévia." }, { status: 502 });
    if (error instanceof Error && error.message.startsWith("AVATAR_")) return noStoreJson({ error: "Não foi possível carregar a foto de perfil com segurança." }, { status: 400 });
    return noStoreJson({ error: "Não foi possível gerar a prévia 3D." }, { status: 500 });
  }
}

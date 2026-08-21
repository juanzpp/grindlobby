import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isConfiguredAdmin } from "@/lib/admin-config";
import { DEFAULT_PROFILE_BADGE, DEFAULT_PROFILE_BANNER, DEFAULT_PROFILE_CARD_STYLE, DEFAULT_PROFILE_EFFECT, DEFAULT_PROFILE_FRAME } from "@/lib/profile-cosmetics";
import { normalizeCosmeticState } from "@/lib/cosmetic-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTrustedMutation, noStoreJson, readJsonBody } from "@/lib/security/request";
import { enforceRateLimit, RateLimitExceededError, RateLimitUnavailableError, rateLimitResponse } from "@/lib/security/rate-limit";

const cosmeticEquippedSchema = z.object({
  banner: z.string().trim().max(80).default(DEFAULT_PROFILE_BANNER),
  frame: z.string().trim().max(80).default(DEFAULT_PROFILE_FRAME),
  effect: z.string().trim().max(80).default(DEFAULT_PROFILE_EFFECT),
  badge: z.string().trim().max(80).default(DEFAULT_PROFILE_BADGE),
  cardStyle: z.string().trim().max(80).default(DEFAULT_PROFILE_CARD_STYLE),
  bundle: z.string().trim().max(80).default(""),
}).passthrough();

const cosmeticStateSchema = z.object({
  owned: z.array(z.string().trim().max(80)).default([]),
  equipped: cosmeticEquippedSchema.default({
    banner: DEFAULT_PROFILE_BANNER,
    frame: DEFAULT_PROFILE_FRAME,
    effect: DEFAULT_PROFILE_EFFECT,
    badge: DEFAULT_PROFILE_BADGE,
    cardStyle: DEFAULT_PROFILE_CARD_STYLE,
    bundle: "",
  }),
}).passthrough();

const profileSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_]+$/),
  displayName: z.string().trim().min(2).max(40),
  bio: z.string().trim().max(120).default(""),
  favoriteGame: z.string().trim().max(80).default(""),
  region: z.string().trim().max(50).default(""),
  socialDiscord: z.string().trim().max(80).default(""),
  socialInstagram: z.string().trim().max(80).default(""),
  socialTwitch: z.string().trim().max(80).default(""),
  avatarUrl: z.string().trim().max(800).default(""),
  bannerUrl: z.string().trim().max(800).default(""),
  avatarFrame: z.string().trim().max(40).default(DEFAULT_PROFILE_FRAME),
  profileEffect: z.string().trim().max(40).default(DEFAULT_PROFILE_EFFECT),
  profileBadge: z.string().trim().max(40).default(DEFAULT_PROFILE_BADGE),
  profileCardStyle: z.string().trim().max(40).default(DEFAULT_PROFILE_CARD_STYLE),
  cosmetics: cosmeticStateSchema.optional(),
  ownedCosmetics: z.array(z.string().trim().max(80)).optional(),
  equippedCosmetics: cosmeticEquippedSchema.optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return noStoreJson({ error: "Não autorizado." }, { status: 401 });
    await enforceRateLimit(request, { scope: "profile-read", limit: 120, windowSeconds: 600, subject: user.id });

    const admin = createAdminClient();
    const isAdmin = isConfiguredAdmin(user.id);
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, username, email, display_name, avatar, bio, favorite_game, region, social_discord, social_instagram, social_twitch, profile_banner, avatar_frame, profile_effect, profile_badge, profile_card_style, cosmetic_owned, cosmetic_equipped")
      .eq("id", user.id)
      .maybeSingle();

    if (error) { return noStoreJson({ error: "Não foi possível carregar o perfil." }, { status: 500 }); }

    const equippedInput = {
      banner: typeof profile?.cosmetic_equipped?.banner === "string" ? profile.cosmetic_equipped.banner : DEFAULT_PROFILE_BANNER,
      frame: typeof profile?.cosmetic_equipped?.frame === "string" ? profile.cosmetic_equipped.frame : DEFAULT_PROFILE_FRAME,
      effect: typeof profile?.cosmetic_equipped?.effect === "string" ? profile.cosmetic_equipped.effect : DEFAULT_PROFILE_EFFECT,
      badge: typeof profile?.cosmetic_equipped?.badge === "string" ? profile.cosmetic_equipped.badge : DEFAULT_PROFILE_BADGE,
      cardStyle: typeof profile?.cosmetic_equipped?.cardStyle === "string" ? profile.cosmetic_equipped.cardStyle : DEFAULT_PROFILE_CARD_STYLE,
      bundle: typeof profile?.cosmetic_equipped?.bundle === "string" ? profile.cosmetic_equipped.bundle : "",
    };

    const cosmeticState = normalizeCosmeticState({
      owned: Array.isArray(profile?.cosmetic_owned) ? profile.cosmetic_owned as string[] : [],
      equipped: equippedInput,
    }, isAdmin);

    return noStoreJson({
      profile: {
        id: user.id,
        username: profile?.username ?? user.username,
        display_name: profile?.display_name ?? user.display_name,
        email: profile?.email ?? user.email,
        avatar: profile?.avatar ?? user.avatar ?? "",
        bio: profile?.bio ?? "",
        favorite_game: profile?.favorite_game ?? "",
        region: profile?.region ?? "",
        social_discord: profile?.social_discord ?? "",
        social_instagram: profile?.social_instagram ?? "",
        social_twitch: profile?.social_twitch ?? "",
        profile_banner: profile?.profile_banner ?? "",
        avatar_frame: profile?.avatar_frame ?? DEFAULT_PROFILE_FRAME,
        profile_effect: profile?.profile_effect ?? DEFAULT_PROFILE_EFFECT,
        profile_badge: profile?.profile_badge ?? DEFAULT_PROFILE_BADGE,
        profile_card_style: profile?.profile_card_style ?? DEFAULT_PROFILE_CARD_STYLE,
        cosmetic_owned: cosmeticState.owned,
        cosmetic_equipped: cosmeticState.equipped,
        cosmetic_state: cosmeticState,
        app_role: user.app_role,
        account_tier: user.account_tier,
      },
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError || error instanceof RateLimitUnavailableError) return rateLimitResponse(error);
    return noStoreJson({ error: "Não foi possível carregar o perfil." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await getCurrentUser();
    if (!user) return noStoreJson({ error: "Não autorizado." }, { status: 401 });
    await enforceRateLimit(request, { scope: "profile-write", limit: 30, windowSeconds: 600, subject: user.id });

    const body = profileSchema.parse(await readJsonBody(request, 16384));
    const admin = createAdminClient();
    const isAdmin = isConfiguredAdmin(user.id);
    const equippedInput = {
      banner: typeof body.cosmetics?.equipped?.banner === "string" ? body.cosmetics.equipped.banner : (typeof body.equippedCosmetics?.banner === "string" ? body.equippedCosmetics.banner : DEFAULT_PROFILE_BANNER),
      frame: typeof body.cosmetics?.equipped?.frame === "string" ? body.cosmetics.equipped.frame : (typeof body.equippedCosmetics?.frame === "string" ? body.equippedCosmetics.frame : DEFAULT_PROFILE_FRAME),
      effect: typeof body.cosmetics?.equipped?.effect === "string" ? body.cosmetics.equipped.effect : (typeof body.equippedCosmetics?.effect === "string" ? body.equippedCosmetics.effect : DEFAULT_PROFILE_EFFECT),
      badge: typeof body.cosmetics?.equipped?.badge === "string" ? body.cosmetics.equipped.badge : (typeof body.equippedCosmetics?.badge === "string" ? body.equippedCosmetics.badge : DEFAULT_PROFILE_BADGE),
      cardStyle: typeof body.cosmetics?.equipped?.cardStyle === "string" ? body.cosmetics.equipped.cardStyle : (typeof body.equippedCosmetics?.cardStyle === "string" ? body.equippedCosmetics.cardStyle : DEFAULT_PROFILE_CARD_STYLE),
      bundle: typeof body.cosmetics?.equipped?.bundle === "string" ? body.cosmetics.equipped.bundle : (typeof body.equippedCosmetics?.bundle === "string" ? body.equippedCosmetics.bundle : ""),
    };
    const cosmeticState = normalizeCosmeticState({
      owned: body.cosmetics?.owned ?? body.ownedCosmetics ?? [],
      equipped: equippedInput,
    }, isAdmin);

    const payload = {
      username: body.username,
      display_name: body.displayName,
      bio: body.bio,
      favorite_game: body.favoriteGame,
      region: body.region,
      social_discord: body.socialDiscord,
      social_instagram: body.socialInstagram,
      social_twitch: body.socialTwitch,
      avatar: body.avatarUrl || null,
      profile_banner: body.bannerUrl || null,
      avatar_frame: body.avatarFrame || cosmeticState.equipped.frame,
      profile_effect: body.profileEffect || cosmeticState.equipped.effect,
      profile_badge: body.profileBadge || cosmeticState.equipped.badge,
      profile_card_style: body.profileCardStyle || cosmeticState.equipped.cardStyle,
      cosmetic_owned: cosmeticState.owned,
      cosmetic_equipped: cosmeticState.equipped,
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin.from("profiles").update(payload).eq("id", user.id);
    if (error) return noStoreJson({ error: error.message || "Não foi possível salvar o perfil." }, { status: 400 });

    return noStoreJson({ ok: true, message: "Perfil atualizado", cosmeticState });
  } catch (error) {
    if (error instanceof RateLimitExceededError || error instanceof RateLimitUnavailableError) return rateLimitResponse(error);
    if (error instanceof z.ZodError) return noStoreJson({ error: "Revise os campos do perfil." }, { status: 400 });
    return noStoreJson({ error: "Não foi possível atualizar o perfil." }, { status: 500 });
  }
}

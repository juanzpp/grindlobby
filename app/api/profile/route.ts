import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isConfiguredAdmin } from "@/lib/admin-config";
import {
  DEFAULT_PROFILE_BADGE,
  DEFAULT_PROFILE_BANNER,
  DEFAULT_PROFILE_CARD_STYLE,
  DEFAULT_PROFILE_EFFECT,
  DEFAULT_PROFILE_FRAME,
  PROFILE_BADGES,
  PROFILE_BANNERS,
  PROFILE_CARD_STYLES,
  PROFILE_EFFECTS,
  PROFILE_FRAMES,
} from "@/lib/profile-cosmetics";
import { normalizeCosmeticState, type CosmeticState } from "@/lib/cosmetic-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTrustedMutation, noStoreJson, readJsonBody } from "@/lib/security/request";
import { enforceRateLimit, RateLimitExceededError, RateLimitUnavailableError, rateLimitResponse } from "@/lib/security/rate-limit";

const cosmeticEquippedSchema = z.object({
  banner: z.string().trim().max(800).default(DEFAULT_PROFILE_BANNER),
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

const validIds = {
  banner: new Set(PROFILE_BANNERS.map((item) => item.id)),
  frame: new Set(PROFILE_FRAMES.map((item) => item.id)),
  effect: new Set(PROFILE_EFFECTS.map((item) => item.id)),
  badge: new Set(PROFILE_BADGES.map((item) => item.id)),
  cardStyle: new Set(PROFILE_CARD_STYLES.map((item) => item.id)),
};

function enforceOwnedSelections(state: CosmeticState, isAdmin: boolean): CosmeticState {
  if (isAdmin) return state;
  const owned = new Set(state.owned);
  const canUse = (kind: keyof typeof validIds, id: string, fallback: string) =>
    id === fallback || (validIds[kind].has(id) && owned.has(id)) ? id : fallback;

  return {
    owned: state.owned,
    equipped: {
      ...state.equipped,
      banner: canUse("banner", state.equipped.banner, DEFAULT_PROFILE_BANNER),
      frame: canUse("frame", state.equipped.frame, DEFAULT_PROFILE_FRAME),
      effect: canUse("effect", state.equipped.effect, DEFAULT_PROFILE_EFFECT),
      badge: canUse("badge", state.equipped.badge, DEFAULT_PROFILE_BADGE),
      cardStyle: canUse("cardStyle", state.equipped.cardStyle, DEFAULT_PROFILE_CARD_STYLE),
      bundle: state.equipped.bundle && owned.has(state.equipped.bundle) ? state.equipped.bundle : "",
    },
  };
}

function buildCosmeticState(profile: any, isAdmin: boolean) {
  const equippedInput = {
    banner: typeof profile?.cosmetic_equipped?.banner === "string" ? profile.cosmetic_equipped.banner : DEFAULT_PROFILE_BANNER,
    frame: typeof profile?.cosmetic_equipped?.frame === "string" ? profile.cosmetic_equipped.frame : DEFAULT_PROFILE_FRAME,
    effect: typeof profile?.cosmetic_equipped?.effect === "string" ? profile.cosmetic_equipped.effect : DEFAULT_PROFILE_EFFECT,
    badge: typeof profile?.cosmetic_equipped?.badge === "string" ? profile.cosmetic_equipped.badge : DEFAULT_PROFILE_BADGE,
    cardStyle: typeof profile?.cosmetic_equipped?.cardStyle === "string" ? profile.cosmetic_equipped.cardStyle : DEFAULT_PROFILE_CARD_STYLE,
    bundle: typeof profile?.cosmetic_equipped?.bundle === "string" ? profile.cosmetic_equipped.bundle : "",
  };
  return enforceOwnedSelections(normalizeCosmeticState({
    owned: Array.isArray(profile?.cosmetic_owned) ? profile.cosmetic_owned as string[] : [],
    equipped: equippedInput,
  }, isAdmin), isAdmin);
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return noStoreJson({ error: "Não autorizado." }, { status: 401 });
    await enforceRateLimit(request, { scope: "profile-read", limit: 120, windowSeconds: 600, subject: user.id });

    const admin = createAdminClient();
    const isAdmin = isConfiguredAdmin(user.id);
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, username, email, display_name, avatar, bio, favorite_game, region, social_discord, social_instagram, social_twitch, profile_banner, avatar_frame, profile_effect, profile_badge, profile_card_style, cosmetic_owned, cosmetic_equipped")
      .eq("id", user.id)
      .maybeSingle();

    if (error) return noStoreJson({ error: "Não foi possível carregar o perfil." }, { status: 500 });
    const cosmeticState = buildCosmeticState(profile, isAdmin);

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
        avatar_frame: cosmeticState.equipped.frame,
        profile_effect: cosmeticState.equipped.effect,
        profile_badge: cosmeticState.equipped.badge,
        profile_card_style: cosmeticState.equipped.cardStyle,
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
    const user = await getCurrentUser(request);
    if (!user) return noStoreJson({ error: "Não autorizado." }, { status: 401 });
    await enforceRateLimit(request, { scope: "profile-write", limit: 30, windowSeconds: 600, subject: user.id });

    const body = profileSchema.parse(await readJsonBody(request, 16384));
    const admin = createAdminClient();
    const isAdmin = isConfiguredAdmin(user.id);

    const { data: persistedProfile, error: persistedError } = await admin
      .from("profiles")
      .select("cosmetic_owned,cosmetic_equipped")
      .eq("id", user.id)
      .maybeSingle();
    if (persistedError) return noStoreJson({ error: "Não foi possível validar seus cosméticos." }, { status: 500 });

    const persistedOwned = Array.isArray(persistedProfile?.cosmetic_owned) ? persistedProfile.cosmetic_owned as string[] : [];
    const requestedEquipped: Partial<CosmeticState["equipped"]> = body.cosmetics?.equipped ?? body.equippedCosmetics ?? {};
    const equippedInput = {
      banner: requestedEquipped.banner ?? DEFAULT_PROFILE_BANNER,
      frame: requestedEquipped.frame ?? body.avatarFrame ?? DEFAULT_PROFILE_FRAME,
      effect: requestedEquipped.effect ?? body.profileEffect ?? DEFAULT_PROFILE_EFFECT,
      badge: requestedEquipped.badge ?? body.profileBadge ?? DEFAULT_PROFILE_BADGE,
      cardStyle: requestedEquipped.cardStyle ?? body.profileCardStyle ?? DEFAULT_PROFILE_CARD_STYLE,
      bundle: requestedEquipped.bundle ?? "",
    };

    const cosmeticState = enforceOwnedSelections(normalizeCosmeticState({
      owned: persistedOwned,
      equipped: equippedInput,
    }, isAdmin), isAdmin);

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
      avatar_frame: cosmeticState.equipped.frame,
      profile_effect: cosmeticState.equipped.effect,
      profile_badge: cosmeticState.equipped.badge,
      profile_card_style: cosmeticState.equipped.cardStyle,
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

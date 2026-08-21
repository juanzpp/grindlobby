import { BUNDLES } from '@/lib/store-catalog';
import {
  PROFILE_BADGES,
  PROFILE_BANNERS,
  PROFILE_CARD_STYLES,
  PROFILE_EFFECTS,
  PROFILE_FRAMES,
  DEFAULT_PROFILE_BADGE,
  DEFAULT_PROFILE_BANNER,
  DEFAULT_PROFILE_CARD_STYLE,
  DEFAULT_PROFILE_EFFECT,
  DEFAULT_PROFILE_FRAME,
} from '@/lib/profile-cosmetics';

export type CosmeticallyEquipped = {
  banner: string;
  frame: string;
  effect: string;
  badge: string;
  cardStyle: string;
  bundle: string;
};

export type CosmeticState = {
  owned: string[];
  equipped: CosmeticallyEquipped;
};

export type CosmeticEquippedInput = Partial<CosmeticallyEquipped> | Record<string, string> | null | undefined;

export const DEFAULT_PROFILE_COSMETICS: CosmeticState = {
  owned: mergeUnique([
    DEFAULT_PROFILE_BANNER,
    DEFAULT_PROFILE_FRAME,
    DEFAULT_PROFILE_EFFECT,
    DEFAULT_PROFILE_BADGE,
    DEFAULT_PROFILE_CARD_STYLE,
  ]),
  equipped: {
    banner: DEFAULT_PROFILE_BANNER,
    frame: DEFAULT_PROFILE_FRAME,
    effect: DEFAULT_PROFILE_EFFECT,
    badge: DEFAULT_PROFILE_BADGE,
    cardStyle: DEFAULT_PROFILE_CARD_STYLE,
    bundle: '',
  },
};

export const ALL_COSMETIC_IDS = [
  ...PROFILE_BANNERS.map((banner) => banner.id),
  ...PROFILE_FRAMES.map((frame) => frame.id),
  ...PROFILE_EFFECTS.map((effect) => effect.id),
  ...PROFILE_BADGES.map((badge) => badge.id),
  ...PROFILE_CARD_STYLES.map((style) => style.id),
  ...BUNDLES.map((bundle) => bundle.id),
];

export const BUNDLE_COSMETIC_MAP: Record<string, Partial<CosmeticallyEquipped>> = {
  cyber: { banner: 'void-rift', frame: 'prism', effect: 'prism', badge: 'admin', cardStyle: 'violet' },
  elite: { banner: 'aurora', frame: 'gold', effect: 'electric-halo', badge: 'founder', cardStyle: 'gold' },
  competitive: { banner: 'nebula-pulse', frame: 'amethyst', effect: 'void-pulse', badge: 'competitive', cardStyle: 'blue' },
  cosmic: { banner: 'electric-core', frame: 'diamond', effect: 'cyber-nebula', badge: 'elite', cardStyle: 'emerald' },
  champion: { banner: 'crimson-rift', frame: 'solar', effect: 'eclipse', badge: 'streamer', cardStyle: 'crimson' },
};

const isValidSelection = (value: string | undefined, candidates: string[]) => Boolean(value && candidates.includes(value));

function mergeUnique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeCosmeticState(input?: Partial<CosmeticState> & { equipped?: CosmeticEquippedInput } | null, isAdmin = false): CosmeticState {
  const owned = mergeUnique(isAdmin ? [...ALL_COSMETIC_IDS, ...(input?.owned ?? [])] : [...(input?.owned ?? DEFAULT_PROFILE_COSMETICS.owned)]);
  const equippedInput = (input?.equipped ?? {}) as Record<string, string>;

  const bannerIds = PROFILE_BANNERS.map((banner) => banner.id);
  const frameIds = PROFILE_FRAMES.map((frame) => frame.id);
  const effectIds = PROFILE_EFFECTS.map((effect) => effect.id);
  const badgeIds = PROFILE_BADGES.map((badge) => badge.id);
  const cardStyleIds = PROFILE_CARD_STYLES.map((style) => style.id);

  const equipped = {
    banner: isValidSelection(equippedInput.banner, bannerIds) ? equippedInput.banner : DEFAULT_PROFILE_BANNER,
    frame: isValidSelection(equippedInput.frame, frameIds) ? equippedInput.frame : DEFAULT_PROFILE_FRAME,
    effect: isValidSelection(equippedInput.effect, effectIds) ? equippedInput.effect : DEFAULT_PROFILE_EFFECT,
    badge: isValidSelection(equippedInput.badge, badgeIds) ? equippedInput.badge : DEFAULT_PROFILE_BADGE,
    cardStyle: isValidSelection(equippedInput.cardStyle, cardStyleIds) ? equippedInput.cardStyle : DEFAULT_PROFILE_CARD_STYLE,
    bundle: (equippedInput.bundle && BUNDLES.some((bundle) => bundle.id === equippedInput.bundle)) ? equippedInput.bundle : '',
  };

  if (isAdmin) {
    equipped.bundle = equippedInput.bundle && BUNDLES.some((bundle) => bundle.id === equippedInput.bundle) ? equippedInput.bundle : 'cyber';
    if (!owned.includes(equipped.banner)) owned.push(equipped.banner);
    if (!owned.includes(equipped.frame)) owned.push(equipped.frame);
    if (!owned.includes(equipped.effect)) owned.push(equipped.effect);
    if (!owned.includes(equipped.badge)) owned.push(equipped.badge);
    if (!owned.includes(equipped.cardStyle)) owned.push(equipped.cardStyle);
  }

  return { owned: mergeUnique(owned), equipped };
}

export function equipCosmetic(state: Partial<CosmeticState> | null | undefined, kind: keyof Omit<CosmeticallyEquipped, 'bundle'>, id: string, isAdmin = false): CosmeticState {
  const current = normalizeCosmeticState(state, isAdmin);
  const target = isValidSelection(id, ALL_COSMETIC_IDS) ? id : DEFAULT_PROFILE_COSMETICS.equipped[kind];

  const next: CosmeticState = {
    owned: mergeUnique([...current.owned, target]),
    equipped: {
      ...current.equipped,
      [kind]: target,
      bundle: current.equipped.bundle,
    },
  };

  return normalizeCosmeticState(next, isAdmin);
}

export function equipBundle(state: Partial<CosmeticState> | null | undefined, bundleId: string, isAdmin = false): CosmeticState {
  const current = normalizeCosmeticState(state, isAdmin);
  if (!BUNDLES.some((bundle) => bundle.id === bundleId)) return current;

  const bundleMap = BUNDLE_COSMETIC_MAP[bundleId] ?? {};
  const nextOwned = mergeUnique([...current.owned, bundleId]);
  const nextEquipped = {
    ...current.equipped,
    bundle: bundleId,
    banner: bundleMap.banner ?? current.equipped.banner,
    frame: bundleMap.frame ?? current.equipped.frame,
    effect: bundleMap.effect ?? current.equipped.effect,
    badge: bundleMap.badge ?? current.equipped.badge,
    cardStyle: bundleMap.cardStyle ?? current.equipped.cardStyle,
  };

  const merged = {
    owned: mergeUnique([
      ...nextOwned,
      ...(bundleMap.banner ? [bundleMap.banner] : []),
      ...(bundleMap.frame ? [bundleMap.frame] : []),
      ...(bundleMap.effect ? [bundleMap.effect] : []),
      ...(bundleMap.badge ? [bundleMap.badge] : []),
      ...(bundleMap.cardStyle ? [bundleMap.cardStyle] : []),
    ]),
    equipped: nextEquipped,
  };

  return normalizeCosmeticState(merged, isAdmin);
}

export function getOwnedCosmeticIds(state?: Partial<CosmeticState> | null, isAdmin = false) {
  return normalizeCosmeticState(state, isAdmin).owned;
}

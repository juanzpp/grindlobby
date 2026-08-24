export type LevelTier = {
  id: string;
  name: string;
  from: number;
  to: number;
  /** main tier color as a raw oklch value */
  color: string;
  /** brighter companion color for gradients */
  glow: string;
  /** 0-4: how much aura/effect the xp bar receives */
  aura: 0 | 1 | 2 | 3 | 4;
};

export const LEVEL_TIERS: LevelTier[] = [
  {
    id: "iniciante",
    name: "Iniciante",
    from: 0,
    to: 4,
    color: "oklch(0.62 0.02 285)",
    glow: "oklch(0.76 0.02 285)",
    aura: 0,
  },
  {
    id: "bronze",
    name: "Bronze",
    from: 5,
    to: 9,
    color: "oklch(0.58 0.11 60)",
    glow: "oklch(0.74 0.13 70)",
    aura: 1,
  },
  {
    id: "prata",
    name: "Prata",
    from: 10,
    to: 14,
    color: "oklch(0.72 0.02 250)",
    glow: "oklch(0.88 0.02 250)",
    aura: 1,
  },
  {
    id: "safira",
    name: "Safira",
    from: 15,
    to: 19,
    color: "oklch(0.58 0.17 250)",
    glow: "oklch(0.74 0.16 245)",
    aura: 2,
  },
  {
    id: "esmeralda",
    name: "Esmeralda",
    from: 20,
    to: 24,
    color: "oklch(0.6 0.16 160)",
    glow: "oklch(0.76 0.16 160)",
    aura: 2,
  },
  {
    id: "ametista",
    name: "Ametista",
    from: 25,
    to: 29,
    color: "oklch(0.52 0.22 300)",
    glow: "oklch(0.68 0.22 305)",
    aura: 3,
  },
  {
    id: "carmesim",
    name: "Carmesim",
    from: 30,
    to: 34,
    color: "oklch(0.56 0.22 15)",
    glow: "oklch(0.72 0.2 20)",
    aura: 3,
  },
  {
    id: "aureo",
    name: "Áureo",
    from: 35,
    to: 39,
    color: "oklch(0.72 0.16 90)",
    glow: "oklch(0.87 0.15 95)",
    aura: 4,
  },
  {
    id: "prismatico",
    name: "Prismático",
    from: 40,
    to: 40,
    color: "oklch(0.7 0.2 320)",
    glow: "oklch(0.85 0.18 200)",
    aura: 4,
  },
];

export const MAX_LEVEL = 40;

export function getTier(level: number): LevelTier {
  const clamped = Math.min(Math.max(level, 0), MAX_LEVEL);
  return (
    LEVEL_TIERS.find((t) => clamped >= t.from && clamped <= t.to) ?? LEVEL_TIERS[0]!
  );
}

/** XP required to advance from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return 400 + level * 220;
}

export function tierGradient(tier: LevelTier): string {
  if (tier.id === "prismatico") {
    return `linear-gradient(90deg, oklch(0.7 0.2 320), oklch(0.75 0.18 250), oklch(0.8 0.18 160), oklch(0.85 0.17 90), oklch(0.7 0.2 320))`;
  }
  return `linear-gradient(90deg, ${tier.color}, ${tier.glow})`;
}

/** Box-shadow aura for the XP bar — stronger for higher tiers. */
export function tierAuraShadow(tier: LevelTier): string {
  const spread = [0, 8, 16, 26, 38][tier.aura]!;
  if (spread === 0) return "none";
  return `0 0 ${spread}px ${Math.round(spread / 3)}px ${tier.glow.replace(")", " / 0.55)")}`;
}

export type ProfileBannerOption = {
  id: string;
  label: string;
  gradient: string;
  accent: string;
  glow: string;
};

export type ProfileFrameOption = {
  id: string;
  label: string;
  accent: string;
  glow: string;
};

export type ProfileEffectOption = {
  id: string;
  label: string;
  glow: string;
  ring: string;
};

export type ProfileBadgeOption = {
  id: string;
  label: string;
  accent: string;
};

export type ProfileCardStyle = {
  id: string;
  label: string;
  accent: string;
  header: string;
  panel: string;
};

export const PROFILE_GAMES = [
  'EA FC 27',
  'Valorant',
  'Rocket League',
  'Fortnite',
  'Counter-Strike 2',
  'Apex Legends',
  'League of Legends',
  'Dota 2',
  'Overwatch 2',
  'PUBG',
];

export const PROFILE_REGIONS = [
  'Brasil',
  'América do Norte',
  'Europa',
  'América Latina',
  'Ásia',
  'Mundo',
  'Sudeste',
  'Nordeste',
  'Sul',
];

export const PROFILE_BANNERS: ProfileBannerOption[] = [
  { id: 'void-rift', label: 'Void Rift', gradient: 'radial-gradient(circle at 20% 25%, rgba(168,85,247,0.80), transparent 22%), radial-gradient(circle at 70% 30%, rgba(59,130,246,0.62), transparent 18%), linear-gradient(120deg, #0b0d14 0%, #140d20 42%, #090a12 100%)', accent: '#c4b5fd', glow: 'rgba(168,85,247,0.45)' },
  { id: 'nebula-pulse', label: 'Nebula Pulse', gradient: 'radial-gradient(circle at 52% 30%, rgba(96,165,250,0.66), transparent 16%), radial-gradient(circle at 35% 60%, rgba(168,85,247,0.58), transparent 18%), linear-gradient(135deg, #070b12 0%, #171226 38%, #090d12 100%)', accent: '#93c5fd', glow: 'rgba(96,165,250,0.48)' },
  { id: 'electric-core', label: 'Electric Core', gradient: 'radial-gradient(circle at 60% 35%, rgba(34,211,238,0.7), transparent 16%), radial-gradient(circle at 28% 68%, rgba(168,85,247,0.58), transparent 18%), linear-gradient(135deg, #071013 0%, #0d1221 40%, #10091a 100%)', accent: '#67e8f9', glow: 'rgba(34,211,238,0.45)' },
  { id: 'crimson-rift', label: 'Crimson Rift', gradient: 'radial-gradient(circle at 20% 35%, rgba(248,113,113,0.7), transparent 18%), radial-gradient(circle at 60% 24%, rgba(244,114,182,0.58), transparent 16%), linear-gradient(135deg, #13070a 0%, #190b0d 38%, #08090d 100%)', accent: '#fca5a5', glow: 'rgba(248,113,113,0.42)' },
  { id: 'emerald-flux', label: 'Emerald Flux', gradient: 'radial-gradient(circle at 40% 28%, rgba(16,185,129,0.7), transparent 18%), radial-gradient(circle at 70% 62%, rgba(59,130,246,0.38), transparent 18%), linear-gradient(135deg, #061812 0%, #0d1622 38%, #090d13 100%)', accent: '#6ee7b7', glow: 'rgba(16,185,129,0.38)' },
  { id: 'aurora', label: 'Aurora', gradient: 'radial-gradient(circle at 50% 24%, rgba(167,139,250,0.85), transparent 18%), radial-gradient(circle at 75% 72%, rgba(125,211,252,0.58), transparent 16%), linear-gradient(135deg, #080d14 0%, #18172b 36%, #090b12 100%)', accent: '#c4b5fd', glow: 'rgba(167,139,250,0.5)' },
];

export const PROFILE_FRAMES: ProfileFrameOption[] = [
  { id: 'prism', label: 'Prismático', accent: '#a78bfa', glow: 'rgba(167,139,250,0.5)' },
  { id: 'carmesim', label: 'Carmesim', accent: '#f87171', glow: 'rgba(248,113,113,0.52)' },
  { id: 'gold', label: 'Áureo', accent: '#fbbf24', glow: 'rgba(251,191,36,0.48)' },
  { id: 'emerald', label: 'Esmeralda', accent: '#34d399', glow: 'rgba(52,211,153,0.48)' },
  { id: 'diamond', label: 'Diamante', accent: '#bfdbfe', glow: 'rgba(191,219,254,0.48)' },
  { id: 'amethyst', label: 'Ametista', accent: '#c084fc', glow: 'rgba(192,132,252,0.52)' },
  { id: 'obsidian', label: 'Obsidiana', accent: '#94a3b8', glow: 'rgba(148,163,184,0.45)' },
  { id: 'solar', label: 'Solar', accent: '#f59e0b', glow: 'rgba(245,158,11,0.52)' },
  { id: 'eclipse', label: 'Eclipse', accent: '#8b5cf6', glow: 'rgba(139,92,246,0.58)' },
  { id: 'singularity', label: 'Singularity', accent: '#67e8f9', glow: 'rgba(103,232,249,0.5)' },
];

export const PROFILE_EFFECTS: ProfileEffectOption[] = [
  { id: 'none', label: 'Nenhum', glow: 'rgba(255,255,255,0)', ring: 'rgba(255,255,255,0)' },
  { id: 'prism', label: 'Aura Prismática', glow: 'rgba(168,85,247,0.45)', ring: 'rgba(196,181,253,0.72)' },
  { id: 'cyber-nebula', label: 'Cyber Nebula', glow: 'rgba(59,130,246,0.42)', ring: 'rgba(96,165,250,0.68)' },
  { id: 'electric', label: 'Glow Elétrico', glow: 'rgba(34,211,238,0.44)', ring: 'rgba(103,232,249,0.78)' },
  { id: 'violet-smoke', label: 'Fumaça Roxa', glow: 'rgba(168,85,247,0.38)', ring: 'rgba(216,180,254,0.7)' },
  { id: 'void-pulse', label: 'Void Pulse', glow: 'rgba(168,85,247,0.46)', ring: 'rgba(192,132,252,0.78)' },
  { id: 'electric-halo', label: 'Electric Halo', glow: 'rgba(45,212,191,0.4)', ring: 'rgba(103,232,249,0.72)' },
  { id: 'eclipse', label: 'Eclipse Aura', glow: 'rgba(139,92,246,0.5)', ring: 'rgba(216,180,254,0.7)' },
];

export const PROFILE_BADGES: ProfileBadgeOption[] = [
  { id: 'admin', label: 'Admin', accent: '#a78bfa' },
  { id: 'founder', label: 'Founder', accent: '#fbbf24' },
  { id: 'competitive', label: 'Competitive', accent: '#60a5fa' },
  { id: 'elite', label: 'Elite', accent: '#f472b6' },
  { id: 'social', label: 'Social', accent: '#34d399' },
  { id: 'veteran', label: 'Veteran', accent: '#c084fc' },
  { id: 'streamer', label: 'Streamer', accent: '#fb7185' },
  { id: 'none', label: 'Nenhum', accent: '#7c8599' },
];

export const PROFILE_CARD_STYLES: ProfileCardStyle[] = [
  { id: 'violet', label: 'Violet', accent: '#a78bfa', header: '#191526', panel: '#0d0d14' },
  { id: 'blue', label: 'Blue', accent: '#60a5fa', header: '#0f172a', panel: '#0b1020' },
  { id: 'gold', label: 'Gold', accent: '#fbbf24', header: '#211a0f', panel: '#12100b' },
  { id: 'crimson', label: 'Crimson', accent: '#f87171', header: '#1b0b0d', panel: '#12090b' },
  { id: 'emerald', label: 'Emerald', accent: '#34d399', header: '#071b16', panel: '#0b1412' },
];

export const DEFAULT_PROFILE_BANNER = 'void-rift';
export const DEFAULT_PROFILE_FRAME = 'prism';
export const DEFAULT_PROFILE_EFFECT = 'none';
export const DEFAULT_PROFILE_BADGE = 'none';
export const DEFAULT_PROFILE_CARD_STYLE = 'violet';

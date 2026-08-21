export type ProfileBannerOption = {
  id: string;
  label: string;
  gradient: string;
  accent: string;
  glow: string;
  variant: 'rift' | 'nebula' | 'electric' | 'crimson' | 'emerald' | 'aurora' | 'eclipse' | 'singularity' | 'phantom' | 'ascent';
};

export type ProfileFrameOption = {
  id: string;
  label: string;
  accent: string;
  glow: string;
  ring: string;
};

export type ProfileEffectOption = {
  id: string;
  label: string;
  glow: string;
  ring: string;
  variant: 'none' | 'prism' | 'nebula' | 'electric' | 'smoke' | 'void' | 'halo' | 'eclipse';
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
  { id: 'void-rift', label: 'Void Rift', variant: 'rift', gradient: 'radial-gradient(ellipse at 72% 44%, rgba(129,70,255,.34), transparent 22%), radial-gradient(ellipse at 24% 36%, rgba(72,25,145,.44), transparent 26%), linear-gradient(120deg,#05060c 0%,#10071d 42%,#060711 100%)', accent: '#b99cff', glow: 'rgba(139,92,246,.58)' },
  { id: 'nebula-pulse', label: 'Nebula Pulse', variant: 'nebula', gradient: 'radial-gradient(ellipse at 68% 38%, rgba(85,126,255,.32), transparent 20%), radial-gradient(ellipse at 32% 60%, rgba(186,78,255,.40), transparent 26%), linear-gradient(125deg,#050812,#0b1020 48%,#0a0612)', accent: '#8fb2ff', glow: 'rgba(96,165,250,.55)' },
  { id: 'electric-core', label: 'Electric Core', variant: 'electric', gradient: 'radial-gradient(circle at 62% 48%, rgba(38,220,255,.36), transparent 14%), radial-gradient(circle at 28% 62%, rgba(107,64,255,.30), transparent 20%), linear-gradient(130deg,#031014,#061424 45%,#070812)', accent: '#67e8f9', glow: 'rgba(34,211,238,.58)' },
  { id: 'crimson-rift', label: 'Crimson Rift', variant: 'crimson', gradient: 'radial-gradient(circle at 72% 40%, rgba(255,63,105,.36), transparent 18%), radial-gradient(circle at 30% 64%, rgba(184,20,66,.32), transparent 20%), linear-gradient(130deg,#120308,#1d080f 45%,#08070b)', accent: '#ff809b', glow: 'rgba(248,113,113,.56)' },
  { id: 'emerald-flux', label: 'Emerald Flux', variant: 'emerald', gradient: 'radial-gradient(circle at 64% 42%, rgba(24,222,164,.34), transparent 18%), radial-gradient(circle at 30% 66%, rgba(25,130,105,.32), transparent 22%), linear-gradient(130deg,#02100c,#071c18 45%,#060a0c)', accent: '#6ee7b7', glow: 'rgba(16,185,129,.52)' },
  { id: 'aurora', label: 'Aurora', variant: 'aurora', gradient: 'radial-gradient(ellipse at 24% 30%, rgba(137,92,246,.36), transparent 22%), radial-gradient(ellipse at 70% 64%, rgba(56,189,248,.30), transparent 22%), linear-gradient(130deg,#050710,#0d1020 48%,#080611)', accent: '#c4b5fd', glow: 'rgba(167,139,250,.58)' },
  { id: 'eclipse', label: 'Eclipse', variant: 'eclipse', gradient: 'radial-gradient(circle at 64% 48%, rgba(176,137,255,.24) 0 10%, rgba(7,8,15,.95) 12% 18%, rgba(100,66,180,.20) 22%, transparent 32%), linear-gradient(130deg,#04050a,#100a1b 52%,#04050a)', accent: '#a78bfa', glow: 'rgba(139,92,246,.60)' },
  { id: 'singularity', label: 'Singularity', variant: 'singularity', gradient: 'radial-gradient(circle at 62% 50%, rgba(127,220,255,.36) 0 3%, rgba(73,51,180,.36) 5%, rgba(4,5,11,.95) 15%, transparent 30%), linear-gradient(130deg,#03050a,#090a17 52%,#04050b)', accent: '#8ee7ff', glow: 'rgba(103,232,249,.58)' },
  { id: 'phantom', label: 'Phantom', variant: 'phantom', gradient: 'radial-gradient(ellipse at 64% 38%, rgba(170,170,255,.20), transparent 20%), linear-gradient(120deg,#040509,#0b0b13 46%,#05050a)', accent: '#d8d8ff', glow: 'rgba(196,181,253,.46)' },
  { id: 'ascent', label: 'Ascent', variant: 'ascent', gradient: 'radial-gradient(ellipse at 62% 40%, rgba(192,122,255,.28), transparent 16%), radial-gradient(ellipse at 35% 72%, rgba(90,52,180,.24), transparent 18%), linear-gradient(130deg,#05050a,#15091d 48%,#06060b)', accent: '#e0b4ff', glow: 'rgba(192,132,252,.60)' },
];

export const PROFILE_FRAMES: ProfileFrameOption[] = [
  { id: 'none', label: 'Sem moldura', accent: 'transparent', glow: 'transparent', ring: 'transparent' },
  { id: 'prism', label: 'Prismático', accent: '#b99cff', glow: 'rgba(167,139,250,.64)', ring: 'conic-gradient(from 0deg,#7c3aed,#b794f4,#62d9ff,#d8b4fe,#7c3aed)' },
  { id: 'carmesim', label: 'Carmesim', accent: '#ff6b85', glow: 'rgba(248,113,113,.62)', ring: 'conic-gradient(from 20deg,#4b0711,#ff365c,#ff9cad,#7a0d20,#ff365c)' },
  { id: 'gold', label: 'Áureo', accent: '#ffd66b', glow: 'rgba(251,191,36,.62)', ring: 'conic-gradient(from 0deg,#5b3904,#f59e0b,#fff0a4,#b96c00,#fbbf24,#5b3904)' },
  { id: 'emerald', label: 'Esmeralda', accent: '#62efbd', glow: 'rgba(52,211,153,.60)', ring: 'conic-gradient(from 0deg,#064e3b,#10b981,#9ef5d6,#0f766e,#34d399,#064e3b)' },
  { id: 'diamond', label: 'Diamante', accent: '#d9eeff', glow: 'rgba(191,219,254,.66)', ring: 'conic-gradient(from 0deg,#5b8db7,#dbeafe,#72d8ff,#ffffff,#7ab2dd,#dbeafe)' },
  { id: 'amethyst', label: 'Ametista', accent: '#d89cff', glow: 'rgba(192,132,252,.66)', ring: 'conic-gradient(from 0deg,#581c87,#c084fc,#f0c4ff,#7e22ce,#d8b4fe,#581c87)' },
  { id: 'obsidian', label: 'Obsidiana', accent: '#a9b1c1', glow: 'rgba(148,163,184,.48)', ring: 'conic-gradient(from 0deg,#111827,#64748b,#111827,#94a3b8,#0f172a,#64748b)' },
  { id: 'solar', label: 'Solar', accent: '#ffb24a', glow: 'rgba(245,158,11,.66)', ring: 'conic-gradient(from 0deg,#7c2d12,#fb923c,#fde68a,#f97316,#fff1b0,#7c2d12)' },
  { id: 'eclipse', label: 'Eclipse', accent: '#9d7cff', glow: 'rgba(139,92,246,.68)', ring: 'conic-gradient(from 0deg,#05050a,#6d28d9,#020205,#c4b5fd,#111827,#6d28d9)' },
  { id: 'singularity', label: 'Singularity', accent: '#82ecff', glow: 'rgba(103,232,249,.68)', ring: 'conic-gradient(from 0deg,#07101a,#22d3ee,#ffffff,#7c3aed,#22d3ee,#07101a)' },
];

export const PROFILE_EFFECTS: ProfileEffectOption[] = [
  { id: 'none', label: 'Nenhum', variant: 'none', glow: 'rgba(255,255,255,0)', ring: 'transparent' },
  { id: 'prism', label: 'Aura Prismática', variant: 'prism', glow: 'rgba(168,85,247,.62)', ring: 'rgba(196,181,253,.82)' },
  { id: 'cyber-nebula', label: 'Cyber Nebula', variant: 'nebula', glow: 'rgba(59,130,246,.60)', ring: 'rgba(96,165,250,.76)' },
  { id: 'electric', label: 'Glow Elétrico', variant: 'electric', glow: 'rgba(34,211,238,.65)', ring: 'rgba(103,232,249,.88)' },
  { id: 'violet-smoke', label: 'Fumaça Roxa', variant: 'smoke', glow: 'rgba(168,85,247,.58)', ring: 'rgba(216,180,254,.80)' },
  { id: 'void-pulse', label: 'Void Pulse', variant: 'void', glow: 'rgba(139,92,246,.68)', ring: 'rgba(192,132,252,.88)' },
  { id: 'electric-halo', label: 'Electric Halo', variant: 'halo', glow: 'rgba(45,212,191,.58)', ring: 'rgba(103,232,249,.82)' },
  { id: 'eclipse', label: 'Eclipse Aura', variant: 'eclipse', glow: 'rgba(99,45,196,.70)', ring: 'rgba(216,180,254,.82)' },
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
export const DEFAULT_PROFILE_FRAME = 'none';
export const DEFAULT_PROFILE_EFFECT = 'none';
export const DEFAULT_PROFILE_BADGE = 'none';
export const DEFAULT_PROFILE_CARD_STYLE = 'violet';

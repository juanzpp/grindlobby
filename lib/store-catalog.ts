export type CosmeticKind =
  | "Moldura"
  | "Banner"
  | "Papel de parede"
  | "Badge de perfil"
  | "Cor do chat"
  | "Efeito de lobby";

export type Bundle = {
  id: string;
  name: string;
  accent: string;
  glow: string;
  items: { kind: CosmeticKind; name: string }[];
};

const BUNDLE_KINDS: CosmeticKind[] = [
  "Moldura",
  "Banner",
  "Papel de parede",
  "Badge de perfil",
  "Cor do chat",
  "Efeito de lobby",
];

function makeItems(prefix: string) {
  return BUNDLE_KINDS.map((kind) => ({ kind, name: `${kind} ${prefix}` }));
}

export const BUNDLES: Bundle[] = [
  { id: "cyber", name: "Cyber Set", accent: "oklch(0.62 0.15 220)", glow: "oklch(0.78 0.14 215)", items: makeItems("Cyber") },
  { id: "elite", name: "Elite Set", accent: "oklch(0.72 0.16 88)", glow: "oklch(0.86 0.15 95)", items: makeItems("Elite Gold") },
  { id: "competitive", name: "Competitive Set", accent: "oklch(0.6 0.22 302)", glow: "oklch(0.76 0.2 305)", items: makeItems("Competitivo") },
  { id: "cosmic", name: "Cosmic Set", accent: "oklch(0.58 0.14 268)", glow: "oklch(0.78 0.12 275)", items: makeItems("Cosmic") },
  { id: "champion", name: "Champion Set", accent: "oklch(0.56 0.22 20)", glow: "oklch(0.74 0.2 28)", items: makeItems("Champion") },
];

export const STORE_CATEGORIES = ["Bundles", "Molduras", "Banners", "Papéis de parede", "Efeitos", "Pro"] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export type ShelfItem = { id: string; name: string; kind: CosmeticKind; accent: string };

export const SHELVES: { title: string; items: ShelfItem[] }[] = [
  {
    title: "Itens em destaque",
    items: [
      { id: "prism", name: "Moldura Prismática", kind: "Moldura", accent: "oklch(0.62 0.2 302)" },
      { id: "electric-halo", name: "Efeito Electric Halo", kind: "Efeito de lobby", accent: "oklch(0.7 0.16 160)" },
      { id: "void-rift", name: "Banner Void Rift", kind: "Banner", accent: "oklch(0.6 0.18 280)" },
    ],
  },
  {
    title: "Adicionados recentemente",
    items: [
      { id: "gold", name: "Moldura Áurea", kind: "Moldura", accent: "oklch(0.72 0.16 88)" },
      { id: "founder", name: "Badge Founder", kind: "Badge de perfil", accent: "oklch(0.72 0.16 88)" },
      { id: "aurora", name: "Banner Aurora", kind: "Banner", accent: "oklch(0.62 0.15 220)" },
    ],
  },
  {
    title: "Mais populares",
    items: [
      { id: "amethyst", name: "Moldura Ametista", kind: "Moldura", accent: "oklch(0.72 0.16 88)" },
      { id: "void-pulse", name: "Efeito Void Pulse", kind: "Efeito de lobby", accent: "oklch(0.68 0.2 35)" },
      { id: "nebula-pulse", name: "Banner Nebula Pulse", kind: "Banner", accent: "oklch(0.6 0.22 302)" },
    ],
  },
];

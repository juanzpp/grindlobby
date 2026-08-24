import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { MAX_LEVEL, xpForLevel } from "@/lib/levels";
import { STORE_ITEMS, type StoreItem } from "@/lib/store-items";

export type PlayerProfile = {
  nickname: string;
  handle: string;
  email: string;
  bio: string;
  status: "online" | "ausente" | "ocupado" | "invisivel";
  region: string;
  game: string;
  level: number;
  xp: number;
  coins: number;
  owned: string[];
  /** foto de perfil enviada do dispositivo (data URL) */
  avatarUrl: string;
  /** banner personalizado enviado do dispositivo (data URL) */
  bannerUrl: string;
  accent: string;
  equipped: {
    border: string;
    title: string;
    banner: string;
  };
  privateProfile: boolean;
  allowInvites: boolean;
};


const STORAGE_KEY = "grindlobby.player.v1";

const DEFAULT_PLAYER: PlayerProfile = {
  nickname: "juan",
  handle: "juanzin",
  email: "juannsiilvah@gmail.com",
  bio: "Começando do zero. Meta: level 40.",
  status: "online",
  region: "BR-Sul",
  game: "EA FC 27",
  level: 0,
  xp: 0,
  coins: 1200,
  owned: ["border-none", "title-none", "banner-none"],
  avatarUrl: "",
  bannerUrl: "",
  accent: "oklch(0.58 0.24 300)",

  equipped: { border: "border-none", title: "title-none", banner: "banner-none" },
  privateProfile: false,
  allowInvites: true,
};

type PlayerContextValue = {
  player: PlayerProfile;
  update: (patch: Partial<PlayerProfile>) => void;
  addXp: (amount: number) => void;
  buy: (item: StoreItem) => { ok: boolean; reason?: string };
  equip: (item: StoreItem) => void;
  reset: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

function slotKey(kind: StoreItem["kind"]): keyof PlayerProfile["equipped"] | null {
  if (kind === "border") return "border";
  if (kind === "title") return "title";
  if (kind === "banner") return "banner";
  return null;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<PlayerProfile>(DEFAULT_PLAYER);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPlayer({ ...DEFAULT_PLAYER, ...(JSON.parse(raw) as PlayerProfile) });
    } catch {
      /* ignore corrupted storage */
    }
  }, []);

  const persist = useCallback((next: PlayerProfile) => {
    setPlayer(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const update = useCallback(
    (patch: Partial<PlayerProfile>) => {
      setPlayer((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
    },
    [],
  );

  const addXp = useCallback((amount: number) => {
    setPlayer((prev) => {
      let level = prev.level;
      let xp = prev.xp + amount;
      let coins = prev.coins;
      while (level < MAX_LEVEL && xp >= xpForLevel(level)) {
        xp -= xpForLevel(level);
        level += 1;
        coins += 150;
      }
      if (level >= MAX_LEVEL) xp = 0;
      const next = { ...prev, level, xp, coins };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const buy = useCallback(
    (item: StoreItem) => {
      if (player.owned.includes(item.id)) return { ok: false, reason: "Já é seu" };
      if (player.level < item.minLevel)
        return { ok: false, reason: `Requer level ${item.minLevel}` };
      if (player.coins < item.price) return { ok: false, reason: "Moedas insuficientes" };
      const owned = [...player.owned, item.id];
      const slot = slotKey(item.kind);
      persist({
        ...player,
        coins: player.coins - item.price,
        owned,
        equipped: slot ? { ...player.equipped, [slot]: item.id } : player.equipped,
      });
      return { ok: true };
    },
    [persist, player],
  );

  const equip = useCallback(
    (item: StoreItem) => {
      const slot = slotKey(item.kind);
      if (!slot || !player.owned.includes(item.id)) return;
      persist({ ...player, equipped: { ...player.equipped, [slot]: item.id } });
    },
    [persist, player],
  );

  const reset = useCallback(() => persist(DEFAULT_PLAYER), [persist]);

  const value = useMemo(
    () => ({ player, update, addXp, buy, equip, reset }),
    [player, update, addXp, buy, equip, reset],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer deve ser usado dentro de PlayerProvider");
  return ctx;
}

export function findItem(id: string): StoreItem | undefined {
  return STORE_ITEMS.find((i) => i.id === id);
}

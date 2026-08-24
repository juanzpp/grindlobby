import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://eilaxaklqgyvgjgpkonv.supabase.co";
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_t_uiyr5fFapSPvusy5DtBA_M86m5bzO";
const PERSISTENCE_MODE_KEY = "grind-auth-persistence";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL?.trim() || FALLBACK_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  FALLBACK_PUBLISHABLE_KEY;

function inBrowser() {
  return typeof window !== "undefined";
}

function readPersistenceMode() {
  if (!inBrowser()) return "local" as const;

  try {
    return window.localStorage.getItem(PERSISTENCE_MODE_KEY) === "session"
      ? ("session" as const)
      : ("local" as const);
  } catch {
    return "session" as const;
  }
}

const authStorage = {
  getItem(key: string) {
    if (!inBrowser()) return null;

    try {
      return (
        window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
      );
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string) {
    if (!inBrowser()) return;

    try {
      const persistent = readPersistenceMode() === "local";
      const primary = persistent ? window.localStorage : window.sessionStorage;
      const secondary = persistent ? window.sessionStorage : window.localStorage;

      secondary.removeItem(key);
      primary.setItem(key, value);
    } catch {
      // Storage can be unavailable in strict privacy modes. Supabase will keep
      // the current in-memory session for the lifetime of the page.
    }
  },

  removeItem(key: string) {
    if (!inBrowser()) return;

    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // Nothing else to clear when browser storage is unavailable.
    }
  },
};

export function setAuthPersistence(persist: boolean) {
  if (!inBrowser()) return;

  try {
    window.localStorage.setItem(
      PERSISTENCE_MODE_KEY,
      persist ? "local" : "session",
    );
  } catch {
    // Session-only behavior is the safe fallback when localStorage is blocked.
  }
}

export type GrindProfile = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar: string | null;
  status: string | null;
  account_tier: string | null;
  app_role: string | null;
  account_level: number | null;
  account_xp: number | null;
  avatar_frame: string;
  profile_banner: string | null;
  profile_effect: string | null;
  profile_badge: string | null;
  profile_card_style: string | null;
  cosmetic_owned: unknown;
  cosmetic_equipped: unknown;
};

export const PROFILE_SELECT =
  "id,username,email,display_name,avatar,status,account_tier,app_role,account_level,account_xp,avatar_frame,profile_banner,profile_effect,profile_badge,profile_card_style,cosmetic_owned,cosmetic_equipped";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
  },
});

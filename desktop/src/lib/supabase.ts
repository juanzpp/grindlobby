import { createClient, type Session } from '@supabase/supabase-js'

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://eilaxaklqgyvgjgpkonv.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || 'sb_publishable_t_uiyr5fFapSPvusy5DtBA_M86m5bzO'

const STORAGE_MODE = 'grind:desktop:remember'

const authStorage = {
  getItem(key: string) {
    try {
      return localStorage.getItem(key) ?? sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string) {
    try {
      const persistent = localStorage.getItem(STORAGE_MODE) !== 'session'
      const primary = persistent ? localStorage : sessionStorage
      const secondary = persistent ? sessionStorage : localStorage
      secondary.removeItem(key)
      primary.setItem(key, value)
    } catch {
      // Storage can be blocked by hardened WebView policies.
    }
  },
  removeItem(key: string) {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {
      // Nothing else to clear.
    }
  },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: authStorage,
  },
  global: {
    headers: { 'x-grindlobby-client': 'desktop-v2' },
  },
})

export const EDGE_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`
export const MEDIA_GATEWAY =
  import.meta.env.VITE_GRIND_API_URL?.trim().replace(/\/$/, '') || `${EDGE_FUNCTION_BASE}/grind-gateway`

export function setRememberSession(remember: boolean) {
  try {
    localStorage.setItem(STORAGE_MODE, remember ? 'local' : 'session')
  } catch {
    // Session storage remains the fallback.
  }
}

export async function signIn(identifier: string, password: string, remember: boolean) {
  const login = identifier.trim()
  setRememberSession(remember)

  if (login.includes('@')) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: login.toLowerCase(), password })
    if (error) throw error
    return data.session
  }

  const response = await fetch(`${EDGE_FUNCTION_BASE}/username-login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ username: login, password }),
  })
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; session?: { access_token: string; refresh_token: string } }
    | null

  if (!response.ok || !payload?.session?.access_token || !payload.session.refresh_token) {
    throw new Error(payload?.error || 'Credenciais inválidas.')
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: payload.session.access_token,
    refresh_token: payload.session.refresh_token,
  })
  if (error) throw error
  return data.session
}

export async function signUp(email: string, password: string, username: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedUsername = username.trim()
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(normalizedUsername)) {
    throw new Error('Usuário precisa ter de 3 a 32 caracteres.')
  }
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { username: normalizedUsername, display_name: normalizedUsername },
    },
  })
  if (error) throw error
  return data.session
}

export async function signOut() {
  await supabase.auth.signOut()
  localStorage.removeItem('grind:desktop:activeLobby')
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

import type { Provider } from '@supabase/supabase-js'
import { EDGE_FUNCTION_BASE, supabase } from './supabase'

export type SocialProvider = 'steam' | 'discord' | 'google' | 'xbox'

const CALLBACK_URL = 'grindlobby://auth/callback'

function providerForSupabase(provider: Exclude<SocialProvider, 'steam'>): Provider {
  return provider === 'xbox' ? 'azure' : provider
}

async function openExternal(url: string) {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } catch {
    // CI preview has no Tauri runtime. This fallback is only for preview/dev.
    window.location.assign(url)
  }
}

export async function beginSocialLogin(provider: SocialProvider) {
  if (provider === 'steam') {
    const url = new URL(`${EDGE_FUNCTION_BASE}/steam-oauth`)
    url.searchParams.set('redirect_to', CALLBACK_URL)
    await openExternal(url.toString())
    return
  }

  const options: {
    redirectTo: string
    skipBrowserRedirect: true
    scopes?: string
  } = {
    redirectTo: CALLBACK_URL,
    skipBrowserRedirect: true,
  }

  if (provider === 'xbox') options.scopes = 'email'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: providerForSupabase(provider),
    options,
  })

  if (error) throw error
  if (!data.url) throw new Error('O provedor de login não retornou uma URL de autenticação.')
  await openExternal(data.url)
}

export async function consumeAuthDeepLink(rawUrl: string) {
  const url = new URL(rawUrl)
  if (url.protocol !== 'grindlobby:' || url.hostname !== 'auth' || url.pathname !== '/callback') return false

  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const query = url.searchParams
  const authError = hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error')
  if (authError) throw new Error(authError)

  const accessToken = hash.get('access_token') || query.get('access_token')
  const refreshToken = hash.get('refresh_token') || query.get('refresh_token')
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    if (error) throw error
    return true
  }

  const code = query.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    return true
  }

  throw new Error('Retorno de autenticação inválido.')
}

export async function installOAuthDeepLinkListener(onError?: (message: string) => void) {
  try {
    const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link')
    const handle = (urls: string[]) => {
      for (const url of urls) {
        void consumeAuthDeepLink(url).catch((error) => {
          onError?.(error instanceof Error ? error.message : 'Falha ao concluir login social.')
        })
      }
    }

    const current = await getCurrent()
    if (current?.length) handle(current)
    return await onOpenUrl(handle)
  } catch {
    // Browser-only preview intentionally has no deep-link runtime.
    return () => {}
  }
}

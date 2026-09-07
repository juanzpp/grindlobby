import { invoke } from '@tauri-apps/api/core'
import { MEDIA_GATEWAY, supabase } from './supabase'
import type { StreamPreset } from './voice'

export type CaptureSourceKind = 'screen' | 'window'
export type NativeCaptureSource = {
  id: number
  title: string
  displayId: number
  kind: CaptureSourceKind
}

export async function listNativeCaptureSources(kind: CaptureSourceKind): Promise<NativeCaptureSource[]> {
  return invoke<NativeCaptureSource[]>('list_capture_sources', { kind })
}

async function getNativeScreenToken(lobbyId: string) {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) throw new Error('Sessão expirada. Entre novamente.')

  const response = await fetch(`${MEDIA_GATEWAY}/api/livekit-token`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ lobbyId, publisher: 'screen-native' }),
  })
  const payload = (await response.json().catch(() => null)) as { token?: string; url?: string; error?: string } | null
  if (!response.ok || !payload?.token || !payload.url) {
    throw new Error(payload?.error || 'Servidor de transmissão indisponível.')
  }
  return { token: payload.token, url: payload.url }
}

export async function startNativeScreenShare(input: {
  lobbyId: string
  source: NativeCaptureSource
  preset: StreamPreset
  includeCursor?: boolean
}) {
  const credentials = await getNativeScreenToken(input.lobbyId)
  await invoke('start_native_screen_share', {
    request: {
      token: credentials.token,
      url: credentials.url,
      sourceKind: input.source.kind,
      sourceId: input.source.id,
      preset: input.preset,
      includeCursor: input.includeCursor ?? true,
    },
  })
}

export async function stopNativeScreenShare() {
  await invoke('stop_native_screen_share')
}

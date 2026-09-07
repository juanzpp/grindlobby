import {
  voiceSession as nativeSafeVoiceSession,
  type StreamPreset,
  type VoiceParticipant,
  type VoiceSnapshot as NativeSafeVoiceSnapshot,
} from './voice-v3'

export type { StreamPreset, VoiceParticipant }

export type VoiceSnapshot = NativeSafeVoiceSnapshot & {
  /** Compatibility field for the retired V2 surface. V3 screen capture is Rust/Windows only. */
  localScreen: MediaStream | null
}

function adaptSnapshot(value: NativeSafeVoiceSnapshot): VoiceSnapshot {
  return { ...value, localScreen: null }
}

/**
 * Voice stays on LiveKit/WebRTC inside the desktop client.
 * Screen capture is intentionally NOT implemented here: the V3 runtime routes
 * monitor/window capture exclusively through Tauri + the Windows desktop capturer.
 */
export const voiceSession = {
  get snapshot(): VoiceSnapshot {
    return adaptSnapshot(nativeSafeVoiceSession.snapshot)
  },
  subscribe(listener: (value: VoiceSnapshot) => void) {
    return nativeSafeVoiceSession.subscribe((value) => listener(adaptSnapshot(value)))
  },
  connect: nativeSafeVoiceSession.connect.bind(nativeSafeVoiceSession),
  setMuted: nativeSafeVoiceSession.setMuted.bind(nativeSafeVoiceSession),
  setDeafened: nativeSafeVoiceSession.setDeafened.bind(nativeSafeVoiceSession),
  setOutput: nativeSafeVoiceSession.setOutput.bind(nativeSafeVoiceSession),
  replaceMicrophone: nativeSafeVoiceSession.replaceMicrophone.bind(nativeSafeVoiceSession),
  disconnect: nativeSafeVoiceSession.disconnect.bind(nativeSafeVoiceSession),
  async startScreen(_preset: StreamPreset): Promise<MediaStream> {
    throw new Error('O Grind Desktop V3 usa captura nativa do Windows. Abra o seletor de tela dentro do Grind.')
  },
  async stopScreen(): Promise<void> {
    // V3 calls stop_native_screen_share through native-screen.ts.
  },
}

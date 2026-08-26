type CallSnapshot = {
  lobbyId: string | null;
  micStream: MediaStream | null;
  muted: boolean;
};

const state: CallSnapshot = { lobbyId: null, micStream: null, muted: false };
const listeners = new Set<() => void>();

function emit() { listeners.forEach((fn) => fn()); }

export const callSession = {
  get snapshot() { return state; },
  subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); },
  attach(lobbyId: string, stream: MediaStream) {
    if (state.micStream && state.micStream !== stream) state.micStream.getTracks().forEach((t) => t.stop());
    state.lobbyId = lobbyId;
    state.micStream = stream;
    state.muted = !stream.getAudioTracks().some((t) => t.enabled);
    emit();
  },
  setMuted(muted: boolean) {
    state.muted = muted;
    state.micStream?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    emit();
  },
  leave() {
    state.micStream?.getTracks().forEach((t) => t.stop());
    state.lobbyId = null;
    state.micStream = null;
    state.muted = false;
    emit();
  },
};

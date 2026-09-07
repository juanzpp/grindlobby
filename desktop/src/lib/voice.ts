import {
  ConnectionState,
  LocalAudioTrack,
  RemoteAudioTrack,
  RemoteVideoTrack,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client'
import { MEDIA_GATEWAY, supabase } from './supabase'

export type StreamPreset = '480p30' | '480p60' | '720p30' | '720p60' | '1080p30' | '1080p60'
export type VoiceParticipant = { id: string; name: string; speaking: boolean; audioLevel: number; muted: boolean; sharing: boolean }
export type VoiceSnapshot = {
  lobbyCode: string | null
  connected: boolean
  connecting: boolean
  muted: boolean
  deafened: boolean
  sharing: boolean
  rttMs: number | null
  participants: VoiceParticipant[]
  localScreen: MediaStream | null
  remoteScreens: Record<string, MediaStream>
}
type Listener = (value: VoiceSnapshot) => void

let room: Room | null = null
let lobbyCode: string | null = null
let microphone: MediaStream | null = null
let localScreen: MediaStream | null = null
let muted = false
let deafened = false
let connecting = false
let outputVolume = 0.8
let outputDeviceId = ''
let rttMs: number | null = null
let metricTimer: number | null = null
const listeners = new Set<Listener>()
const audioElements = new Map<string, HTMLAudioElement>()
const remoteScreens = new Map<string, MediaStream>()

function participants(): VoiceParticipant[] {
  if (!room) return []
  const result: VoiceParticipant[] = []
  const local = room.localParticipant
  result.push({ id: local.identity, name: local.name || 'Você', speaking: local.isSpeaking, audioLevel: local.audioLevel, muted: Boolean(local.getTrackPublication(Track.Source.Microphone)?.isMuted), sharing: Boolean(local.getTrackPublication(Track.Source.ScreenShare)) })
  for (const participant of room.remoteParticipants.values()) {
    result.push({ id: participant.identity, name: participant.name || 'Jogador', speaking: participant.isSpeaking, audioLevel: participant.audioLevel, muted: Boolean(participant.getTrackPublication(Track.Source.Microphone)?.isMuted), sharing: Boolean(participant.getTrackPublication(Track.Source.ScreenShare)) })
  }
  return result
}

function snapshot(): VoiceSnapshot {
  return { lobbyCode, connected: room?.state === ConnectionState.Connected, connecting, muted, deafened, sharing: Boolean(localScreen), rttMs, participants: participants(), localScreen, remoteScreens: Object.fromEntries(remoteScreens) }
}
function emit() { const value = snapshot(); listeners.forEach((listener) => listener(value)) }
async function applyOutput(element: HTMLAudioElement) {
  const selectable = element as HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> }
  if (outputDeviceId && selectable.setSinkId) await selectable.setSinkId(outputDeviceId).catch(() => {})
  element.volume = outputVolume
  element.muted = deafened
}
function audioKey(participant: string, source: Track.Source) { return `${participant}:${source}` }
function attachRemoteAudio(track: RemoteAudioTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) {
  const key = audioKey(participant.identity, publication.source)
  const previous = audioElements.get(key)
  if (previous) { track.detach(previous); previous.remove() }
  const element = document.createElement('audio')
  element.autoplay = true
  element.setAttribute('playsinline', '')
  element.style.display = 'none'
  document.body.appendChild(element)
  track.attach(element)
  audioElements.set(key, element)
  void applyOutput(element).then(() => element.play().catch(() => {}))
}
function removeParticipantMedia(participantId: string) {
  for (const [key, element] of audioElements) {
    if (!key.startsWith(`${participantId}:`)) continue
    element.pause(); element.srcObject = null; element.remove(); audioElements.delete(key)
  }
  remoteScreens.delete(participantId)
}
function onTrackSubscribed(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) {
  if (track instanceof RemoteAudioTrack) attachRemoteAudio(track, publication, participant)
  if (track instanceof RemoteVideoTrack && publication.source === Track.Source.ScreenShare) remoteScreens.set(participant.identity, new MediaStream([track.mediaStreamTrack]))
  emit()
}
function onTrackUnsubscribed(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) {
  if (track instanceof RemoteAudioTrack) {
    const key = audioKey(participant.identity, publication.source)
    const element = audioElements.get(key)
    if (element) { track.detach(element); element.pause(); element.remove(); audioElements.delete(key) }
  }
  if (publication.source === Track.Source.ScreenShare) remoteScreens.delete(participant.identity)
  emit()
}
function bind(nextRoom: Room) {
  const sync = () => emit()
  nextRoom.on(RoomEvent.Connected, sync).on(RoomEvent.Reconnecting, sync).on(RoomEvent.Reconnected, sync).on(RoomEvent.ConnectionStateChanged, sync).on(RoomEvent.ParticipantConnected, sync).on(RoomEvent.ParticipantDisconnected, (participant) => { removeParticipantMedia(participant.identity); emit() }).on(RoomEvent.ActiveSpeakersChanged, sync).on(RoomEvent.TrackMuted, sync).on(RoomEvent.TrackUnmuted, sync).on(RoomEvent.TrackSubscribed, onTrackSubscribed).on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
}
async function requestToken(code: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente.')
  const response = await fetch(`${MEDIA_GATEWAY}/api/livekit-token`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ lobbyId: code }) })
  const payload = (await response.json().catch(() => null)) as { token?: string; url?: string; error?: string } | null
  if (!response.ok || !payload?.token || !payload.url) throw new Error(payload?.error || 'Servidor de voz indisponível.')
  return { token: payload.token, url: payload.url }
}
async function getMicrophone(deviceId?: string, settings?: { noiseSuppression?: boolean; echoCancellation?: boolean; autoGainControl?: boolean }) {
  return navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId ? { exact: deviceId } : undefined, channelCount: 1, sampleRate: 48000, noiseSuppression: settings?.noiseSuppression ?? true, echoCancellation: settings?.echoCancellation ?? true, autoGainControl: settings?.autoGainControl ?? true }, video: false })
}
async function publishMicrophone(stream: MediaStream) {
  if (!room || room.state !== ConnectionState.Connected) return
  const raw = stream.getAudioTracks()[0]
  if (!raw) throw new Error('Microfone indisponível.')
  const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone)
  const current = publication?.track
  if (!(current instanceof LocalAudioTrack) || current.mediaStreamTrack.id !== raw.id) {
    if (current) await room.localParticipant.unpublishTrack(current, false)
    await room.localParticipant.publishTrack(raw, { source: Track.Source.Microphone, dtx: true, red: true })
  }
  microphone = stream
  const next = room.localParticipant.getTrackPublication(Track.Source.Microphone)
  if (next) { if (muted) await next.mute(); else await next.unmute() }
}
async function collectMetrics() {
  const track = room?.localParticipant.getTrackPublication(Track.Source.Microphone)?.track
  if (!(track instanceof LocalAudioTrack)) return
  try {
    const report = await track.getRTCStatsReport(); let nextRtt: number | null = null
    report?.forEach((raw) => { const row = raw as RTCStats & { state?: string; currentRoundTripTime?: number }; if (row.type === 'candidate-pair' && row.state === 'succeeded' && typeof row.currentRoundTripTime === 'number') nextRtt = Math.round(row.currentRoundTripTime * 1000) })
    rttMs = nextRtt; emit()
  } catch { /* metrics are diagnostic only */ }
}
function startMetrics() { if (metricTimer) window.clearInterval(metricTimer); metricTimer = window.setInterval(() => void collectMetrics(), 3000) }
function stopMetrics() { if (metricTimer) window.clearInterval(metricTimer); metricTimer = null; rttMs = null }
const screenPresets: Record<StreamPreset, { width: number; height: number; frameRate: number }> = {
  '480p30': { width: 854, height: 480, frameRate: 30 }, '480p60': { width: 854, height: 480, frameRate: 60 }, '720p30': { width: 1280, height: 720, frameRate: 30 }, '720p60': { width: 1280, height: 720, frameRate: 60 }, '1080p30': { width: 1920, height: 1080, frameRate: 30 }, '1080p60': { width: 1920, height: 1080, frameRate: 60 },
}

export const voiceSession = {
  get snapshot() { return snapshot() },
  subscribe(listener: Listener) { listeners.add(listener); listener(snapshot()); return () => { listeners.delete(listener) } },
  async connect(code: string, options?: { inputDeviceId?: string; outputDeviceId?: string; outputVolume?: number; noiseSuppression?: boolean; echoCancellation?: boolean; autoGainControl?: boolean }) {
    if (room && lobbyCode === code && room.state !== ConnectionState.Disconnected) return
    await this.disconnect(); connecting = true; lobbyCode = code; outputDeviceId = options?.outputDeviceId || ''; outputVolume = Math.max(0, Math.min(1, (options?.outputVolume ?? 80) / 100)); emit()
    try {
      const [credentials, mic] = await Promise.all([requestToken(code), getMicrophone(options?.inputDeviceId, options)])
      const nextRoom = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: false }); room = nextRoom; bind(nextRoom)
      await nextRoom.connect(credentials.url, credentials.token, { autoSubscribe: true }); await publishMicrophone(mic); connecting = false; startMetrics(); emit()
    } catch (error) { connecting = false; await this.disconnect(); throw error }
  },
  async setMuted(value: boolean) { muted = value; const publication = room?.localParticipant.getTrackPublication(Track.Source.Microphone); if (publication) { if (value) await publication.mute(); else await publication.unmute() } emit() },
  setDeafened(value: boolean) { deafened = value; for (const element of audioElements.values()) element.muted = value; emit() },
  setOutput(deviceId: string, volumePercent: number) { outputDeviceId = deviceId; outputVolume = Math.max(0, Math.min(1, volumePercent / 100)); for (const element of audioElements.values()) void applyOutput(element) },
  async replaceMicrophone(deviceId: string, settings?: { noiseSuppression?: boolean; echoCancellation?: boolean; autoGainControl?: boolean }) { const next = await getMicrophone(deviceId, settings); const previous = microphone; await publishMicrophone(next); previous?.getTracks().forEach((track) => track.stop()) },
  async startScreen(preset: StreamPreset) {
    if (!room || room.state !== ConnectionState.Connected) throw new Error('Entre em uma call antes de transmitir a tela.')
    await this.stopScreen(); const target = screenPresets[preset]
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: { ideal: target.width }, height: { ideal: target.height }, frameRate: { ideal: target.frameRate, max: target.frameRate } }, audio: true })
    localScreen = stream; const video = stream.getVideoTracks()[0]; const audio = stream.getAudioTracks()[0]
    if (video) { await room.localParticipant.publishTrack(video, { source: Track.Source.ScreenShare }); video.addEventListener('ended', () => void this.stopScreen(), { once: true }) }
    if (audio) await room.localParticipant.publishTrack(audio, { source: Track.Source.ScreenShareAudio }); emit(); return stream
  },
  async stopScreen() {
    if (room) for (const source of [Track.Source.ScreenShare, Track.Source.ScreenShareAudio]) { const publication = room.localParticipant.getTrackPublication(source); if (publication?.track) await room.localParticipant.unpublishTrack(publication.track, true).catch(() => {}) }
    localScreen?.getTracks().forEach((track) => track.stop()); localScreen = null; emit()
  },
  async disconnect() {
    stopMetrics(); const current = room; room = null; lobbyCode = null; connecting = false; microphone?.getTracks().forEach((track) => track.stop()); localScreen?.getTracks().forEach((track) => track.stop()); microphone = null; localScreen = null
    for (const element of audioElements.values()) { element.pause(); element.srcObject = null; element.remove() }
    audioElements.clear(); remoteScreens.clear(); if (current) { current.removeAllListeners(); await current.disconnect().catch(() => {}) } emit()
  },
}

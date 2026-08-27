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
} from "livekit-client";
import { supabase } from "@/lib/supabase";
import { callSession } from "@/lib/call-session";

export type LiveKitParticipantState = {
  userId: string;
  name: string;
  speaking: boolean;
  audioLevel: number;
  microphoneMuted: boolean;
  sharing: boolean;
};

export type LiveKitSessionSnapshot = {
  lobbyId: string | null;
  connected: boolean;
  connectionState: ConnectionState;
  participants: LiveKitParticipantState[];
  remoteScreens: Record<string, MediaStream>;
  localScreen: MediaStream | null;
};

type Listener = (snapshot: LiveKitSessionSnapshot) => void;

type ConnectOptions = {
  lobbyId: string;
  microphone: MediaStream;
  muted: boolean;
  outputDeviceId?: string;
  outputVolume?: number;
};

let room: Room | null = null;
let activeLobbyId: string | null = null;
let localMicrophone: MediaStream | null = null;
let localScreen: MediaStream | null = null;
let outputDeviceId = "";
let outputVolume = 0.8;
let deafened = false;
let connectGeneration = 0;
let metricsTimer: number | null = null;
let previousBytes = 0;
let previousBytesAt = 0;
const listeners = new Set<Listener>();
const audioElements = new Map<string, HTMLAudioElement>();
const remoteScreens = new Map<string, MediaStream>();

function participantSnapshot(): LiveKitParticipantState[] {
  if (!room) return [];
  const result: LiveKitParticipantState[] = [];
  const local = room.localParticipant;
  result.push({
    userId: local.identity,
    name: local.name || "Você",
    speaking: local.isSpeaking,
    audioLevel: local.audioLevel,
    microphoneMuted: Boolean(local.getTrackPublication(Track.Source.Microphone)?.isMuted),
    sharing: Boolean(local.getTrackPublication(Track.Source.ScreenShare)),
  });
  for (const participant of room.remoteParticipants.values()) {
    result.push({
      userId: participant.identity,
      name: participant.name || "Jogador",
      speaking: participant.isSpeaking,
      audioLevel: participant.audioLevel,
      microphoneMuted: Boolean(participant.getTrackPublication(Track.Source.Microphone)?.isMuted),
      sharing: Boolean(participant.getTrackPublication(Track.Source.ScreenShare)),
    });
  }
  return result;
}

function snapshot(): LiveKitSessionSnapshot {
  return {
    lobbyId: activeLobbyId,
    connected: room?.state === ConnectionState.Connected,
    connectionState: room?.state ?? ConnectionState.Disconnected,
    participants: participantSnapshot(),
    remoteScreens: Object.fromEntries(remoteScreens),
    localScreen,
  };
}

function emit() {
  const value = snapshot();
  for (const listener of listeners) listener(value);
}

function audioKey(participantId: string, source: Track.Source) {
  return `${participantId}:${source}`;
}

async function applySink(element: HTMLAudioElement) {
  const selectable = element as HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> };
  if (outputDeviceId && selectable.setSinkId) await selectable.setSinkId(outputDeviceId).catch(() => {});
  element.volume = Math.max(0, Math.min(1, outputVolume));
  element.muted = deafened;
}

function attachRemoteAudio(
  track: RemoteAudioTrack,
  publication: RemoteTrackPublication,
  participant: RemoteParticipant,
) {
  const key = audioKey(participant.identity, publication.source);
  const previous = audioElements.get(key);
  if (previous) {
    track.detach(previous);
    previous.remove();
  }
  const audio = document.createElement("audio");
  audio.autoplay = true;
  audio.setAttribute("playsinline", "");
  audio.dataset.grindVoice = key;
  audio.style.display = "none";
  document.body.appendChild(audio);
  track.attach(audio);
  audioElements.set(key, audio);
  void applySink(audio).then(() => audio.play().catch(() => {}));
}

function detachParticipantMedia(participantId: string) {
  for (const [key, audio] of audioElements) {
    if (!key.startsWith(`${participantId}:`)) continue;
    audio.pause();
    audio.srcObject = null;
    audio.remove();
    audioElements.delete(key);
  }
  remoteScreens.delete(participantId);
}

function handleTrackSubscribed(
  track: RemoteTrack,
  publication: RemoteTrackPublication,
  participant: RemoteParticipant,
) {
  if (track instanceof RemoteAudioTrack) {
    attachRemoteAudio(track, publication, participant);
  } else if (track instanceof RemoteVideoTrack && publication.source === Track.Source.ScreenShare) {
    remoteScreens.set(participant.identity, new MediaStream([track.mediaStreamTrack]));
  }
  emit();
}

function handleTrackUnsubscribed(
  track: RemoteTrack,
  publication: RemoteTrackPublication,
  participant: RemoteParticipant,
) {
  if (track instanceof RemoteAudioTrack) {
    const key = audioKey(participant.identity, publication.source);
    const audio = audioElements.get(key);
    if (audio) {
      track.detach(audio);
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      audioElements.delete(key);
    }
  }
  if (publication.source === Track.Source.ScreenShare) remoteScreens.delete(participant.identity);
  emit();
}

function bindRoom(nextRoom: Room) {
  const sync = () => emit();
  nextRoom
    .on(RoomEvent.Connected, sync)
    .on(RoomEvent.Reconnecting, sync)
    .on(RoomEvent.Reconnected, sync)
    .on(RoomEvent.ConnectionStateChanged, sync)
    .on(RoomEvent.ParticipantConnected, sync)
    .on(RoomEvent.ParticipantDisconnected, (participant) => {
      detachParticipantMedia(participant.identity);
      emit();
    })
    .on(RoomEvent.ActiveSpeakersChanged, sync)
    .on(RoomEvent.TrackMuted, sync)
    .on(RoomEvent.TrackUnmuted, sync)
    .on(RoomEvent.TrackPublished, sync)
    .on(RoomEvent.TrackUnpublished, sync)
    .on(RoomEvent.LocalTrackPublished, sync)
    .on(RoomEvent.LocalTrackUnpublished, sync)
    .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
    .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
    .on(RoomEvent.Disconnected, sync);
}

async function publishMicrophone(stream: MediaStream, muted: boolean) {
  if (!room || room.state !== ConnectionState.Connected) return;
  const raw = stream.getAudioTracks()[0];
  if (!raw || raw.readyState !== "live") throw new Error("Microfone indisponível");
  const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  const current = publication?.track;
  if (!(current instanceof LocalAudioTrack) || current.mediaStreamTrack.id !== raw.id) {
    if (current) await room.localParticipant.unpublishTrack(current, false);
    await room.localParticipant.publishTrack(raw, {
      source: Track.Source.Microphone,
      dtx: true,
      red: true,
    });
  }
  localMicrophone = stream;
  const nextPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  if (nextPublication) {
    if (muted) await nextPublication.mute();
    else await nextPublication.unmute();
  }
  callSession.attach(activeLobbyId || "", stream);
  callSession.setMuted(muted);
  emit();
}

async function requestToken(lobbyId: string) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Faça login novamente para entrar na call.");
  const response = await fetch("/api/livekit-token", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ lobbyId }),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { token?: string; url?: string; error?: string }
    | null;
  if (!response.ok || !payload?.token || !payload.url) {
    throw new Error(payload?.error || "Servidor SFU indisponível.");
  }
  return { token: payload.token, url: payload.url };
}

async function collectMetrics() {
  if (!room || room.state !== ConnectionState.Connected) return;
  const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
  if (!(track instanceof LocalAudioTrack)) return;
  try {
    const report = await track.getRTCStatsReport();
    let rttMs: number | null = null;
    let packetsLost: number | null = null;
    let bytes = 0;
    report?.forEach((raw) => {
      const row = raw as RTCStats & {
        state?: string;
        currentRoundTripTime?: number;
        packetsLost?: number;
        bytesSent?: number;
        isRemote?: boolean;
      };
      if (
        row.type === "candidate-pair" &&
        row.state === "succeeded" &&
        typeof row.currentRoundTripTime === "number"
      ) {
        rttMs = Math.round(row.currentRoundTripTime * 1000);
      }
      if (row.type === "remote-inbound-rtp" && typeof row.packetsLost === "number") {
        packetsLost = (packetsLost ?? 0) + row.packetsLost;
      }
      if (row.type === "outbound-rtp" && typeof row.bytesSent === "number") bytes += row.bytesSent;
    });
    const now = Date.now();
    const bitrateKbps =
      previousBytesAt && bytes >= previousBytes
        ? Math.round(((bytes - previousBytes) * 8) / Math.max(1, now - previousBytesAt))
        : null;
    previousBytes = bytes;
    previousBytesAt = now;
    callSession.setMetrics({ rttMs, bitrateKbps, packetsLost });
  } catch {
    // Metrics are diagnostic only; never interrupt the call if a browser omits a stats field.
  }
}

function startMetrics() {
  if (metricsTimer) window.clearInterval(metricsTimer);
  previousBytes = 0;
  previousBytesAt = 0;
  metricsTimer = window.setInterval(() => void collectMetrics(), 3000);
}

function stopMetrics() {
  if (metricsTimer) window.clearInterval(metricsTimer);
  metricsTimer = null;
  previousBytes = 0;
  previousBytesAt = 0;
}

export const livekitSession = {
  get snapshot() {
    return snapshot();
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    listener(snapshot());
    return () => listeners.delete(listener);
  },

  async connect(options: ConnectOptions) {
    outputDeviceId = options.outputDeviceId || "";
    outputVolume = Math.max(0, Math.min(1, (options.outputVolume ?? 80) / 100));
    for (const audio of audioElements.values()) void applySink(audio);

    if (room && activeLobbyId === options.lobbyId && room.state !== ConnectionState.Disconnected) {
      await publishMicrophone(options.microphone, options.muted);
      emit();
      return;
    }

    await this.disconnect(false);
    const generation = ++connectGeneration;
    const credentials = await requestToken(options.lobbyId);
    if (generation !== connectGeneration) return;

    const nextRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
      disconnectOnPageLeave: false,
    });
    room = nextRoom;
    activeLobbyId = options.lobbyId;
    bindRoom(nextRoom);
    emit();

    try {
      await nextRoom.connect(credentials.url, credentials.token, { autoSubscribe: true });
      if (generation !== connectGeneration) {
        nextRoom.removeAllListeners();
        await nextRoom.disconnect();
        return;
      }
      await publishMicrophone(options.microphone, options.muted);
      startMetrics();
      emit();
    } catch (error) {
      if (generation === connectGeneration) await this.disconnect(false);
      throw error;
    }
  },

  async replaceMicrophone(stream: MediaStream, muted: boolean) {
    await publishMicrophone(stream, muted);
  },

  async setMuted(muted: boolean) {
    callSession.setMuted(muted);
    const publication = room?.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (publication) {
      if (muted) await publication.mute();
      else await publication.unmute();
    }
    emit();
  },

  setDeafened(value: boolean) {
    deafened = value;
    for (const audio of audioElements.values()) audio.muted = value;
  },

  setOutput(deviceId: string, volumePercent: number) {
    outputDeviceId = deviceId;
    outputVolume = Math.max(0, Math.min(1, volumePercent / 100));
    for (const audio of audioElements.values()) void applySink(audio);
  },

  async startScreen(stream: MediaStream) {
    if (!room || room.state !== ConnectionState.Connected) throw new Error("A call ainda não conectou.");
    await this.stopScreen(false);
    localScreen = stream;
    const video = stream.getVideoTracks()[0];
    const audio = stream.getAudioTracks()[0];
    if (video) {
      await room.localParticipant.publishTrack(video, { source: Track.Source.ScreenShare });
      video.addEventListener("ended", () => void this.stopScreen(true), { once: true });
    }
    if (audio) await room.localParticipant.publishTrack(audio, { source: Track.Source.ScreenShareAudio });
    emit();
  },

  async stopScreen(stopTracks = true) {
    if (room) {
      for (const source of [Track.Source.ScreenShare, Track.Source.ScreenShareAudio]) {
        const publication = room.localParticipant.getTrackPublication(source);
        if (publication?.track) await room.localParticipant.unpublishTrack(publication.track, stopTracks).catch(() => {});
      }
    }
    if (stopTracks) localScreen?.getTracks().forEach((track) => track.stop());
    localScreen = null;
    emit();
  },

  async disconnect(stopTracks = true) {
    connectGeneration += 1;
    stopMetrics();
    const current = room;
    room = null;
    activeLobbyId = null;
    if (stopTracks) {
      localMicrophone?.getTracks().forEach((track) => track.stop());
      localScreen?.getTracks().forEach((track) => track.stop());
    }
    localMicrophone = null;
    localScreen = null;
    for (const audio of audioElements.values()) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }
    audioElements.clear();
    remoteScreens.clear();
    if (current) {
      current.removeAllListeners();
      await current.disconnect().catch(() => {});
    }
    if (stopTracks) callSession.leave();
    emit();
  },
};

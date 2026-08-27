import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Copy,
  Headphones,
  Home,
  Info,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Settings,
  UserPlus,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { callSession } from "@/lib/call-session";
import { livekitSession, type LiveKitSessionSnapshot } from "@/lib/livekit-session";
import { LobbySettingsModal, type LobbyMediaSettings } from "@/components/LobbySettingsModal";

export const Route = createFileRoute("/sala/$lobbyId")({ component: RoomPage });

type Person = {
  userId: string;
  name: string;
  avatar?: string | null;
  speaking?: boolean;
  sharing?: boolean;
};

type ChatMessage = { u: string; t: string };

const defaults: LobbyMediaSettings = {
  mic: "",
  output: "",
  micVolume: 100,
  outputVolume: 80,
  sensitivity: 45,
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  voiceActivity: true,
  quality: "720p30",
  bitrate: 3500,
  systemAudio: true,
  lowLatency: true,
  hardwareAcceleration: true,
  showPreview: true,
  joinSounds: true,
  muteSounds: true,
};

function readCfg() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem("grind:mediaSettings") || "{}") } as LobbyMediaSettings;
  } catch {
    return defaults;
  }
}

function preset(quality: string) {
  if (quality === "1080p60") return { width: 1920, height: 1080, frameRate: 60 };
  if (quality === "720p30") return { width: 1280, height: 720, frameRate: 30 };
  if (quality === "480p30") return { width: 854, height: 480, frameRate: 30 };
  return { width: 640, height: 360, frameRate: 30 };
}

function initial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}

function Video({ stream, muted = false, onReady }: { stream: MediaStream; muted?: boolean; onReady?: () => void }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    element.muted = muted;
    const ready = () => onReady?.();
    element.addEventListener("loadeddata", ready, { once: true });
    void element.play().catch(() => {});
    return () => {
      element.removeEventListener("loadeddata", ready);
      if (element.srcObject === stream) element.srcObject = null;
    };
  }, [stream, muted, onReady]);
  return <video ref={ref} autoPlay playsInline muted={muted} className="max-h-[520px] w-full rounded-xl object-contain" />;
}

function RoomPage() {
  const { lobbyId } = Route.useParams();
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<LobbyMediaSettings>(defaults);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [micState, setMicState] = useState("conectando ao SFU");
  const [opening, setOpening] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "info">("chat");
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [me, setMe] = useState<Person | null>(null);
  const [presence, setPresence] = useState<Person[]>([]);
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [live, setLive] = useState<LiveKitSessionSnapshot>(() => livekitSession.snapshot);

  const mic = useRef<MediaStream | null>(null);
  const presenceRoom = useRef<any>(null);
  const directory = useRef<any>(null);
  const meter = useRef<number | null>(null);
  const meterContext = useRef<AudioContext | null>(null);
  const meRef = useRef<Person | null>(null);
  const mutedRef = useRef(false);
  const lastSpeaking = useRef(false);

  useEffect(() => livekitSession.subscribe(setLive), []);
  useEffect(() => {
    meRef.current = me;
  }, [me]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const people = useMemo(() => {
    const byId = new Map<string, Person>();
    for (const person of presence) byId.set(person.userId, person);
    for (const participant of live.participants) {
      const previous = byId.get(participant.userId);
      byId.set(participant.userId, {
        userId: participant.userId,
        name: previous?.name || participant.name,
        avatar: previous?.avatar || null,
        speaking: participant.speaking || previous?.speaking,
        sharing: participant.sharing,
      });
    }
    return [...byId.values()];
  }, [presence, live.participants]);

  const activeRemote =
    selectedScreen && live.remoteScreens[selectedScreen]
      ? selectedScreen
      : Object.keys(live.remoteScreens)[0] || null;
  const sharing = people.filter((person) => person.sharing && person.userId !== me?.userId);

  const trackPresence = async (patch: Partial<Person>) => {
    const current = meRef.current;
    if (!current || !presenceRoom.current) return;
    const next = { ...current, ...patch };
    meRef.current = next;
    setMe(next);
    await presenceRoom.current.track(next);
    if (directory.current) {
      const { data: lobby } = await supabase
        .from("lobbies")
        .select("name,game_label,max_members")
        .eq("route_code", lobbyId)
        .maybeSingle();
      await directory.current.track({
        userId: next.userId,
        lobbyId,
        name: lobby?.name || `Lobby ${lobbyId}`,
        game: lobby?.game_label || "EA FC 27",
        maxPlayers: lobby?.max_members || 10,
        sharing: Boolean(next.sharing),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const setupRealtime = (self: Person) => {
    const channel = supabase.channel(`grind:room:${lobbyId}`, {
      config: { presence: { key: self.userId }, broadcast: { ack: false } },
    });
    presenceRoom.current = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        const flat = Object.values(channel.presenceState<Person>())
          .flat()
          .map((value) => value as unknown as Person);
        setPresence([...new Map(flat.map((person) => [person.userId, person])).values()]);
      })
      .on("broadcast", { event: "chat" }, ({ payload }: { payload: ChatMessage }) => {
        setMessages((value) => [...value, payload]);
      })
      .subscribe(async (state: string) => {
        if (state === "SUBSCRIBED") await channel.track(self);
      });

    const lobbyDirectory = supabase.channel("grind:lobby-directory", {
      config: { presence: { key: self.userId } },
    });
    directory.current = lobbyDirectory;
    lobbyDirectory.subscribe(async (state: string) => {
      if (state === "SUBSCRIBED") await trackPresence({});
    });
  };

  const startMeter = (stream: MediaStream, settings: LobbyMediaSettings, self: Person) => {
    if (meter.current) cancelAnimationFrame(meter.current);
    void meterContext.current?.close().catch(() => {});
    try {
      const context = new AudioContext();
      meterContext.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) {
          const normalized = (value - 128) / 128;
          sum += normalized * normalized;
        }
        const speaking =
          settings.voiceActivity &&
          !mutedRef.current &&
          Math.sqrt(sum / data.length) > Math.max(0.015, (100 - settings.sensitivity) / 2200);
        if (speaking !== lastSpeaking.current) {
          lastSpeaking.current = speaking;
          const current = meRef.current || self;
          const next = { ...current, speaking };
          meRef.current = next;
          setMe(next);
          void presenceRoom.current?.track(next);
        }
        meter.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Browser audio metering is optional; LiveKit active-speaker state remains available.
    }
  };

  const captureMicrophone = async (settings: LobbyMediaSettings) =>
    navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: settings.mic ? { exact: settings.mic } : undefined,
        noiseSuppression: settings.noiseSuppression,
        echoCancellation: settings.echoCancellation,
        autoGainControl: settings.autoGainControl,
      },
      video: false,
    });

  useEffect(() => {
    let dead = false;
    void (async () => {
      const settings = readCfg();
      setCfg(settings);
      livekitSession.setOutput(settings.output, settings.outputVolume);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (dead || !user) {
        if (!user) navigate({ to: "/" });
        return;
      }
      const self: Person = {
        userId: user.id,
        name:
          user.user_metadata?.display_name ||
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          "Jogador",
        avatar: user.user_metadata?.avatar_url || null,
        speaking: false,
        sharing: livekitSession.snapshot.localScreen !== null,
      };
      setMe(self);
      meRef.current = self;
      setupRealtime(self);

      try {
        const existing = callSession.snapshot.lobbyId === lobbyId ? callSession.snapshot.micStream : null;
        const stream = existing || (await captureMicrophone(settings));
        if (dead) {
          if (!existing) stream.getTracks().forEach((track) => track.stop());
          return;
        }
        mic.current = stream;
        setMuted(callSession.snapshot.lobbyId === lobbyId ? callSession.snapshot.muted : false);
        mutedRef.current = callSession.snapshot.lobbyId === lobbyId ? callSession.snapshot.muted : false;
        startMeter(stream, settings, self);
        await livekitSession.connect({
          lobbyId,
          microphone: stream,
          muted: mutedRef.current,
          outputDeviceId: settings.output,
          outputVolume: settings.outputVolume,
        });
        setMicState("SFU conectado");
      } catch (error) {
        setMicState("SFU indisponível");
        setStatus(error instanceof Error ? error.message : "Não foi possível conectar a call.");
      }
    })();

    return () => {
      dead = true;
      if (meter.current) cancelAnimationFrame(meter.current);
      meter.current = null;
      void meterContext.current?.close().catch(() => {});
      meterContext.current = null;
      if (presenceRoom.current) void supabase.removeChannel(presenceRoom.current);
      if (directory.current) void supabase.removeChannel(directory.current);
      presenceRoom.current = null;
      directory.current = null;
      // Intencional: LiveKit e o microfone ficam vivos para a call continuar ao navegar.
    };
  }, [lobbyId, navigate]);

  useEffect(() => {
    if (live.lobbyId !== lobbyId) return;
    if (live.connected) setMicState("SFU conectado");
    else if (String(live.connectionState).toLowerCase().includes("reconnect")) setMicState("reconectando");
  }, [live.connected, live.connectionState, live.lobbyId, lobbyId]);

  const applySettings = async (next: LobbyMediaSettings) => {
    setCfg(next);
    localStorage.setItem("grind:mediaSettings", JSON.stringify(next));
    livekitSession.setOutput(next.output, next.outputVolume);
    const current = meRef.current;
    if (!current) return;
    try {
      const stream = await captureMicrophone(next);
      mic.current = stream;
      await livekitSession.replaceMicrophone(stream, mutedRef.current);
      startMeter(stream, next, current);
      setStatus("Configurações aplicadas na call.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível aplicar o microfone.");
    }
    window.setTimeout(() => setStatus(""), 1800);
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    await livekitSession.setMuted(next).catch(() => {});
    if (next) void trackPresence({ speaking: false });
  };

  const toggleDeafen = () => {
    const next = !deafened;
    setDeafened(next);
    livekitSession.setDeafened(next);
  };

  const stopScreen = async () => {
    await livekitSession.stopScreen(true);
    setOpening(false);
    setPreviewReady(false);
    await trackPresence({ sharing: false });
  };

  const startScreen = async () => {
    try {
      setOpening(true);
      const selected = preset(cfg.quality);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: selected.width },
          height: { ideal: selected.height },
          frameRate: { ideal: selected.frameRate, max: selected.frameRate },
        },
        audio: cfg.systemAudio,
      });
      await livekitSession.startScreen(stream);
      setPreviewReady(false);
      await trackPresence({ sharing: true });
      setOpening(false);
    } catch (error) {
      setOpening(false);
      setStatus(error instanceof Error && error.name !== "NotAllowedError" ? error.message : "Compartilhamento cancelado.");
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(`${location.origin}/lobbies?join=${encodeURIComponent(lobbyId)}`);
    setStatus("Convite copiado.");
    window.setTimeout(() => setStatus(""), 1400);
  };

  const send = () => {
    const current = meRef.current;
    if (!current || !msg.trim()) return;
    const payload = { u: current.name, t: msg.trim() };
    setMessages((value) => [...value, payload]);
    void presenceRoom.current?.send({ type: "broadcast", event: "chat", payload });
    setMsg("");
  };

  const leave = async () => {
    await livekitSession.disconnect(true);
    localStorage.removeItem("grind:activeLobby");
    if (presenceRoom.current) void supabase.removeChannel(presenceRoom.current);
    if (directory.current) void supabase.removeChannel(directory.current);
    navigate({ to: "/lobbies" });
  };

  const localPreview = live.localScreen;

  return (
    <div className="min-h-screen bg-[#070910] text-white">
      <main className="mx-auto max-w-[1580px] p-4 md:p-6">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <img src="/grindlobby-logo.png" className="h-12 w-12 object-contain" alt="GL" />
          <div>
            <p className="text-[10px] uppercase tracking-[.22em] text-white/40">Lobby de voz · SFU</p>
            <h1 className="text-xl font-semibold">{lobbyId}</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => navigate({ to: "/" })} className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 text-sm">
              <Home className="h-4 w-4" /> Dashboard
            </button>
            <button onClick={() => void copy()} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.03]" aria-label="Copiar convite">
              <UserPlus className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Abrir configurações" onClick={() => setSettingsOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.03]">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[92px_1fr_330px]">
          <aside className="hidden rounded-2xl border border-white/10 bg-[#0b0e17] p-2 xl:block">
            <p className="mb-3 text-center text-[9px] uppercase tracking-widest text-white/30">Call</p>
            <div className="space-y-3">
              {people.map((person) => (
                <button
                  key={person.userId}
                  onClick={() => person.sharing && person.userId !== me?.userId && setSelectedScreen(person.userId)}
                  className="relative flex w-full flex-col items-center gap-1 rounded-xl p-1.5 hover:bg-white/5"
                >
                  <span className={`grid h-11 w-11 place-items-center overflow-hidden rounded-full border text-sm font-semibold ${person.speaking ? "border-purple-400 shadow-[0_0_18px_rgba(168,85,247,.35)]" : "border-white/10"}`}>
                    {person.avatar ? <img src={person.avatar} className="h-full w-full object-cover" alt="" /> : initial(person.name)}
                  </span>
                  <span className="max-w-[74px] truncate text-[9px] text-white/50">{person.userId === me?.userId ? "Você" : person.name}</span>
                  {person.sharing && <MonitorUp className="absolute right-1 top-1 h-3 w-3 text-purple-300" />}
                </button>
              ))}
            </div>
          </aside>

          <section className="min-w-0 space-y-4">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e17]">
              <div className="flex min-h-[440px] items-center justify-center bg-black/25 p-4">
                {activeRemote ? (
                  <Video stream={live.remoteScreens[activeRemote]} />
                ) : localPreview && cfg.showPreview ? (
                  <div className="w-full">
                    <Video stream={localPreview} muted onReady={() => setPreviewReady(true)} />
                    {!previewReady && <p className="mt-3 text-center text-xs text-white/35">Preparando preview...</p>}
                  </div>
                ) : (
                  <div className="max-w-md text-center">
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-300">
                      <MonitorUp className="h-7 w-7" />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold">Tela ao vivo</h2>
                    <p className="mt-2 text-sm text-white/40">A transmissão agora passa pelo SFU. Não há malha P2P entre todos os usuários.</p>
                    <button onClick={() => void startScreen()} disabled={opening || !live.connected} className="mt-5 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-medium disabled:opacity-40">
                      {opening ? "Abrindo captura..." : "Compartilhar tela"}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-white/[.07] p-3">
                <button onClick={() => void toggleMute()} className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-sm ${muted ? "border-red-500/25 bg-red-500/10 text-red-200" : "border-white/10 bg-white/[.03]"}`}>
                  {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {muted ? "Mutado" : "Microfone"}
                </button>
                <button onClick={toggleDeafen} className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-sm ${deafened ? "border-amber-500/25 bg-amber-500/10 text-amber-200" : "border-white/10 bg-white/[.03]"}`}>
                  <Headphones className="h-4 w-4" /> {deafened ? "Áudio desligado" : "Ouvir call"}
                </button>
                {localPreview ? (
                  <button onClick={() => void stopScreen()} className="flex h-11 items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-sm text-red-200">
                    <X className="h-4 w-4" /> Parar tela
                  </button>
                ) : (
                  <button onClick={() => void startScreen()} disabled={!live.connected} className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-4 text-sm disabled:opacity-40">
                    <MonitorUp className="h-4 w-4" /> Transmitir
                  </button>
                )}
                <div className="ml-auto flex items-center gap-2 text-xs text-white/40">
                  <span className={`h-2 w-2 rounded-full ${live.connected ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {micState}
                </div>
              </div>
            </div>

            {sharing.length > 0 && (
              <div className="flex flex-wrap gap-2 rounded-2xl border border-white/[.07] bg-[#0b0e17] p-3">
                {sharing.map((person) => (
                  <button key={person.userId} onClick={() => setSelectedScreen(person.userId)} className="rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-xs text-purple-200">
                    Ver tela de {person.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e17]">
            <div className="flex border-b border-white/[.07] p-2">
              <button onClick={() => setTab("chat")} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs ${tab === "chat" ? "bg-white/[.06] text-white" : "text-white/40"}`}>
                <MessageSquare className="h-4 w-4" /> Chat
              </button>
              <button onClick={() => setTab("info")} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs ${tab === "info" ? "bg-white/[.06] text-white" : "text-white/40"}`}>
                <Info className="h-4 w-4" /> Status
              </button>
            </div>

            {tab === "chat" ? (
              <>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.length === 0 && <p className="text-center text-xs text-white/25">Nenhuma mensagem ainda.</p>}
                  {messages.map((message, index) => (
                    <div key={`${message.u}-${index}`} className="rounded-xl bg-white/[.035] p-3">
                      <b className="text-xs text-purple-300">{message.u}</b>
                      <p className="mt-1 break-words text-sm text-white/75">{message.t}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 border-t border-white/[.07] p-3">
                  <input value={msg} onChange={(event) => setMsg(event.target.value)} onKeyDown={(event) => event.key === "Enter" && send()} placeholder="Mensagem..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm outline-none focus:border-purple-500/40" />
                  <button onClick={send} className="rounded-xl bg-purple-600 px-4 text-sm">Enviar</button>
                </div>
              </>
            ) : (
              <div className="space-y-3 p-4 text-sm">
                <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-3">
                  <p className="text-xs uppercase tracking-wider text-white/30">Transporte</p>
                  <p className="mt-1 font-medium text-emerald-300">LiveKit SFU</p>
                  <p className="mt-1 text-xs text-white/35">Uma publicação para o SFU; sem upload multiplicado por cada pessoa da sala.</p>
                </div>
                <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-3">
                  <p className="text-xs uppercase tracking-wider text-white/30">Participantes</p>
                  <p className="mt-1 text-lg font-semibold">{live.participants.length}</p>
                </div>
                <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-3">
                  <p className="text-xs uppercase tracking-wider text-white/30">Rede</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                    <span><b className="block text-white">{callSession.snapshot.metrics.rttMs ?? "—"}</b>ms RTT</span>
                    <span><b className="block text-white">{callSession.snapshot.metrics.bitrateKbps ?? "—"}</b>kbps</span>
                    <span><b className="block text-white">{callSession.snapshot.metrics.packetsLost ?? "—"}</b>perdas</span>
                  </div>
                </div>
                <button onClick={() => void leave()} className="w-full rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">Sair da call</button>
              </div>
            )}
          </aside>
        </div>

        {status && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/10 bg-[#111521]/95 px-4 py-2 text-xs text-white/75 shadow-2xl">{status}</div>}
      </main>

      <LobbySettingsModal
        open={settingsOpen}
        value={cfg}
        micStream={mic.current}
        onClose={() => setSettingsOpen(false)}
        onSave={applySettings}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  Disc3,
  Maximize2,
  Minimize2,
  X,
  ListMusic,
  Pause,
  Play,
  Plus,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
} from "lucide-react";

type Track = { id: string; title: string; artist: string; duration: number; by: string };

const INITIAL: Track[] = [
  { id: "t1", title: "Neon Overdrive", artist: "SYNTHRA", duration: 214, by: "juan" },
  { id: "t2", title: "Grind Anthem", artist: "LOWKEYZ", duration: 189, by: "PedroFPS" },
  { id: "t3", title: "Purple Static", artist: "Nyx", duration: 241, by: "LucasZ" },
  { id: "t4", title: "Clutch Mode", artist: "DGZ", duration: 176, by: "DGZ" },
];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function MusicBot() {
  const [queue, setQueue] = useState<Track[]>(INITIAL);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(42);
  const [volume, setVolume] = useState(65);
  const [loop, setLoop] = useState(false);
  const [input, setInput] = useState("");
  const [popup, setPopup] = useState(false);
  const [hidden, setHidden] = useState(false);

  const track = queue[current];

  useEffect(() => {
    if (!playing || !track) return;
    const t = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= track.duration) {
          if (loop) return 0;
          setCurrent((c) => (c + 1) % queue.length);
          return 0;
        }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [playing, track, loop, queue.length]);

  function skip(dir: 1 | -1) {
    setCurrent((c) => (c + dir + queue.length) % queue.length);
    setElapsed(0);
  }

  function addTrack(e: React.FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    setQueue((q) => [
      ...q,
      {
        id: `t${Date.now()}`,
        title: value.startsWith("http") ? "Link externo" : value,
        artist: value.startsWith("http") ? new URL(value).hostname.replace("www.", "") : "pedido do lobby",
        duration: 180 + Math.floor(Math.random() * 90),
        by: "juan",
      },
    ]);
    setInput("");
  }

  const progress = track ? (elapsed / track.duration) * 100 : 0;

  if (popup && hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="panel flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-primary/40"
      >
        <Disc3 className={`h-5 w-5 text-primary-glow ${playing ? "animate-spin-slow" : ""}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{track?.title ?? "Fila vazia"}</span>
          <span className="label-caps">bot em popup — clique para reabrir</span>
        </span>
        <Maximize2 className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <section
      className={
        popup
          ? "panel animate-card-pop fixed bottom-5 right-5 z-[70] max-h-[86vh] w-[min(380px,calc(100vw-2.5rem))] overflow-y-auto p-5 shadow-[0_24px_60px_oklch(0.02_0.01_285/0.9)]"
          : "panel p-5 transition-all hover:border-primary/40 hover:shadow-[0_0_36px_oklch(0.58_0.24_300/0.16)]"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="label-caps flex items-center gap-2">
          <Disc3 className={`h-4 w-4 text-primary-glow ${playing ? "animate-spin-slow" : ""}`} /> Grind
          Beats — bot de música
        </p>
        <div className="flex items-center gap-1.5">
          {!popup && (
            <span className="hidden items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-[11px] font-semibold text-success sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> conectado ao canal
            </span>
          )}
          <button
            onClick={() => setPopup((v) => !v)}
            aria-label={popup ? "Encaixar no painel" : "Abrir em popup"}
            title={popup ? "Encaixar no painel" : "Abrir em popup flutuante"}
            className="btn-ghost grid h-8 w-8 place-items-center rounded-lg transition-transform hover:scale-105"
          >
            {popup ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          {popup && (
            <button
              onClick={() => setHidden(true)}
              aria-label="Minimizar popup"
              className="btn-ghost grid h-8 w-8 place-items-center rounded-lg transition-transform hover:scale-105"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Now playing */}
      <div className="mt-4 flex items-center gap-4 rounded-xl border border-border bg-panel/60 p-3">
        <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-primary/70 to-primary-glow/60">
          <Disc3
            className={`h-8 w-8 text-primary-foreground ${playing ? "animate-spin-slow" : ""}`}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{track?.title ?? "Fila vazia"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {track ? `${track.artist} • pedido por ${track.by}` : "adicione uma música"}
          </p>

          <div className="mt-2 flex items-end gap-[2px]" aria-hidden="true">
            {Array.from({ length: 26 }).map((_, i) => (
              <span
                key={i}
                className={`w-[3px] rounded-full bg-primary-glow ${playing ? "animate-eq" : ""}`}
                style={{
                  height: `${5 + ((i * 5) % 14)}px`,
                  animationDelay: `${(i % 7) * 0.12}s`,
                  opacity: playing ? 1 : 0.35,
                }}
              />
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{fmt(elapsed)}</span>
            <span className="group relative h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-secondary">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-primary to-primary-glow shadow-[0_0_12px_oklch(0.72_0.2_305/0.6)]"
                style={{ width: `${progress}%` }}
              />
            </span>
            <span>{track ? fmt(track.duration) : "0:00"}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => skip(-1)}
          aria-label="Anterior"
          className="btn-ghost grid h-10 w-10 place-items-center rounded-lg transition-transform hover:scale-105"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pausar" : "Tocar"}
          className="btn-primary grid h-11 w-11 place-items-center rounded-full transition-transform hover:scale-110"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button
          onClick={() => skip(1)}
          aria-label="Próxima"
          className="btn-ghost grid h-10 w-10 place-items-center rounded-lg transition-transform hover:scale-105"
        >
          <SkipForward className="h-4 w-4" />
        </button>
        <button
          onClick={() => setLoop((l) => !l)}
          aria-label="Repetir"
          className={`grid h-10 w-10 place-items-center rounded-lg border transition-colors ${
            loop
              ? "border-primary/50 bg-primary/20 text-primary-glow"
              : "border-border bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          <Repeat className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            setQueue((q) => {
              const rest = q.filter((_, i) => i !== current);
              const head = q[current]!;
              return [head, ...rest.sort(() => Math.random() - 0.5)];
            })
          }
          aria-label="Aleatório"
          className="btn-ghost grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-transform hover:scale-105 hover:text-foreground"
        >
          <Shuffle className="h-4 w-4" />
        </button>

        <div className="ml-auto flex min-w-[140px] items-center gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            aria-label="Volume do bot"
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1.5 w-full accent-[oklch(0.72_0.2_305)]"
          />
          <span className="w-8 text-right text-xs text-muted-foreground">{volume}</span>
        </div>
      </div>

      {/* Add */}
      <form onSubmit={addTrack} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="/play  nome da música ou link"
          className="min-w-0 flex-1 rounded-lg border border-input bg-panel px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
        />
        <button
          type="submit"
          className="btn-primary flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.03]"
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </form>

      {/* Queue */}
      <div className="mt-3 rounded-xl border border-border bg-panel/50 p-3">
        <p className="label-caps flex items-center gap-2 px-1">
          <ListMusic className="h-3.5 w-3.5" /> Fila ({queue.length})
        </p>
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
          {queue.map((t, i) => (
            <li
              key={t.id}
              className={`group flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors ${
                i === current ? "bg-primary/15 text-foreground" : "hover:bg-secondary"
              }`}
            >
              <button
                onClick={() => {
                  setCurrent(i);
                  setElapsed(0);
                  setPlaying(true);
                }}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="w-4 shrink-0 font-display text-xs text-muted-foreground">
                  {i === current ? <Play className="h-3 w-3 text-primary-glow" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {t.artist} • {t.by}
                  </span>
                </span>
              </button>
              <span className="text-[11px] text-muted-foreground">{fmt(t.duration)}</span>
              <button
                aria-label={`Remover ${t.title}`}
                onClick={() =>
                  setQueue((q) => {
                    const next = q.filter((x) => x.id !== t.id);
                    if (i <= current) setCurrent((c) => Math.max(0, c - 1));
                    return next.length ? next : q;
                  })
                }
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

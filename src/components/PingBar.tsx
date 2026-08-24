import { useEffect, useRef, useState } from "react";
import { Headphones, PhoneOff, Server, Signal, Wifi } from "lucide-react";

function quality(ms: number) {
  if (ms < 40) return { label: "Excelente", color: "var(--success)", text: "text-success" };
  if (ms < 80) return { label: "Boa", color: "var(--primary-glow)", text: "text-primary-glow" };
  if (ms < 130) return { label: "Instável", color: "var(--warning)", text: "text-warning" };
  return { label: "Ruim", color: "var(--destructive)", text: "text-destructive" };
}

export function PingBar({ inCall = true }: { inCall?: boolean }) {
  const [connected, setConnected] = useState(inCall);
  const [ping, setPing] = useState(38);
  const [history, setHistory] = useState<number[]>(() =>
    Array.from({ length: 28 }, (_, i) => 30 + ((i * 13) % 45)),
  );
  const [seconds, setSeconds] = useState(0);
  const jitter = useRef(0);

  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => {
      setPing((p) => {
        jitter.current = jitter.current * 0.6 + (Math.random() - 0.5) * 26;
        const next = Math.max(14, Math.min(180, Math.round(p + jitter.current)));
        setHistory((h) => [...h.slice(-27), next]);
        return next;
      });
      setSeconds((s) => s + 1);
    }, 1100);
    return () => clearInterval(t);
  }, [connected]);

  const q = quality(ping);
  const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <section className="panel group p-5 transition-all hover:border-primary/40 hover:shadow-[0_0_36px_oklch(0.58_0.24_300/0.16)]">
      <div className="flex items-center justify-between">
        <p className="label-caps flex items-center gap-2">
          <Signal className="h-4 w-4 text-primary-glow" /> Conexão da call
        </p>
        <span
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${
            connected
              ? "border-success/40 bg-success/10 text-success"
              : "border-border bg-secondary text-muted-foreground"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse bg-success" : "bg-muted-foreground"}`}
          />
          {connected ? `Em call • ${mm}:${ss}` : "Desconectado"}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-4xl font-bold leading-none" style={{ color: q.color }}>
            {connected ? ping : "--"}
            <span className="ml-1 text-base font-medium text-muted-foreground">ms</span>
          </p>
          <p className={`mt-1 text-xs font-semibold ${connected ? q.text : "text-muted-foreground"}`}>
            {connected ? q.label : "sem sinal"}
          </p>
        </div>

        <div className="flex h-14 items-end gap-[3px]" aria-hidden="true">
          {history.map((v, i) => {
            const c = quality(v);
            return (
              <span
                key={i}
                className="w-[6px] rounded-sm transition-all duration-500"
                style={{
                  height: connected ? `${Math.max(8, Math.min(56, v / 3 + 8))}px` : "6px",
                  background: connected ? c.color : "var(--muted)",
                  opacity: 0.35 + (i / history.length) * 0.65,
                  boxShadow: connected && i === history.length - 1 ? `0 0 12px ${c.color}` : "none",
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: connected ? `${Math.max(6, 100 - Math.min(100, ping / 1.8))}%` : "0%",
            background: `linear-gradient(90deg, ${q.color}, var(--primary-glow))`,
            boxShadow: `0 0 16px ${q.color}`,
          }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        {[
          { icon: Wifi, label: "média", value: connected ? `${avg} ms` : "--" },
          { icon: Server, label: "região", value: "BR-Sul" },
          { icon: Headphones, label: "bitrate", value: "96 kbps" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border bg-panel/60 px-2 py-2 transition-colors hover:border-primary/40"
          >
            <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <s.icon className="h-3 w-3" /> {s.label}
            </dt>
            <dd className="mt-0.5 font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>

      <button
        onClick={() => setConnected((c) => !c)}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02] ${
          connected
            ? "border border-destructive/50 bg-destructive/15 text-destructive"
            : "btn-primary"
        }`}
      >
        <PhoneOff className="h-4 w-4" /> {connected ? "Sair da call" : "Entrar na call"}
      </button>
    </section>
  );
}

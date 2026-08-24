import { useEffect, useState } from "react";
import {
  Crown,
  Flame,
  Gift,
  Megaphone,
  Radio,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";

type Feed = {
  id: string;
  icon: LucideIcon;
  tone: "admin" | "event" | "drop" | "live";
  title: string;
  detail: string;
};

const FEED: Feed[] = [
  {
    id: "admin",
    icon: Crown,
    tone: "admin",
    title: "Admin online",
    detail: "juan está no servidor — suporte e criação de lobbies liberados",
  },
  {
    id: "live",
    icon: Radio,
    tone: "live",
    title: "Transmissão ao vivo",
    detail: "DGZ está transmitindo o lobby #27 — 128 assistindo",
  },
  {
    id: "event",
    icon: Trophy,
    tone: "event",
    title: "Copa GrindLobby",
    detail: "Inscrições abertas até 24/MAI • 64 vagas restantes",
  },
  {
    id: "drop",
    icon: Gift,
    tone: "drop",
    title: "Drop de moedas",
    detail: "+150 moedas para quem jogar 3 partidas hoje",
  },
  {
    id: "streak",
    icon: Flame,
    tone: "live",
    title: "Sequência ativa",
    detail: "XP em dobro nas próximas 2 partidas competitivas",
  },
];

const toneRing: Record<Feed["tone"], string> = {
  admin: "border-warning/50 shadow-[0_0_28px_oklch(0.8_0.16_85/0.18)]",
  event: "border-primary/50 shadow-[0_0_28px_oklch(0.58_0.24_300/0.22)]",
  drop: "border-success/50 shadow-[0_0_28px_oklch(0.75_0.18_155/0.18)]",
  live: "border-destructive/50 shadow-[0_0_28px_oklch(0.6_0.22_20/0.18)]",
};

const toneText: Record<Feed["tone"], string> = {
  admin: "text-warning",
  event: "text-primary-glow",
  drop: "text-success",
  live: "text-destructive",
};

export function EventTicker() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || !visible) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % FEED.length), 6500);
    return () => clearInterval(t);
  }, [paused, visible]);

  if (!visible) return null;

  const item = FEED[index]!;
  const Icon = item.icon;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`panel relative overflow-hidden border ${toneRing[item.tone]} transition-shadow`}
      role="status"
      aria-live="polite"
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-ticker-shine bg-gradient-to-r from-transparent via-primary/12 to-transparent" />

      <div key={item.id} className="animate-ticker-in flex items-center gap-3 px-4 py-2.5">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-panel ${toneText[item.tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex h-2 w-2 shrink-0">
          <span className={`h-2 w-2 animate-ping rounded-full ${item.tone === "admin" ? "bg-warning" : "bg-primary-glow"}`} />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold">{item.title}</span>{" "}
          <span className="text-muted-foreground">— {item.detail}</span>
        </p>

        <span className="hidden items-center gap-1 sm:flex">
          {FEED.map((f, i) => (
            <button
              key={f.id}
              aria-label={`Ver aviso ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-primary-glow" : "w-1.5 bg-border hover:bg-muted-foreground"
              }`}
            />
          ))}
        </span>

        <Megaphone className="hidden h-4 w-4 text-muted-foreground md:block" />
        <button
          onClick={() => setVisible(false)}
          aria-label="Fechar avisos"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <span className="absolute bottom-0 left-0 h-px w-full bg-border">
        <span
          key={item.id + "-bar"}
          className={`block h-px bg-primary-glow ${paused ? "" : "animate-ticker-progress"}`}
        />
      </span>
    </div>
  );
}

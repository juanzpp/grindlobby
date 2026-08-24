import { useState } from "react";
import { Clock, Crown, Flame, Gamepad2, MessageSquare, Swords, TrendingUp, UserPlus } from "lucide-react";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import { usePlayer } from "@/lib/player-store";
import { getTier, tierGradient } from "@/lib/levels";

type Row = {
  name: string;
  handle: string;
  level: number;
  border: string;
  you?: boolean;
  title: string;
  winrate: number;
  matches: number;
  streak: number;
  status: "online" | "em call" | "ausente";
  main: string;
  since: string;
};

const SERVER_TOP: Row[] = [
  { name: "Rhaz", handle: "@rhazgg", level: 40, border: "border-prismatic", title: "Lenda do Grind", winrate: 74, matches: 1280, streak: 9, status: "em call", main: "EA FC 27", since: "2024" },
  { name: "Mayk", handle: "@maykzin", level: 38, border: "border-crimson", title: "Predador", winrate: 69, matches: 1104, streak: 5, status: "online", main: "Valorant", since: "2024" },
  { name: "DGZ", handle: "@dgzfps", level: 34, border: "border-crimson", title: "Clutch King", winrate: 66, matches: 940, streak: 3, status: "em call", main: "CS2", since: "2025" },
  { name: "Nyx", handle: "@nyxlobby", level: 31, border: "border-neon", title: "Sombra", winrate: 63, matches: 820, streak: 2, status: "ausente", main: "EA FC 27", since: "2025" },
  { name: "PedroFPS", handle: "@pedrofps", level: 27, border: "border-emerald", title: "Mira Fina", winrate: 61, matches: 690, streak: 4, status: "online", main: "CS2", since: "2025" },
  { name: "LucasZ", handle: "@lucasz", level: 22, border: "border-steel", title: "Escalando", winrate: 57, matches: 430, streak: 1, status: "online", main: "Valorant", since: "2026" },
];

const statusColor: Record<Row["status"], string> = {
  online: "bg-success",
  "em call": "bg-primary-glow",
  ausente: "bg-warning",
};

export function TopElos() {
  const { player } = usePlayer();
  const [hover, setHover] = useState<{ handle: string; x: number; y: number } | null>(null);

  const me: Row = {
    name: player.nickname,
    handle: `@${player.handle}`,
    level: player.level,
    border: player.equipped.border,
    you: true,
    title: "Você",
    winrate: 50,
    matches: 0,
    streak: 0,
    status: "online",
    main: player.game,
    since: "2026",
  };

  const rows: Row[] = [...SERVER_TOP, me]
    .sort((a, b) => b.level - a.level)
    .slice(0, 7);

  return (
    <section className="panel px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="label-caps flex items-center gap-2">
          <Crown className="h-4 w-4 text-warning" /> Top elos do servidor
        </p>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5 text-success" /> temporada atual
        </span>
      </div>

      <ol className="mt-3 flex gap-3 overflow-x-auto pb-1 pt-1">
        {rows.map((p, i) => {
          const tier = getTier(p.level);
          const open = hover?.handle === p.handle;
          return (
            <li
              key={p.handle}
              className="relative shrink-0"
              onMouseEnter={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const cx = Math.max(150, Math.min(r.left + r.width / 2, window.innerWidth - 150));
                setHover({ handle: p.handle, x: cx, y: r.bottom + 8 });
              }}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={`flex min-w-[188px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300 hover:-translate-y-1 ${
                  p.you
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-panel/60 hover:border-primary/50"
                }`}
                style={open ? { boxShadow: `0 10px 30px ${tier.glow}` } : undefined}
              >
                <span className="font-display text-sm font-bold text-muted-foreground">
                  #{i + 1}
                </span>
                <ProfileAvatar name={p.name} size={34} borderId={p.border} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: tier.color, boxShadow: `0 0 8px ${tier.glow}` }}
                    />
                    <span className="text-muted-foreground">{tier.name}</span>
                    <span
                      className="rounded px-1.5 font-display font-bold text-background"
                      style={{ backgroundImage: tierGradient(tier) }}
                    >
                      {p.level}
                    </span>
                  </p>
                </div>
              </div>

              {/* mini popup do perfil */}
              {open && (
                <div
                  className="animate-card-pop fixed z-50 w-[268px] -translate-x-1/2 rounded-xl border border-primary/40 bg-popover/95 p-4 backdrop-blur"
                  style={{ left: hover.x, top: hover.y, boxShadow: `0 18px 50px ${tier.glow}` }}
                  role="tooltip"
                >
                  <span
                    className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-primary/40 bg-popover"
                    aria-hidden="true"
                  />
                  <div className="flex items-center gap-3">
                    <ProfileAvatar name={p.name} size={48} borderId={p.border} />
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-bold">{p.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{p.handle}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px]">
                        <span className={`h-1.5 w-1.5 rounded-full ${statusColor[p.status]}`} />
                        <span className="capitalize text-muted-foreground">{p.status}</span>
                      </p>
                    </div>
                  </div>

                  <p
                    className="mt-3 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold text-background"
                    style={{ backgroundImage: tierGradient(tier) }}
                  >
                    {tier.name.toUpperCase()} • LEVEL {p.level}
                  </p>

                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      { icon: Swords, label: "winrate", value: `${p.winrate}%` },
                      { icon: Gamepad2, label: "partidas", value: p.matches },
                      { icon: Flame, label: "sequência", value: p.streak },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border border-border bg-panel/70 py-1.5">
                        <dt className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                          <s.icon className="h-3 w-3" /> {s.label}
                        </dt>
                        <dd className="text-sm font-semibold">{s.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <p className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Gamepad2 className="h-3 w-3" /> {p.main}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> desde {p.since}
                    </span>
                  </p>

                  {!p.you && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button className="btn-ghost flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-transform hover:scale-[1.03]">
                        <UserPlus className="h-3.5 w-3.5" /> Adicionar
                      </button>
                      <button className="btn-primary flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-transform hover:scale-[1.03]">
                        <MessageSquare className="h-3.5 w-3.5" /> Chamar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

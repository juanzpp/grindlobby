import { ChevronDown, Info, Sparkle, Zap } from "lucide-react";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import { usePlayer, findItem } from "@/lib/player-store";
import {
  LEVEL_TIERS,
  MAX_LEVEL,
  getTier,
  tierAuraShadow,
  tierGradient,
  xpForLevel,
} from "@/lib/levels";
import logo from "@/assets/grindlobby-logo.png.asset.json";

export function LevelHero({ onOpenProfile }: { onOpenProfile: () => void }) {
  const { player, addXp } = usePlayer();
  const tier = getTier(player.level);
  const need = xpForLevel(player.level);
  const pct = need === 0 ? 100 : Math.min(100, Math.round((player.xp / need) * 100));
  const title = findItem(player.equipped.title)?.label;
  const nextTier = LEVEL_TIERS.find((t) => t.from > player.level);

  return (
    <section className="panel hero-surface relative overflow-hidden px-5 py-6">
      <div className="grid items-center gap-6 lg:grid-cols-[auto_1fr_auto]">
        <div className="relative mx-auto">
          <span
            className="absolute inset-0 -z-10 rounded-full blur-2xl"
            style={{ background: tier.color, opacity: 0.35 }}
          />
          <img
            src={logo.url}
            alt="Emblema GrindLobby"
            width={512}
            height={512}
            className="h-40 w-40 object-contain"
            style={{ filter: `drop-shadow(0 0 34px ${tier.glow})` }}
          />
        </div>

        <div>
          <p className="label-caps">Seu progresso</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl font-bold">Level {player.level}</h1>
            <span
              className="rounded-md px-2.5 py-1 font-display text-[11px] font-bold tracking-wide text-background"
              style={{ backgroundImage: tierGradient(tier) }}
            >
              {tier.name.toUpperCase()}
            </span>
            <button className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium">
              <Sparkle className="h-3.5 w-3.5 text-primary-glow" /> {player.game}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>XP do level</span>
              <span>
                <span className="font-semibold text-foreground">{player.xp}</span> /{" "}
                {need === 0 ? "MAX" : need} XP
              </span>
            </div>
            <div className="relative mt-2 h-3.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`relative h-full rounded-full ${
                  tier.aura >= 3 ? "animate-xp-shift" : ""
                }`}
                style={{
                  width: `${pct}%`,
                  backgroundImage: tierGradient(tier),
                  backgroundSize: tier.aura >= 3 ? "220% 100%" : "100% 100%",
                  boxShadow: tierAuraShadow(tier),
                }}
              >
                {tier.aura >= 2 && (
                  <span className="absolute inset-0 animate-bar-shimmer bg-gradient-to-r from-transparent via-foreground/35 to-transparent" />
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {player.level >= MAX_LEVEL
                ? "Level máximo alcançado — elo Prismático"
                : `Faltam ${need - player.xp} XP para o level ${player.level + 1}`}
              {nextTier && player.level < MAX_LEVEL && (
                <>
                  {" • próximo elo: "}
                  <span style={{ color: nextTier.glow }}>{nextTier.name}</span>
                  {` no level ${nextTier.from}`}
                </>
              )}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => addXp(250)}
              className="btn-primary flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
            >
              <Zap className="h-3.5 w-3.5" /> Registrar partida (+250 XP)
            </button>
            <button
              onClick={onOpenProfile}
              className="btn-ghost rounded-lg px-3 py-2 text-xs font-medium"
            >
              Configurar perfil
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {LEVEL_TIERS.map((t) => (
              <span
                key={t.id}
                title={`${t.name} — level ${t.from}${t.to !== t.from ? `-${t.to}` : ""}`}
                className="h-1.5 w-10 rounded-full"
                style={{
                  backgroundImage: tierGradient(t),
                  opacity: player.level >= t.from ? 1 : 0.25,
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 lg:border-l lg:border-border lg:pl-6">
          <ProfileAvatar
            name={player.nickname}
            size={78}
            borderId={player.equipped.border}
          />
          <div className="text-center">
            <p className="flex items-center justify-center gap-2 font-display text-lg font-bold">
              {player.nickname}
              {title && (
                <span className="rounded border border-primary/50 bg-primary/15 px-1.5 text-[10px] font-bold text-primary-glow">
                  {title}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">@{player.handle}</p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              {player.region} <Info className="h-3.5 w-3.5" />
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

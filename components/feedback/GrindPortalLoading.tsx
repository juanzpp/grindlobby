import Image from "next/image";
import { Check, Loader2, ShieldCheck, Signal, Swords, Trophy } from "lucide-react";
import EnvironmentBackdrop from "@/components/lovable/EnvironmentBackdrop";
import type { TransitionFx } from "@/components/lovable/PortalTransition";

export type GrindPortalLoadingProps = {
  variant?: "fullscreen" | "overlay" | "inline";
  label?: string;
  progress?: number;
  className?: string;
  complete?: boolean;
  effect?: TransitionFx;
};

const loadingSteps = [
  { label: "Autenticando sessão", icon: ShieldCheck, matches: ["autentic"] },
  { label: "Sincronizando perfil", icon: Trophy, matches: ["perfil", "grind", "nível", "xp"] },
  { label: "Preparando lobby", icon: Swords, matches: ["lobby", "sala"] },
  { label: "Conectando serviços", icon: Signal, matches: ["serviço", "conect", "transmiss"] },
];

const effectCopy: Record<TransitionFx, { title: string; subtitle: string }> = {
  portal: { title: "Abrindo o portal", subtitle: "Estabilizando o corredor de energia" },
  warp: { title: "Salto de hiperluz", subtitle: "Desacelerando nas coordenadas do servidor" },
  glitch: { title: "Reconstruindo sinal", subtitle: "Validando a integridade da conexão" },
  shards: { title: "Reagrupando fragmentos", subtitle: "Alinhando a experiência ao seu perfil" },
};

function findOperationStep(label: string) {
  const normalizedLabel = label.toLocaleLowerCase("pt-BR");
  const index = loadingSteps.findIndex((step) => step.matches.some((match) => normalizedLabel.includes(match)));
  return index >= 0 ? index : 1;
}

export default function GrindPortalLoading({
  variant = "inline",
  label = "Preparando sua sessão…",
  progress,
  className = "",
  complete = false,
  effect = "portal",
}: GrindPortalLoadingProps) {
  const measured = typeof progress === "number" && Number.isFinite(progress);
  const normalizedProgress = measured ? Math.max(0, Math.min(100, progress)) : undefined;

  if (variant === "inline") {
    return (
      <span
        className={`portal-loading portal-loading-inline ${className}`.trim()}
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="portal-loader-copy"><strong>{label}</strong></span>
      </span>
    );
  }

  const currentStep = measured
    ? Math.min(loadingSteps.length - 1, Math.floor(((normalizedProgress ?? 0) / 100) * loadingSteps.length))
    : findOperationStep(label);
  const copy = effectCopy[effect];
  const positioning = variant === "fullscreen" ? "fixed inset-0 z-[220]" : "absolute inset-0 z-[60]";

  return (
    <div
      className={`lovable-loading-screen ${positioning} flex items-center justify-center overflow-hidden px-5 py-8 ${complete ? "portal-loading-complete" : ""} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label}
      aria-busy={!complete}
    >
      <EnvironmentBackdrop focusX={50} intensity={0.55} />

      {effect === "warp"
        ? Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              className="animate-warp-line pointer-events-none absolute right-0 h-px w-[40vw] bg-[linear-gradient(270deg,transparent,oklch(0.7_0.15_305/0.5),transparent)]"
              style={{ top: `${(index * 5.6) % 100}%`, animationDuration: `${1200 + index * 90}ms` }}
              aria-hidden="true"
            />
          ))
        : null}
      {effect === "glitch" ? (
        <div
          className="animate-glitch-rgb pointer-events-none absolute inset-0 opacity-40 mix-blend-screen"
          style={{
            backgroundImage: "repeating-linear-gradient(180deg, oklch(0.7 0.1 305 / 0.18) 0 1px, transparent 1px 5px)",
          }}
          aria-hidden="true"
        />
      ) : null}

      <div className="relative flex w-full max-w-[560px] flex-col items-center">
        <div className="relative grid h-52 w-52 place-items-center" aria-hidden="true">
          <span className="absolute inset-[-18%] rounded-full bg-[radial-gradient(circle,oklch(0.45_0.17_303/0.22),transparent_70%)] blur-2xl" />
          <span className="animate-ring-slow absolute inset-0 rounded-full border border-border/70 border-t-primary" />
          <span className="animate-ring-fast absolute inset-5 rounded-full border border-transparent border-b-primary-glow border-l-primary/60" />
          <span className="absolute inset-10 rounded-full border border-dashed border-border/60" />
          <span className="animate-orbit absolute h-1.5 w-1.5 rounded-full bg-primary-glow shadow-[0_0_12px_4px_oklch(0.62_0.19_305/0.75)]" />
          <Image
            src="/brand/ascent-portal.png"
            alt=""
            width={1312}
            height={1199}
            sizes="96px"
            className="animate-core-breathe h-24 w-24 object-contain"
          />
        </div>

        <h1 className="mt-8 font-display text-2xl tracking-[0.28em] text-foreground sm:text-3xl sm:tracking-[0.34em]">GRINDLOBBY</h1>
        <p className="lovable-label mt-2 !tracking-[0.3em] !text-primary-glow">{copy.title}</p>
        <p className="mt-1 text-center text-xs text-muted-foreground">{copy.subtitle}</p>

        <div className="lovable-panel mt-8 w-full bg-card/80 p-5 backdrop-blur-sm">
          <div className="flex items-end justify-between gap-4">
            <span className="lovable-label">Sincronizando</span>
            <span className="font-display text-sm tracking-[0.14em] text-foreground sm:text-base">
              {measured ? `${Math.round(normalizedProgress ?? 0)}%` : "EM ANDAMENTO"}
            </span>
          </div>
          <div
            className="relative mt-3 h-2 overflow-hidden rounded-full bg-secondary"
            role={measured ? "progressbar" : undefined}
            aria-valuemin={measured ? 0 : undefined}
            aria-valuemax={measured ? 100 : undefined}
            aria-valuenow={measured ? normalizedProgress : undefined}
          >
            {measured ? (
              <div
                className="h-full rounded-full transition-[width] duration-75"
                style={{
                  width: `${normalizedProgress}%`,
                  background: "var(--gl-gradient-primary)",
                  boxShadow: "var(--gl-shadow-glow)",
                }}
              />
            ) : (
              <div className="animate-bar-shimmer absolute inset-y-0 left-0 w-1/3 rounded-full bg-[linear-gradient(90deg,transparent,oklch(0.72_0.2_305),transparent)]" aria-hidden="true" />
            )}
          </div>

          <ul className="mt-5 space-y-2.5">
            {loadingSteps.map((step, index) => {
              const done = complete || (measured && (normalizedProgress ?? 0) >= ((index + 1) / loadingSteps.length) * 100);
              const active = !done && index === currentStep;
              const Icon = step.icon;
              return (
                <li
                  key={step.label}
                  className={`animate-step-in flex items-center gap-3 text-sm ${done || active ? "text-foreground" : "text-muted-foreground/60"}`}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <span className={`grid h-7 w-7 place-items-center rounded-lg border ${done ? "border-transparent bg-primary/20 text-success" : active ? "border-primary/60 bg-primary/15 text-primary-glow" : "border-border bg-secondary/60 text-muted-foreground"}`}>
                    {done ? <Check className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="flex-1">{step.label}</span>
                  {done ? <span className="text-xs text-success">OK</span> : null}
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2"><Signal className="h-3.5 w-3.5 text-success" />Conexão protegida</span>
            <span>Região automática</span>
          </div>
        </div>

        <p className="mt-5 h-8 text-center text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

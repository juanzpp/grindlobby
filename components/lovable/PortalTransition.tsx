import type { CSSProperties } from "react";

export type TransitionFx = "portal" | "warp" | "glitch" | "shards";

export const TRANSITIONS: { id: TransitionFx; label: string; hint: string }[] = [
  { id: "portal", label: "Portal", hint: "Energia sugada para o portal" },
  { id: "warp", label: "Hiperluz", hint: "Salto em velocidade de luz" },
  { id: "glitch", label: "Glitch", hint: "Corrupção de sinal e RGB" },
  { id: "shards", label: "Fragmentos", hint: "Cristais convergindo + wipe" },
];

export default function PortalTransition({ variant = "portal" }: { variant?: TransitionFx }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      <div className="animate-t-vignette absolute inset-0 bg-[radial-gradient(circle_at_28%_50%,transparent_18%,oklch(0.04_0.012_285/0.94)_78%)]" />
      {variant === "portal" ? <PortalLayers /> : null}
      {variant === "warp" ? <WarpLayers /> : null}
      {variant === "glitch" ? <GlitchLayers /> : null}
      {variant === "shards" ? <ShardLayers /> : null}
      <div className="animate-t-core absolute left-[28%] top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-glow blur-2xl" />
      <div className="animate-t-flash absolute inset-0 bg-[radial-gradient(circle_at_28%_50%,oklch(0.9_0.06_305),oklch(0.55_0.2_305/0.55)_35%,transparent_70%)]" />
    </div>
  );
}

function PortalLayers() {
  return (
    <>
      {[12, 26, 38, 47, 55, 63, 72, 84].map((top, index) => (
        <span
          key={top}
          className="animate-t-streak absolute right-0 h-[2px] w-[46vw] rounded-full bg-[linear-gradient(270deg,transparent,oklch(0.8_0.16_305/0.95),transparent)]"
          style={{ top: `${top}%`, animationDelay: `${index * 70}ms`, filter: "blur(0.6px)" }}
        />
      ))}
      <div className="animate-t-sweep absolute inset-y-0 right-0 w-1/2 bg-[linear-gradient(270deg,transparent,oklch(0.62_0.2_305/0.5),transparent)] blur-2xl" />
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="animate-t-shock absolute left-[28%] top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary-glow"
          style={{ animationDelay: `${350 + index * 260}ms` }}
        />
      ))}
      <div className="animate-t-beam absolute left-[28%] top-0 h-full w-[3px] -translate-x-1/2 bg-[linear-gradient(180deg,transparent,oklch(0.82_0.14_305/0.9),transparent)] blur-[2px]" />
      {Array.from({ length: 22 }).map((_, index) => (
        <span
          key={index}
          className="animate-t-ember absolute h-1 w-1 rounded-full bg-primary-glow"
          style={{
            left: `${18 + ((index * 37) % 24)}%`,
            bottom: `${(index * 13) % 40}%`,
            animationDelay: `${index * 55}ms`,
          }}
        />
      ))}
    </>
  );
}

function WarpLayers() {
  return (
    <>
      {Array.from({ length: 46 }).map((_, index) => (
        <span
          key={index}
          className="animate-warp-line absolute right-0 h-[1.5px] rounded-full bg-[linear-gradient(270deg,transparent,oklch(0.86_0.14_305),transparent)]"
          style={{
            top: `${(index * 2.2) % 100}%`,
            width: `${28 + ((index * 13) % 50)}vw`,
            animationDelay: `${(index % 12) * 55}ms`,
            animationDuration: `${520 + ((index * 37) % 260)}ms`,
          }}
        />
      ))}
      <div className="animate-warp-zoom absolute left-[28%] top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-glow/70 bg-[radial-gradient(circle,oklch(0.7_0.2_305/0.45),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_28%_50%,transparent_25%,oklch(0.03_0.01_285/0.85)_75%)]" />
    </>
  );
}

function GlitchLayers() {
  return (
    <>
      {Array.from({ length: 14 }).map((_, index) => (
        <span
          key={index}
          className="animate-glitch-slice absolute inset-x-0 bg-[linear-gradient(90deg,transparent,oklch(0.7_0.2_305/0.55),transparent)]"
          style={{
            top: `${(index * 7.4) % 100}%`,
            height: `${6 + ((index * 5) % 22)}px`,
            animationDelay: `${index * 60}ms`,
          }}
        />
      ))}
      <div className="animate-glitch-rgb absolute inset-0 bg-[linear-gradient(90deg,oklch(0.6_0.24_20/0.35),transparent_40%,oklch(0.6_0.2_240/0.35))] mix-blend-screen" />
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: "repeating-linear-gradient(180deg, oklch(0.8 0.05 305 / 0.35) 0 1px, transparent 1px 4px)",
        }}
      />
      <div className="animate-t-beam absolute left-[28%] top-0 h-full w-[6px] -translate-x-1/2 bg-[linear-gradient(180deg,transparent,oklch(0.9_0.1_305),transparent)] blur-[3px]" />
    </>
  );
}

function ShardLayers() {
  return (
    <>
      {Array.from({ length: 26 }).map((_, index) => {
        const angle = (index / 26) * Math.PI * 2;
        return (
          <span
            key={index}
            className="animate-shard absolute left-[28%] top-1/2 h-3 w-3 border border-primary-glow bg-primary/40"
            style={
              {
                "--sx": `${Math.cos(angle) * 46}vw`,
                "--sy": `${Math.sin(angle) * 46}vh`,
                animationDelay: `${index * 45}ms`,
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
              } as CSSProperties
            }
          />
        );
      })}
      <div className="animate-ink-wipe absolute inset-0 bg-[radial-gradient(circle_at_28%_50%,oklch(0.5_0.2_302/0.85),oklch(0.04_0.01_285)_60%)]" />
      {[0, 1].map((index) => (
        <span
          key={index}
          className="animate-t-shock absolute left-[28%] top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary-glow"
          style={{ animationDelay: `${600 + index * 380}ms` }}
        />
      ))}
    </>
  );
}

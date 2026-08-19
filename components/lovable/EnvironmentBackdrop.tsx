type EnvironmentBackdropProps = {
  focusX?: number;
  intensity?: number;
};

/** Procedural environment imported from the current Lovable login. */
export default function EnvironmentBackdrop({
  focusX = 50,
  intensity = 1,
}: EnvironmentBackdropProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at ${focusX}% 42%, oklch(0.16 0.07 298 / ${0.45 * intensity}), transparent 60%), linear-gradient(180deg, oklch(0.06 0.02 288), oklch(0.03 0.008 285) 70%)`,
        }}
      />

      <div
        className="animate-env-flicker absolute inset-0 blur-3xl"
        style={{
          background: `radial-gradient(closest-side at ${focusX}% 48%, oklch(0.5 0.17 303 / ${0.3 * intensity}), transparent 70%)`,
        }}
      />

      {[-14, -6, 0, 7, 15].map((degree, index) => (
        <span
          key={degree}
          className="animate-shaft absolute top-[-10%] h-[130%] w-[16vw] origin-top blur-2xl"
          style={{
            left: `${focusX + degree}%`,
            background: "linear-gradient(180deg, oklch(0.55 0.16 303 / 0.2), transparent 78%)",
            animationDelay: `${index * 1.4}s`,
            transform: "translateX(-50%)",
          }}
        />
      ))}

      <div
        className="animate-fog absolute inset-x-[-20%] bottom-[-10%] h-[70%] blur-3xl"
        style={{
          background: "radial-gradient(60% 100% at 50% 100%, oklch(0.22 0.07 300 / 0.42), transparent 70%)",
        }}
      />
      <div
        className="animate-fog-rev absolute inset-x-[-25%] bottom-[-16%] h-[55%] blur-3xl"
        style={{
          background: "radial-gradient(70% 100% at 40% 100%, oklch(0.18 0.05 292 / 0.7), transparent 72%)",
        }}
      />

      <div
        className="animate-floor absolute inset-x-0 bottom-0 h-[46%] opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.72 0.18 305 / 0.5) 1px, transparent 1px), linear-gradient(90deg, oklch(0.72 0.18 305 / 0.35) 1px, transparent 1px)",
          backgroundSize: "160px 160px",
          transform: "perspective(520px) rotateX(72deg)",
          transformOrigin: "bottom",
          maskImage: "linear-gradient(180deg, transparent, black 45%, transparent 95%)",
        }}
      />
      <div
        className="absolute bottom-0 h-[26%] w-[46%] blur-2xl"
        style={{
          left: `${focusX}%`,
          transform: "translateX(-50%)",
          background: "radial-gradient(50% 100% at 50% 100%, oklch(0.5 0.17 303 / 0.24), transparent 72%)",
        }}
      />

      {Array.from({ length: 26 }).map((_, index) => (
        <span
          key={index}
          className="animate-dust absolute rounded-full bg-primary-glow"
          style={{
            left: `${(index * 37) % 100}%`,
            bottom: `${(index * 17) % 30}%`,
            height: index % 4 === 0 ? 3 : 2,
            width: index % 4 === 0 ? 3 : 2,
            filter: "blur(0.5px)",
            animationDelay: `${index * 620}ms`,
            animationDuration: `${11 + (index % 7)}s`,
            opacity: 0.5,
          }}
        />
      ))}

      <div
        className="animate-grain absolute inset-[-2%] opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage: "radial-gradient(oklch(1 0 0 / 0.8) 0.5px, transparent 0.6px)",
          backgroundSize: "3px 3px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_30%,oklch(0.02_0.006_285/0.92)_92%)]" />
    </div>
  );
}

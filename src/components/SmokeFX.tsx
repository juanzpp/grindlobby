/**
 * Fumaça volumétrica procedural para o banner da caixa da loja.
 * Camadas de nuvens em movimento + jatos de vapor subindo + faíscas,
 * tudo com blur e mix-blend para parecer fumaça real (sem vídeo/gif).
 */
export function SmokeFX({ originX = 72 }: { originX?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* nuvens densas rolando na base */}
      {[0, 1, 2].map((i) => (
        <div
          key={`cloud-${i}`}
          className={i % 2 === 0 ? "animate-smoke-drift" : "animate-smoke-drift-rev"}
          style={{
            position: "absolute",
            left: "-25%",
            right: "-25%",
            bottom: `${-18 + i * 6}%`,
            height: `${58 - i * 8}%`,
            filter: `blur(${28 + i * 10}px)`,
            opacity: 0.5 - i * 0.1,
            animationDelay: `${i * -7}s`,
            background: `radial-gradient(40% 100% at ${originX - 18}% 100%, oklch(0.5 0.14 300 / 0.55), transparent 70%),
              radial-gradient(45% 100% at ${originX}% 100%, oklch(0.62 0.16 305 / 0.5), transparent 72%),
              radial-gradient(38% 90% at ${originX + 20}% 100%, oklch(0.4 0.1 290 / 0.5), transparent 70%)`,
            mixBlendMode: "screen",
          }}
        />
      ))}

      {/* jatos de vapor subindo da caixa */}
      {Array.from({ length: 7 }).map((_, i) => (
        <span
          key={`plume-${i}`}
          className="animate-smoke-rise absolute rounded-full"
          style={{
            left: `${originX - 12 + i * 4}%`,
            bottom: "6%",
            width: `${9 + (i % 3) * 5}vw`,
            height: `${9 + (i % 3) * 5}vw`,
            background:
              "radial-gradient(circle, oklch(0.68 0.16 304 / 0.32), transparent 68%)",
            filter: "blur(22px)",
            animationDelay: `${i * 1.35}s`,
            animationDuration: `${11 + (i % 4) * 2}s`,
            mixBlendMode: "screen",
          }}
        />
      ))}

      {/* faíscas / poeira brilhando */}
      {Array.from({ length: 22 }).map((_, i) => (
        <span
          key={`spark-${i}`}
          className="animate-smoke-spark absolute rounded-full bg-primary-glow"
          style={{
            left: `${originX - 20 + ((i * 13) % 42)}%`,
            bottom: `${(i * 11) % 34}%`,
            height: i % 5 === 0 ? 3 : 2,
            width: i % 5 === 0 ? 3 : 2,
            filter: "blur(0.4px)",
            animationDelay: `${i * 480}ms`,
            animationDuration: `${7 + (i % 5)}s`,
          }}
        />
      ))}

      {/* grão sutil para fundir a fumaça com a arte */}
      <div
        className="animate-grain absolute inset-[-2%] opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(oklch(1 0 0 / 0.8) 0.5px, transparent 0.6px)",
          backgroundSize: "3px 3px",
        }}
      />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

import logo from "@/assets/grindlobby-logo.png.asset.json";
import { useIsMobile } from "@/hooks/use-mobile";

export type GrindLoadingScreenProps = {
  /** Dispara a sequência final (pulso + flash + fade/blur) e depois onComplete. */
  isComplete?: boolean;
  onComplete?: () => void;
};

/**
 * Tela de inicialização: a logo PNG é tratada como portal/artefato vivo.
 * Sem barra, sem porcentagem, sem texto — apenas ciclo visual em loop.
 */
export function GrindLoadingScreen({ isComplete = false, onComplete }: GrindLoadingScreenProps) {
  const isMobile = useIsMobile();
  const [exiting, setExiting] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isComplete || firedRef.current) return;
    firedRef.current = true;
    setExiting(true);
    const t = window.setTimeout(() => onComplete?.(), 1250);
    return () => window.clearTimeout(t);
  }, [isComplete, onComplete]);

  const size = isMobile ? 150 : 300;

  return (
    <div
      className={`relative grid h-[100dvh] w-full place-items-center overflow-hidden bg-background ${
        exiting ? "gl-exit" : ""
      }`}
    >
      <Ambience light={isMobile} />

      <div
        className="relative grid place-items-center"
        style={{ width: size * 1.9, height: size * 1.9 }}
      >
        {/* Halo / distorção atrás do portal */}
        <span
          aria-hidden
          className="gl-halo absolute inset-0 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, oklch(0.42 0.17 303 / 0.55), oklch(0.2 0.1 296 / 0.18) 55%, transparent 72%)",
          }}
        />

        {/* Moldura arquitetônica do portal */}
        <PortalFrame />

        {/* Fragmentos sugados para o centro */}
        {!isMobile &&
          Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <span
                key={i}
                aria-hidden
                className="gl-fragment absolute h-[3px] w-[3px] rounded-full bg-primary-glow"
                style={
                  {
                    "--fx": `${Math.cos(a) * (size * 0.95)}px`,
                    "--fy": `${Math.sin(a) * (size * 0.8)}px`,
                    animationDelay: `${(i % 5) * 320}ms`,
                  } as React.CSSProperties
                }
              />
            );
          })}

        {/* Logo — peça central, nunca redesenhada */}
        <div
          className={`relative ${exiting ? "gl-final-pulse" : ""}`}
          style={{ width: size, height: size }}
        >
          <img
            src={logo.url}
            alt="GrindLobby"
            width={512}
            height={512}
            className={`absolute inset-0 h-full w-full object-contain ${exiting ? "" : "gl-artifact"}`}
          />

          {/* Energia roxa subindo pelos sulcos internos (mascarada pela própria logo) */}
          <span
            aria-hidden
            className="absolute inset-0 overflow-hidden mix-blend-screen"
            style={{
              maskImage: `url(${logo.url})`,
              WebkitMaskImage: `url(${logo.url})`,
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskPosition: "center",
            }}
          >
            <span
              className="gl-energy absolute inset-x-0 h-[70%] bottom-0 blur-md"
              style={{
                background:
                  "linear-gradient(0deg, oklch(0.75 0.2 305 / 0.95), oklch(0.5 0.19 303 / 0.5) 55%, transparent)",
              }}
            />
            <span
              className="gl-edge absolute inset-0"
              style={{
                background:
                  "linear-gradient(12deg, transparent 30%, oklch(0.98 0.02 300 / 0.5) 50%, transparent 68%)",
              }}
            />
          </span>
        </div>
      </div>

      {exiting && (
        <div
          aria-hidden
          className="gl-final-flash pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, oklch(0.68 0.2 305 / 0.9), oklch(0.35 0.18 300 / 0.45) 45%, transparent 75%)",
          }}
        />
      )}
    </div>
  );
}

/** SVG decorativo: 3 arcos incompletos verticais/elípticos alinhados ao formato pontudo da marca. */
function PortalFrame() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className="absolute inset-0 h-full w-full"
      fill="none"
    >
      <defs>
        <linearGradient id="glArcA" x1="100" y1="200" x2="100" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.72 0.19 305)" stopOpacity="0.95" />
          <stop offset="55%" stopColor="oklch(0.85 0.03 300)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="oklch(0.6 0.15 303)" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="glArcB" x1="100" y1="200" x2="100" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.62 0.2 303)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="oklch(0.9 0.02 300)" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      <g className="gl-arc-rot" style={{ transformOrigin: "100px 100px" }}>
        <path
          className="gl-arc"
          style={{ ["--len" as string]: 420, strokeDasharray: 420 }}
          d="M100 6 C 150 40, 168 100, 100 194"
          stroke="url(#glArcA)"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      </g>
      <g className="gl-arc-rot-rev" style={{ transformOrigin: "100px 100px" }}>
        <path
          className="gl-arc"
          style={{ ["--len" as string]: 420, strokeDasharray: 420, animationDelay: "260ms" }}
          d="M100 194 C 32 100, 50 40, 100 6"
          stroke="url(#glArcB)"
          strokeWidth="0.7"
          strokeLinecap="round"
        />
      </g>
      <path
        className="gl-arc"
        style={{ ["--len" as string]: 300, strokeDasharray: 300, animationDelay: "520ms" }}
        d="M52 176 C 78 188, 122 188, 148 176"
        stroke="url(#glArcA)"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <path
        className="gl-arc"
        style={{ ["--len" as string]: 300, strokeDasharray: 300, animationDelay: "700ms" }}
        d="M62 26 C 82 16, 118 16, 138 26"
        stroke="url(#glArcB)"
        strokeWidth="0.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Ambience({ light }: { light: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(95% 75% at 50% 52%, oklch(0.11 0.045 297 / 0.85), transparent 62%), linear-gradient(180deg, oklch(0.035 0.012 288), oklch(0.015 0.005 285) 80%)",
        }}
      />
      {!light && (
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage: "radial-gradient(oklch(1 0 0 / 0.7) 0.5px, transparent 0.6px)",
            backgroundSize: "3px 3px",
          }}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_34%,oklch(0.012_0.004_285/0.92)_92%)]" />
    </div>
  );
}

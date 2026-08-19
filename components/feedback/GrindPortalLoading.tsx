import Image from "next/image";

export type GrindPortalLoadingProps = {
  variant?: "fullscreen" | "overlay" | "inline";
  label?: string;
  progress?: number;
  className?: string;
  complete?: boolean;
};

export default function GrindPortalLoading({
  variant = "inline",
  label = "Preparando sua sessão…",
  progress,
  className = "",
  complete = false,
}: GrindPortalLoadingProps) {
  const measured = typeof progress === "number" && Number.isFinite(progress);
  const normalizedProgress = measured ? Math.max(0, Math.min(100, progress)) : undefined;

  return (
    <div
      className={`portal-loading portal-loading-${variant} ${complete?"portal-loading-complete":""} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="portal-loader-depth" aria-hidden="true">
        <span className="portal-loader-beam portal-loader-beam-a" />
        <span className="portal-loader-beam portal-loader-beam-b" />
        <span className="portal-loader-ring portal-loader-ring-outer" />
        <span className="portal-loader-ring portal-loader-ring-mid" />
        <span className="portal-loader-ring portal-loader-ring-inner" />
        <span className="portal-loader-energy" />
        <span className="portal-loader-particle portal-loader-particle-a" />
        <span className="portal-loader-particle portal-loader-particle-b" />
        <span className="portal-loader-particle portal-loader-particle-c" />
        <span className="portal-loader-particle portal-loader-particle-d" />
        <span className="portal-loader-logo">
          <Image src="/brand/ascent-portal.png" alt="" width={120} height={120} sizes="120px" className="h-full w-full object-contain"/>
        </span>
      </div>
      <div className="portal-loader-copy">
        <strong>{variant==="inline"?label:"CARREGANDO GRINDLOBBY"}</strong>
        {variant!=="inline"?<small>{label}</small>:null}
        {measured ? (
          <div
            className="portal-loader-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={normalizedProgress}
          >
            <i style={{ width: `${normalizedProgress}%` }} />
          </div>
        ) : (
          <span className="portal-loader-indeterminate" aria-hidden="true">
            <i />
          </span>
        )}
      </div>
    </div>
  );
}

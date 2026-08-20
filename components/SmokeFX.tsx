"use client";

export default function SmokeFX({ originX = 72 }: { originX?: number }) {
  const vapors = Array.from({ length: 7 });
  const sparks = Array.from({ length: 22 });

  return (
    <div className="gl-store-smoke" aria-hidden="true" style={{ "--smoke-origin": `${originX}%` } as React.CSSProperties}>
      <div className="gl-store-smoke-base gl-store-smoke-base-a" />
      <div className="gl-store-smoke-base gl-store-smoke-base-b" />
      <div className="gl-store-smoke-base gl-store-smoke-base-c" />
      {vapors.map((_, index) => <span key={`vapor-${index}`} className="gl-store-vapor" style={{ animationDelay: `${index * -1.35}s`, animationDuration: `${11 + (index % 4) * 2}s` }} />)}
      {sparks.map((_, index) => <span key={`spark-${index}`} className="gl-store-spark" style={{ animationDelay: `${index * -480}ms`, left: `${52 + (index * 13) % 40}%`, bottom: `${8 + (index * 7) % 28}%` }} />)}
      <div className="gl-store-grain" />
    </div>
  );
}

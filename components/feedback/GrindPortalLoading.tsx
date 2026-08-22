import Image from "next/image";
import {Loader2} from "lucide-react";
import type {TransitionFx} from "@/components/lovable/PortalTransition";

export type GrindPortalLoadingProps={
  variant?:"fullscreen"|"overlay"|"inline";
  label?:string;
  progress?:number;
  className?:string;
  complete?:boolean;
  effect?:TransitionFx;
};

export default function GrindPortalLoading({variant="inline",label="Carregando…",className=""}:GrindPortalLoadingProps){
  if(variant==="inline"){
    return <span className={`portal-loading portal-loading-inline ${className}`.trim()} role="status" aria-live="polite" aria-label={label}><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true"/></span>;
  }

  return <div className={`gl-cinematic-loader ${variant==="overlay"?"is-overlay":""} ${className}`.trim()} role="status" aria-live="polite" aria-label={label} aria-busy="true">
    <div className="gl-gate-scene" aria-hidden="true">
      <div className="gl-gate-shadow"/>
      <div className="gl-gate-frame"/>
      <div className="gl-gate-rim"/>
      <div className="gl-gate-core"/>
      <div className="gl-energy-ring r1"/>
      <div className="gl-energy-ring r2"/>
      <div className="gl-energy-ring r3"/>
      <span className="gl-particle p1"/><span className="gl-particle p2"/><span className="gl-particle p3"/><span className="gl-particle p4"/><span className="gl-particle p5"/>

      <div className="gl-desktop-portal-shell">
        <span className="gl-desktop-orbit orbit-a"/>
        <span className="gl-desktop-orbit orbit-b"/>
        <span className="gl-desktop-orbit orbit-c"/>
        <span className="gl-desktop-iris iris-1"/><span className="gl-desktop-iris iris-2"/><span className="gl-desktop-iris iris-3"/>
        <span className="gl-desktop-iris iris-4"/><span className="gl-desktop-iris iris-5"/><span className="gl-desktop-iris iris-6"/>
        <span className="gl-desktop-energy-scan"/>
        <span className="gl-desktop-core-flare"/>
        <span className="gl-desktop-spark s1"/><span className="gl-desktop-spark s2"/><span className="gl-desktop-spark s3"/><span className="gl-desktop-spark s4"/>
      </div>

      <div className="gl-loader-logo-wrap">
        <span className="gl-loader-logo-glow"/>
        <Image src="/brand/grindlobby-official.png" alt="" width={156} height={191} priority sizes="160px" className="gl-loader-logo"/>
      </div>
    </div>
  </div>;
}

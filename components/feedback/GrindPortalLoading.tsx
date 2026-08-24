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

  return <div className={`gl-logo-loader ${variant==="overlay"?"is-overlay":""} ${className}`.trim()} role="status" aria-live="polite" aria-label={label} aria-busy="true">
    <div className="gl-logo-loader-mark" aria-hidden="true">
      <span className="gl-logo-loader-halo"/>
      <span className="gl-logo-loader-orbit"/>
      <Image src="/brand/grindlobby-official.png" alt="" width={168} height={168} priority sizes="168px" className="gl-logo-loader-image"/>
    </div>
  </div>;
}

import GrindLobbyLogo from "@/components/brand/GrindLobbyLogo";
type Props={variant?:"fullscreen"|"overlay"|"inline";label?:string;progress?:number};
export default function GrindLoading({variant="inline",label="Sincronizando…",progress}:Props){
 const measured=typeof progress==="number"&&Number.isFinite(progress);
 return <div className={`grind-loading grind-loading-${variant}`} role="status" aria-live="polite" aria-label={label}>
  <div className="grind-loader-mark"><i/><i/><i/><i/><div className="grind-loader-ring"/><span><GrindLobbyLogo variant="symbol" size="sm"/></span><b/><b/><b/></div>
  <div className="grind-loader-copy"><strong>{label}</strong>{measured?<div className="grind-progress"><i style={{width:`${Math.max(0,Math.min(100,progress))}%`}}/></div>:null}</div>
 </div>;
}

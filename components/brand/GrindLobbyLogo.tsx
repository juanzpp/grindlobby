import Image from "next/image";

type Props={variant?:"symbol"|"wordmark"|"full";size?:"sm"|"md"|"lg"|"xl";animated?:boolean;className?:string};
const sizes={sm:28,md:40,lg:56,xl:78};
export default function GrindLobbyLogo({variant="full",size="md",animated=false,className=""}:Props){
 const px=sizes[size];
 const symbol=<span className={`gl-logo-symbol gl-logo-official ${animated?"is-animated":""}`} style={{width:px,height:px}} aria-hidden="true"><Image src="/brand/grindlobby-official.png" alt="" width={px} height={px} sizes={`${px}px`} className="h-full w-full object-contain"/></span>;
 const wordmark=<span className="gl-logo-wordmark">GRIND<span>LOBBY</span></span>;
 return <span className={`gl-logo gl-logo-${variant} gl-logo-${size} ${className}`} aria-label="GrindLobby">{variant!=="wordmark"?symbol:null}{variant!=="symbol"?wordmark:null}</span>;
}

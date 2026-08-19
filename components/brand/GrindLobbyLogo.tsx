type Props={variant?:"symbol"|"wordmark"|"full";size?:"sm"|"md"|"lg"|"xl";animated?:boolean;className?:string};
const sizes={sm:28,md:40,lg:56,xl:78};
export default function GrindLobbyLogo({variant="full",size="md",animated=false,className=""}:Props){
 const px=sizes[size];
 const symbol=<span className={`gl-logo-symbol ${animated?"is-animated":""}`} style={{width:px,height:px}} aria-hidden="true"><svg viewBox="0 0 64 64"><path className="gl-shield" d="M32 3 55 16v32L32 61 9 48V16Z"/><path className="gl-monogram" d="M29 18H19v28h15V34h-7m8-16v28h11"/><path className="gl-wave" d="m27 31 3-5 4 11 3-6"/></svg></span>;
 const wordmark=<span className="gl-logo-wordmark">GRIND<span>LOBBY</span></span>;
 return <span className={`gl-logo gl-logo-${variant} gl-logo-${size} ${className}`} aria-label="GrindLobby">{variant!=="wordmark"?symbol:null}{variant!=="symbol"?wordmark:null}</span>;
}

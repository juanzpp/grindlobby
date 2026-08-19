import Image from "next/image";

type Props={
  compact?:boolean;
  className?:string;
  emblemSize?:number;
};

export default function LovableBrand({compact=false,className="",emblemSize=56}:Props){
  return <div className={`lovable-brand ${compact?"lovable-brand-compact":""} ${className}`.trim()}>
    <Image
      src="/brand/ascent-portal.png"
      alt=""
      width={emblemSize}
      height={emblemSize}
      sizes={`${emblemSize}px`}
      className="lovable-brand-emblem"
    />
    {!compact?<span className="font-display">GRIND<b>LOBBY</b></span>:null}
  </div>;
}

import Image from "next/image";

type WebPortalLoadingProps={label?:string;className?:string};

export default function WebPortalLoading({label="Sincronizando GrindLobby…",className=""}:WebPortalLoadingProps){
  return <div className={`web-portal-loader ${className}`.trim()} role="status" aria-live="polite" aria-label={label} aria-busy="true">
    <div className="web-portal-vignette" aria-hidden="true"/>
    <div className="web-portal-stage" aria-hidden="true">
      <span className="web-portal-haze haze-a"/>
      <span className="web-portal-haze haze-b"/>
      <span className="web-portal-horizon"/>
      <span className="web-portal-floor-line floor-a"/>
      <span className="web-portal-floor-line floor-b"/>
      <span className="web-portal-floor-line floor-c"/>
      <div className="web-portal-machine">
        <span className="web-portal-orbit orbit-outer"/>
        <span className="web-portal-orbit orbit-mid"/>
        <span className="web-portal-orbit orbit-inner"/>
        <span className="web-portal-iris iris-a"/>
        <span className="web-portal-iris iris-b"/>
        <span className="web-portal-iris iris-c"/>
        <span className="web-portal-iris iris-d"/>
        <span className="web-portal-scan"/>
        <span className="web-portal-core"/>
        <div className="web-portal-logo-shell">
          <span className="web-portal-logo-glow"/>
          <Image src="/brand/grindlobby-official.png" alt="" width={156} height={191} priority sizes="156px" className="web-portal-logo"/>
        </div>
      </div>
      <span className="web-portal-spark spark-a"/>
      <span className="web-portal-spark spark-b"/>
      <span className="web-portal-spark spark-c"/>
      <span className="web-portal-spark spark-d"/>
    </div>
  </div>;
}

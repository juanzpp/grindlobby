import Image from "next/image";

type Props = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  portalState?: "idle" | "energizing" | "traversing";
};

export default function AuthShell({children,eyebrow,title,description,portalState="idle"}:Props){
 return <main className={`lovable-login auth-portal-${portalState}`}>
  <div className="lovable-login-grid">
   <section className="lovable-login-hero" aria-label="GrindLobby">
    <div className="lovable-login-art"><Image src="/lovable/login-portal.jpg" alt="Portal monumental da GrindLobby" width={1280} height={1280} priority sizes="(max-width: 900px) 100vw, 58vw"/><span className="lovable-login-core" aria-hidden="true"/></div>
    <h2 className="lovable-login-wordmark font-display">GRINDLOBBY</h2>
    <div className="lovable-login-divider" aria-hidden="true"><span/><b>◆</b><span/></div>
    <p className="lovable-login-tagline font-display">Seu caminho. Sua lenda.</p>
    <p className="lovable-login-copy">Compita. Evolua. Conquiste.<br/>O próximo nível começa aqui.</p>
   </section>
   <section className="lovable-login-card auth-card">
    <header className="lovable-login-card-head"><Image className="lovable-login-mini-logo" src="/brand/ascent-portal.png" alt="" width={128} height={128} sizes="96px"/><p className="font-display text-xl tracking-[.3em] text-foreground">GRINDLOBBY</p></header>
    <small className="auth-eyebrow">{eyebrow}</small><h1>{title}</h1><p className="auth-description">{description}</p>{children}
   </section>
  </div>
 </main>;
}

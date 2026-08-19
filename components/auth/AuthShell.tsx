import GrindLobbyLogo from "@/components/brand/GrindLobbyLogo";
import GrindPortalLoading from "@/components/feedback/GrindPortalLoading";

type Props = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  portalState?: "idle" | "energizing" | "traversing";
};

export default function AuthShell({children,eyebrow,title,description,portalState="idle"}:Props){
 return <main className={`auth-shell auth-portal-${portalState}`}><section className="auth-visual" aria-hidden="true"><div className="auth-grid"/><GrindLobbyLogo variant="full" size="xl" animated/><div className="auth-gateway"><GrindPortalLoading variant="inline" label="GRIND GATEWAY"/></div><div className="auth-visual-copy"><small>YOUR SQUAD. YOUR GRIND.</small><h2>Onde partidas viram histórias.</h2><p>Voz, lobby e transmissão em uma experiência competitiva feita para jogar junto.</p></div></section><section className="auth-content"><div className="auth-card"><GrindLobbyLogo variant="full" size="lg" className="auth-mobile-logo"/><small className="auth-eyebrow">{eyebrow}</small><h1>{title}</h1><p className="auth-description">{description}</p>{children}</div></section></main>;
}

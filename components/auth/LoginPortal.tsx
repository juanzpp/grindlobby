import GrindPortalLoading from "@/components/feedback/GrindPortalLoading";

export default function LoginPortal(){
 return <div className="login-portal" role="status" aria-live="polite"><div className="portal-camera"><GrindPortalLoading variant="fullscreen" label="Sincronizando perfil…"/></div></div>
}

import WebPortalLoading from "@/components/feedback/WebPortalLoading";

export default function LoginPortal({operation="Sincronizando perfil",complete=false}:{operation?:string;complete?:boolean}){
 return <div className="login-portal" role="status" aria-live="polite"><div className="portal-camera"><WebPortalLoading label={complete?"Entrada concluída":operation}/></div></div>
}

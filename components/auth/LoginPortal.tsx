import GrindPortalLoading from "@/components/feedback/GrindPortalLoading";

export default function LoginPortal({operation="Sincronizando perfil",complete=false}:{operation?:string;complete?:boolean}){
 return <div className="login-portal" role="status" aria-live="polite"><div className="portal-camera"><GrindPortalLoading variant="fullscreen" label={operation} complete={complete}/></div></div>
}

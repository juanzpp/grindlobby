"use client";
import GrindLobbyLogo from "@/components/brand/GrindLobbyLogo";
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="error-page"><GrindLobbyLogo variant="full" size="lg"/><span>OFFLINE</span><h1>Algo interrompeu a sessão.</h1><p>Tente novamente. Seus dados de autenticação não foram exibidos.</p><button onClick={reset}>Tentar novamente</button></main>}

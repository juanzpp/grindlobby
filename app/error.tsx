"use client";
import LovableBrand from "@/components/brand/LovableBrand";
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="error-page"><LovableBrand emblemSize={84}/><span>OFFLINE</span><h1>Algo interrompeu a sessão.</h1><p>Tente novamente. Seus dados de autenticação não foram exibidos.</p><button onClick={reset}>Tentar novamente</button></main>}

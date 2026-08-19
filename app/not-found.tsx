import Link from "next/link";import LovableBrand from "@/components/brand/LovableBrand";
export default function NotFound(){return <main className="error-page"><LovableBrand emblemSize={84}/><span>404</span><h1>Essa sala não existe.</h1><p>O lobby pode ter sido removido ou o link está incorreto.</p><Link href="/">Voltar ao dashboard</Link></main>}

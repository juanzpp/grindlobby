import Link from "next/link";import GrindLobbyLogo from "@/components/brand/GrindLobbyLogo";
export default function NotFound(){return <main className="error-page"><GrindLobbyLogo variant="full" size="lg"/><span>404</span><h1>Essa sala não existe.</h1><p>O lobby pode ter sido removido ou o link está incorreto.</p><Link href="/">Voltar ao dashboard</Link></main>}

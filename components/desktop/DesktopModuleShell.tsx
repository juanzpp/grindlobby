"use client";

import {useRouter} from "next/navigation";
import {CalendarDays,Home,Mic,Search,Settings,Store,Trophy,UserRound,Users} from "lucide-react";
import type {ReactNode} from "react";

type Section="community"|"competitive"|"store"|"other";

export default function DesktopModuleShell({children,section="other",title,subtitle}:{children:ReactNode;section?:Section;title:string;subtitle?:string}){
  const router=useRouter();
  const go=(path:string)=>router.push(`${path}${path.includes("?")?"&":"?"}desktop=1`);
  return <main className="nd-module-shell">
    <aside className="nd-module-rail">
      <button className="nd-module-logo" onClick={()=>go("/")} aria-label="Início"><img src="/brand/grindlobby-official.png" alt=""/></button>
      <nav>
        <button onClick={()=>go("/")} title="Início"><Home/></button>
        <button className={section==="community"?"active":""} onClick={()=>go("/community")} title="Comunidades"><Users/></button>
        <button onClick={()=>go("/")} title="Voz"><Mic/></button>
        <button className={section==="competitive"?"active":""} onClick={()=>go("/competitive/valorant")} title="Matchmaking"><Trophy/></button>
        <button className={section==="competitive"?"active-soft":""} onClick={()=>go("/competitive/valorant")} title="Eventos"><CalendarDays/></button>
        <button className={section==="store"?"active":""} onClick={()=>go("/loja")} title="Loja"><Store/></button>
      </nav>
      <div className="nd-module-fill"/>
      <nav><button onClick={()=>go("/profile")} title="Perfil"><UserRound/></button><button onClick={()=>go("/settings")} title="Configurações"><Settings/></button></nav>
    </aside>
    <header className="nd-module-topbar">
      <div className="nd-module-heading"><span>{subtitle||"GRINDLOBBY DESKTOP"}</span><b>{title}</b></div>
      <div className="nd-module-search"><Search/><span>Buscar jogadores, squads ou jogos…</span><kbd>Ctrl K</kbd></div>
      <div className="nd-module-status"><i/><span>Desktop conectado</span></div>
    </header>
    <section className="nd-module-content">{children}</section>
  </main>;
}

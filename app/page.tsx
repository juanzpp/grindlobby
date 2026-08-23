import Dashboard from "@/components/Dashboard";
import DesktopReferenceUI,{type DesktopReferenceView} from "@/components/desktop/DesktopReferenceUI";
import {getCurrentUser} from "@/lib/auth";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";

type SearchParams=Promise<Record<string,string|string[]|undefined>>;
type DesktopView=DesktopReferenceView;
const desktopViews=new Set<DesktopView>(["home","lobbies","community","music","friends","messages","tournaments","events","store","profile","settings"]);

export default async function Home({searchParams}:{searchParams:SearchParams}){
  const query=await searchParams;
  const standardDesktop=query.desktop==="1";
  const user=await getCurrentUser();
  if(!user)redirect(standardDesktop?"/login?desktop=1":"/login");
  const cookieStore=await cookies();
  const next=cookieStore.get("grindlobby_next")?.value;
  if(next){
    const decoded=decodeURIComponent(next);
    if(/^\/lobby\/invite\/[A-Za-z0-9_-]{20,128}$/.test(decoded))redirect(standardDesktop?`${decoded}?desktop=1`:decoded);
  }
  if(standardDesktop){
    const requested=typeof query.view==="string"?query.view:"home";
    const initialView=desktopViews.has(requested as DesktopView)?requested as DesktopView:"home";
    return <DesktopReferenceUI user={user} initialView={initialView}/>;
  }
  return <Dashboard user={user}/>;
}

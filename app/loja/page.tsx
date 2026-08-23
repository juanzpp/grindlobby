import Dashboard from "@/components/Dashboard";
import DesktopHome from "@/components/desktop/DesktopHome";
import {getCurrentUser} from "@/lib/auth";
import {redirect} from "next/navigation";

type SearchParams=Promise<Record<string,string|string[]|undefined>>;

export default async function StorePage({searchParams}:{searchParams:SearchParams}){
  const query=await searchParams;
  const desktop=query.desktop==="1";
  const lite=query.desktop==="lite";
  const user=await getCurrentUser();
  if(!user)redirect(lite?"/login?desktop=lite":desktop?"/login?desktop=1":"/login");
  if(lite)redirect("/desktop-lite?desktop=lite");
  if(desktop)return <DesktopHome user={user} initialView="store"/>;
  return <Dashboard user={user} initialView="store"/>;
}

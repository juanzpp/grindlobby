import Dashboard from "@/components/Dashboard";
import {getCurrentUser} from "@/lib/auth";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";

export default async function Home(){
  const user=await getCurrentUser();
  if(!user)redirect("/login");
  const cookieStore=await cookies();
  const next=cookieStore.get("grindlobby_next")?.value;
  if(next){
    const decoded=decodeURIComponent(next);
    if(/^\/lobby\/invite\/[A-Za-z0-9_-]{20,128}$/.test(decoded))redirect(decoded);
  }
  return <Dashboard user={user}/>;
}

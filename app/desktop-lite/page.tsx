import DesktopLiteHome from "@/components/desktop/DesktopLiteHome";
import {getCurrentUser} from "@/lib/auth";
import {redirect} from "next/navigation";

export const metadata={title:"GrindLobby Performance Client"};

export default async function DesktopLitePage(){
  const user=await getCurrentUser();
  if(!user)redirect("/login?desktop=lite");
  return <DesktopLiteHome user={user}/>;
}

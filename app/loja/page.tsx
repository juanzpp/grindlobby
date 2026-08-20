import Dashboard from "@/components/Dashboard";
import {getCurrentUser} from "@/lib/auth";
import {redirect} from "next/navigation";

export default async function StorePage(){
  const user=await getCurrentUser();
  if(!user)redirect("/login");
  return <Dashboard user={user} initialView="store"/>;
}
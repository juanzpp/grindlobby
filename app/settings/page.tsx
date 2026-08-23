import {redirect} from "next/navigation";

type SearchParams=Promise<Record<string,string|string[]|undefined>>;

export default async function SettingsRoute({searchParams}:{searchParams:SearchParams}){
  const query=await searchParams;
  if(query.desktop==="lite")redirect("/desktop-lite?desktop=lite");
  if(query.desktop==="1")redirect("/?desktop=1&view=settings");
  redirect("/");
}

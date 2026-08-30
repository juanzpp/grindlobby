import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { GsapRouteMotion } from "@/components/GsapRouteMotion";
export function UserPresenceHeartbeat(){useEffect(()=>{let timer:number|undefined;let stopped=false;void(async()=>{const{data:{user}}=await supabase.auth.getUser();if(!user||stopped)return;const beat=()=>supabase.from("profiles").update({last_seen_at:new Date().toISOString(),status:"online"}).eq("id",user.id);await beat();timer=window.setInterval(()=>void beat(),30000)})();return()=>{stopped=true;if(timer)clearInterval(timer)}},[]);return <GsapRouteMotion/>}

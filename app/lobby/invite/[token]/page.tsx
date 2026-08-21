"use client";

import {useEffect,useState} from "react";
import {useParams,useRouter} from "next/navigation";
import GrindPortalLoading from "@/components/feedback/GrindPortalLoading";

export default function LobbyInvitePage(){
  const params=useParams<{token:string}>(),router=useRouter();
  const [error,setError]=useState("");
  useEffect(()=>{
    let cancelled=false;
    void (async()=>{
      const response=await fetch(`/api/lobbies/invite/${encodeURIComponent(params.token)}`,{method:"POST"});
      const body=await response.json().catch(()=>({}));
      if(cancelled)return;
      if(response.status===401){router.replace(`/login?next=${encodeURIComponent(`/lobby/invite/${params.token}`)}`);return}
      if(!response.ok||!body.lobbyId){setError(body.error||"Convite indisponível.");return}
      router.replace(`/lobby/${body.lobbyId}`);
    })();
    return()=>{cancelled=true};
  },[params.token,router]);
  if(error)return <main className="grid min-h-screen place-items-center bg-black px-6 text-white"><div className="max-w-md text-center"><h1 className="text-xl font-semibold">Convite indisponível</h1><p className="mt-3 text-sm text-white/60">{error}</p><button className="mt-6 rounded-lg border border-white/15 px-4 py-2 text-sm" onClick={()=>router.replace("/")}>Voltar ao GrindLobby</button></div></main>;
  return <GrindPortalLoading variant="fullscreen" label="Entrando no lobby"/>;
}

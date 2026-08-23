"use client";

import {useEffect} from "react";

const HEARTBEAT_MS=20_000;

export default function SessionPresenceHeartbeat(){
  useEffect(()=>{
    let disposed=false;
    let timer:number|undefined;

    const beat=async()=>{
      try{
        const response=await fetch("/api/me/presence",{method:"POST",cache:"no-store"});
        if(disposed)return false;
        return response.ok;
      }catch{
        return false;
      }
    };

    void beat().then(active=>{
      if(!active||disposed)return;
      timer=window.setInterval(()=>void beat(),HEARTBEAT_MS);
    });

    return()=>{
      disposed=true;
      if(timer!==undefined)window.clearInterval(timer);
    };
  },[]);

  return null;
}

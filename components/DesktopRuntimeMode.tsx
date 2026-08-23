"use client";

import {useEffect} from "react";

const liteKey="grindlobby.desktop.lite";
const runtimeKey="grindlobby.desktop.runtime";

type DesktopMode="1"|"lite";

export default function DesktopRuntimeMode(){
  useEffect(()=>{
    const url=new URL(window.location.href);
    const requested=url.searchParams.get("desktop");
    if(requested==="lite"||requested==="1"){
      sessionStorage.setItem(runtimeKey,requested);
      if(requested==="lite")sessionStorage.setItem(liteKey,"1");
      else sessionStorage.removeItem(liteKey);
    }
    const stored=sessionStorage.getItem(runtimeKey);
    const mode:DesktopMode|null=requested==="lite"||requested==="1"?requested:stored==="lite"||stored==="1"?stored:null;
    if(!mode)return;

    if(!requested){
      url.searchParams.set("desktop",mode);
      window.location.replace(`${url.pathname}${url.search}${url.hash}`);
      return;
    }

    const lite=mode==="lite";
    if(lite&&window.location.pathname==="/"){
      window.location.replace("/desktop-lite?desktop=lite");
      return;
    }

    const root=document.documentElement;
    root.dataset.grindDesktop=mode;
    root.classList.add("grind-desktop-runtime");
    root.classList.toggle("grind-desktop-lite",lite);
    const sync=()=>root.classList.toggle("grind-desktop-background",document.hidden||!document.hasFocus());
    sync();
    document.addEventListener("visibilitychange",sync);
    window.addEventListener("blur",sync);
    window.addEventListener("focus",sync);
    return()=>{
      document.removeEventListener("visibilitychange",sync);
      window.removeEventListener("blur",sync);
      window.removeEventListener("focus",sync);
      delete root.dataset.grindDesktop;
      root.classList.remove("grind-desktop-runtime","grind-desktop-lite","grind-desktop-background");
    };
  },[]);
  return null;
}

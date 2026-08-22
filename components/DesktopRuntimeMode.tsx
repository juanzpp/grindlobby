"use client";

import {useEffect} from "react";

const liteKey="grindlobby.desktop.lite";

export default function DesktopRuntimeMode(){
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const requested=params.get("desktop");
    if(requested==="lite")sessionStorage.setItem(liteKey,"1");
    if(requested==="1")sessionStorage.removeItem(liteKey);
    const lite=requested==="lite"||sessionStorage.getItem(liteKey)==="1";
    const desktop=requested==="1"||lite;
    if(!desktop)return;

    if(lite&&window.location.pathname==="/"){
      window.location.replace("/desktop-lite?desktop=lite");
      return;
    }

    const root=document.documentElement;
    root.classList.add("grind-desktop-runtime");
    if(lite)root.classList.add("grind-desktop-lite");
    const sync=()=>root.classList.toggle("grind-desktop-background",document.hidden||!document.hasFocus());
    sync();
    document.addEventListener("visibilitychange",sync);
    window.addEventListener("blur",sync);
    window.addEventListener("focus",sync);
    return()=>{
      document.removeEventListener("visibilitychange",sync);
      window.removeEventListener("blur",sync);
      window.removeEventListener("focus",sync);
      root.classList.remove("grind-desktop-runtime","grind-desktop-lite","grind-desktop-background");
    };
  },[]);
  return null;
}

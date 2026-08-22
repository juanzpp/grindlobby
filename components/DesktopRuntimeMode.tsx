"use client";

import {useEffect} from "react";

export default function DesktopRuntimeMode(){
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get("desktop")!=="1")return;
    const root=document.documentElement;
    root.classList.add("grind-desktop-runtime");
    const sync=()=>root.classList.toggle("grind-desktop-background",document.hidden||!document.hasFocus());
    sync();
    document.addEventListener("visibilitychange",sync);
    window.addEventListener("blur",sync);
    window.addEventListener("focus",sync);
    return()=>{
      document.removeEventListener("visibilitychange",sync);
      window.removeEventListener("blur",sync);
      window.removeEventListener("focus",sync);
      root.classList.remove("grind-desktop-runtime","grind-desktop-background");
    };
  },[]);
  return null;
}

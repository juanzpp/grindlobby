"use client";

import {useEffect} from "react";

declare global {
  interface Window {
    __GRIND_DESKTOP__?: boolean;
  }
}

export default function DesktopRuntimeMode(){
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const isDesktopRuntime=window.__GRIND_DESKTOP__===true||params.get("desktop")==="1";
    if(!isDesktopRuntime)return;

    const root=document.documentElement;
    root.classList.add("grind-desktop-runtime");
    root.dataset.grindDesktop="1";

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
      delete root.dataset.grindDesktop;
    };
  },[]);
  return null;
}

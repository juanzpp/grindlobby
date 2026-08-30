import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";

export function GsapRouteMotion(){
  const location=useLocation();

  useEffect(()=>{
    if(typeof window==="undefined"||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    let cancelled=false;
    let cleanup=()=>{};

    const frame=window.requestAnimationFrame(()=>{
      void import("gsap").then(({gsap})=>{
        if(cancelled)return;
        const panels=Array.from(document.querySelectorAll<HTMLElement>("main .panel, main section.panel"));
        const navItems=Array.from(document.querySelectorAll<HTMLElement>("aside nav a"));
        const ctas=Array.from(document.querySelectorAll<HTMLElement>(".btn-primary, .btn-ghost"));
        const targets=[...new Set(panels)];

        const ctx=gsap.context(()=>{
          if(targets.length){
            gsap.fromTo(targets,{opacity:0,y:14,scale:.992},{opacity:1,y:0,scale:1,duration:.55,stagger:.045,ease:"power3.out",clearProps:"transform"});
          }
          if(navItems.length){
            gsap.fromTo(navItems,{opacity:0,x:-10},{opacity:1,x:0,duration:.4,stagger:.03,ease:"power2.out"});
          }
        });

        const enter=(event:Event)=>gsap.to(event.currentTarget,{y:-2,scale:1.012,duration:.18,ease:"power2.out",overwrite:true});
        const leave=(event:Event)=>gsap.to(event.currentTarget,{y:0,scale:1,duration:.2,ease:"power2.out",overwrite:true});
        ctas.forEach(el=>{el.addEventListener("pointerenter",enter);el.addEventListener("pointerleave",leave)});
        cleanup=()=>{ctas.forEach(el=>{el.removeEventListener("pointerenter",enter);el.removeEventListener("pointerleave",leave)});ctx.revert()};
      }).catch(()=>{});
    });

    return()=>{cancelled=true;window.cancelAnimationFrame(frame);cleanup()};
  },[location.pathname]);

  return null;
}

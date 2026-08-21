"use client";

import {createPortal} from "react-dom";
import {CalendarDays,Gamepad2,MessageSquare,UserPlus} from "lucide-react";
import {useEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from "react";
import {PROFILE_EFFECTS,PROFILE_FRAMES} from "@/lib/profile-cosmetics";

export type HoverPlayerData={
  id:string;
  name:string;
  username:string;
  avatar?:string|null;
  status?:string;
  statusLabel?:string;
  level:number;
  rankName:string;
  points:number;
  winRate:number|null;
  matches:number;
  streak:number|null;
  favoriteGame:string;
  memberSince:string|null;
  banner?:string|null;
  frame?:string|null;
  effect?:string|null;
  badge?:string|null;
  cardStyle?:string|null;
};

type Props={
  player:HoverPlayerData;
  children:ReactNode;
  onAdd?:()=>void;
  onCall?:()=>void;
  disabled?:boolean;
};

type Position={left:number;top:number;side:"above"|"below"};

const tierColors=[
  {from:40,accent:"#d946ef",accent2:"#22d3ee"},
  {from:35,accent:"#fbbf24",accent2:"#fde68a"},
  {from:30,accent:"#ef4444",accent2:"#fb7185"},
  {from:25,accent:"#a855f7",accent2:"#d8b4fe"},
  {from:20,accent:"#10b981",accent2:"#6ee7b7"},
  {from:15,accent:"#3b82f6",accent2:"#93c5fd"},
  {from:10,accent:"#cbd5e1",accent2:"#f8fafc"},
  {from:5,accent:"#b45309",accent2:"#f59e0b"},
  {from:0,accent:"#8b5cf6",accent2:"#c4b5fd"},
];

function initials(value:string){return value.trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()||"GL"}
function memberYear(value:string|null){if(!value)return "—";const date=new Date(value);return Number.isFinite(date.getTime())?String(date.getFullYear()):"—"}

function Avatar({player}:{player:HoverPlayerData}){
  const frame=PROFILE_FRAMES.find(item=>item.id===(player.frame||"prism"))??PROFILE_FRAMES[0];
  const effect=PROFILE_EFFECTS.find(item=>item.id===(player.effect||"none"))??PROFILE_EFFECTS[0];
  return <span
    className={`grind-hover-avatar profile-avatar-shell profile-effect-${effect.variant??"none"}`}
    aria-hidden="true"
    style={{"--frame-ring":frame.ring,"--frame-glow":frame.glow,"--effect-glow":effect.glow} as CSSProperties}
  >
    <span className="profile-avatar-frame"/>
    <span className="profile-avatar-core">
      {player.avatar?<img src={player.avatar} alt="" className="grind-hover-avatar-image" referrerPolicy="no-referrer"/>:<span>{initials(player.name).slice(0,1)}</span>}
    </span>
    <span className="profile-avatar-spark profile-avatar-spark-a"/><span className="profile-avatar-spark profile-avatar-spark-b"/>
  </span>;
}

function HoverCard({player,onAdd,onCall,position,onEnter,onLeave}:{player:HoverPlayerData;onAdd?:()=>void;onCall?:()=>void;position:Position;onEnter:()=>void;onLeave:()=>void}){
  const palette=useMemo(()=>tierColors.find(item=>player.level>=item.from)??tierColors[tierColors.length-1],[player.level]);
  return <div
    className={`grind-hover-card grind-hover-card-${position.side}`}
    style={{left:position.left,top:position.top,"--hover-accent":palette.accent,"--hover-accent-2":palette.accent2} as CSSProperties}
    onMouseEnter={onEnter}
    onMouseLeave={onLeave}
    role="dialog"
    aria-label={`Perfil de ${player.name}`}
  >
    <span className="grind-hover-bloom"/>
    <span className="grind-hover-sheen"/>
    <div className="grind-hover-head">
      <Avatar player={player}/>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[17px] font-bold text-white">{player.name}{player.badge&&player.badge!=="none"?<span className="ml-1.5 align-middle text-[9px] font-bold uppercase text-amber-300">{player.badge}</span>:null}</p>
        <p className="truncate text-[11px] text-zinc-400">@{player.username}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-300"><span className={`h-2 w-2 rounded-full ${player.status==="online"?"bg-emerald-400":"bg-zinc-500"}`} style={player.status==="online"?{boxShadow:"0 0 12px #34d399"}:undefined}/>{player.statusLabel|| (player.status==="online"?"Online":"Offline")}</p>
      </div>
    </div>

    <div className="grind-hover-rank" style={{background:`linear-gradient(90deg,${palette.accent},${palette.accent2})`}}>{player.rankName.toUpperCase()} • LEVEL {player.level}</div>

    <div className="grind-hover-stats">
      <div><span>WINRATE</span><b>{player.winRate==null?"—":`${player.winRate}%`}</b></div>
      <div><span>PARTIDAS</span><b>{player.matches.toLocaleString("pt-BR")}</b></div>
      <div><span>SEQUÊNCIA</span><b>{player.streak==null?"—":player.streak}</b></div>
    </div>

    <div className="grind-hover-meta">
      <span><Gamepad2 size={12}/>{player.favoriteGame||"Sem jogo principal"}</span>
      <span><CalendarDays size={12}/>desde {memberYear(player.memberSince)}</span>
    </div>

    <div className="grind-hover-actions">
      <button type="button" onClick={(event)=>{event.stopPropagation();onAdd?.()}} disabled={!onAdd} className="grind-hover-secondary"><UserPlus size={14}/>Adicionar</button>
      <button type="button" onClick={(event)=>{event.stopPropagation();onCall?.()}} disabled={!onCall} className="grind-hover-primary"><MessageSquare size={14}/>Chamar</button>
    </div>
  </div>;
}

export function ProfileHoverTrigger({player,children,onAdd,onCall,disabled=false}:Props){
  const triggerRef=useRef<HTMLDivElement|null>(null);
  const closeTimer=useRef<number|null>(null);
  const [open,setOpen]=useState(false);
  const [position,setPosition]=useState<Position>({left:16,top:16,side:"below"});

  const cancelClose=()=>{if(closeTimer.current!=null){window.clearTimeout(closeTimer.current);closeTimer.current=null}};
  const scheduleClose=()=>{cancelClose();closeTimer.current=window.setTimeout(()=>setOpen(false),130)};
  const calculate=()=>{
    const node=triggerRef.current;if(!node)return;
    const rect=node.getBoundingClientRect();
    const cardWidth=268,cardHeight=286,gap=12,pad=12;
    let left=Math.max(pad,Math.min(window.innerWidth-cardWidth-pad,rect.left+rect.width/2-cardWidth/2));
    const spaceBelow=window.innerHeight-rect.bottom;
    const side:Position["side"]=spaceBelow>=cardHeight+gap||rect.top<cardHeight+gap?"below":"above";
    const top=side==="below"?Math.min(window.innerHeight-cardHeight-pad,rect.bottom+gap):Math.max(pad,rect.top-cardHeight-gap);
    setPosition({left,top,side});
  };
  const show=()=>{if(disabled)return;cancelClose();calculate();setOpen(true)};

  useEffect(()=>{
    if(!open)return;
    const onViewport=()=>calculate();
    const onPointer=(event:PointerEvent)=>{const target=event.target as Node|null;if(target&&triggerRef.current?.contains(target))return;if(target instanceof Element&&target.closest(".grind-hover-card"))return;setOpen(false)};
    window.addEventListener("resize",onViewport);
    window.addEventListener("scroll",onViewport,true);
    document.addEventListener("pointerdown",onPointer);
    return()=>{window.removeEventListener("resize",onViewport);window.removeEventListener("scroll",onViewport,true);document.removeEventListener("pointerdown",onPointer)};
  },[open]);

  useEffect(()=>()=>cancelClose(),[]);

  return <>
    <div ref={triggerRef} className="grind-profile-hover-trigger" onMouseEnter={show} onMouseLeave={scheduleClose} onFocus={show} onBlur={scheduleClose} onClick={(event)=>{if(window.matchMedia("(hover: none)").matches){event.stopPropagation();open?setOpen(false):show()}}} tabIndex={0}>
      {children}
    </div>
    {open&&typeof document!=="undefined"?createPortal(<HoverCard player={player} onAdd={onAdd} onCall={onCall} position={position} onEnter={()=>{cancelClose();setOpen(true)}} onLeave={scheduleClose}/>,document.body):null}
  </>;
}

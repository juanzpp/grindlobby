"use client";

import {useState} from "react";
import {Box,Check,Coins,Grid3X3,Image as ImageIcon,Palette,Shield,Sparkles,Star,Square,WandSparkles} from "lucide-react";
import type {LucideIcon} from "lucide-react";
import {ProfileAvatar} from "@/components/dashboard/LovableWidgets";

type StoreTab={id:string;label:string;icon:LucideIcon};
type StoreItem={id:string;name:string;kind:string;description:string;preview:string;price:number;rarity:string};
type Bundle={id:string;name:string;accent:string;description:string;items:string[];preview:string};

const tabs:StoreTab[]=[
  {id:"bundles",label:"Bundles",icon:Box},
  {id:"frames",label:"Molduras",icon:Grid3X3},
  {id:"banners",label:"Banners",icon:Square},
  {id:"wallpapers",label:"Papéis de parede",icon:ImageIcon},
  {id:"effects",label:"Efeitos",icon:WandSparkles},
  {id:"pro",label:"Pro",icon:Star},
];

const bundles:Bundle[]=[
  {id:"cyber",name:"Cyber Set",accent:"cyan",description:"Tecnologia fria para quem joga no limite.",items:["Moldura Cyber","Banner Cyber","Papel de parede Cyber","Badge Cyber","Cor do chat Cyber","Efeito de lobby Cyber"],preview:"cyber"},
  {id:"elite",name:"Elite Set",accent:"gold",description:"Ouro escuro e presença competitiva.",items:["Moldura Elite","Banner Elite","Papel de parede Elite","Badge Elite","Cor do chat Elite","Efeito de lobby Elite"],preview:"elite"},
  {id:"competitive",name:"Competitive Set",accent:"violet",description:"A assinatura visual de quem veio para vencer.",items:["Moldura Competitivo","Banner Competitivo","Papel de parede Competitivo","Badge de perfil Competitivo","Cor do chat Competitivo","Efeito de lobby Competitivo"],preview:"competitive"},
];

const catalog:Record<string,StoreItem[]>={
  frames:[
    {id:"frame-competitive",name:"Moldura Competitivo",kind:"Moldura",description:"Anel violeta com brilho de arena.",preview:"competitive",price:0,rarity:"Épico"},
    {id:"frame-cyber",name:"Neon Circuit",kind:"Moldura",description:"Circuito elétrico em volta do avatar.",preview:"cyber",price:480,rarity:"Raro"},
    {id:"frame-elite",name:"Elite Crown",kind:"Moldura",description:"Coroa dourada com aura de campeão.",preview:"elite",price:900,rarity:"Lendário"},
  ],
  banners:[
    {id:"banner-competitive",name:"Banner Competitivo",kind:"Banner",description:"Painel violeta para o seu perfil.",preview:"competitive",price:0,rarity:"Épico"},
    {id:"banner-void",name:"Void Rift",kind:"Banner",description:"Ruptura neon sobre fundo obsidiana.",preview:"void",price:350,rarity:"Raro"},
    {id:"banner-prism",name:"Prism Shift",kind:"Banner",description:"Luz prismática em movimento lento.",preview:"prism",price:700,rarity:"Lendário"},
  ],
  wallpapers:[
    {id:"wallpaper-competitive",name:"Papel de parede Competitivo",kind:"Papel de parede",description:"Fumaça violeta e linhas de arena.",preview:"competitive",price:0,rarity:"Épico"},
    {id:"wallpaper-nebula",name:"Nebula Violet",kind:"Papel de parede",description:"Nebulosa roxa com brilho profundo.",preview:"nebula",price:600,rarity:"Lendário"},
    {id:"wallpaper-grid",name:"Cyber Grid",kind:"Papel de parede",description:"Grade digital para uma identidade técnica.",preview:"cyber",price:420,rarity:"Raro"},
  ],
  effects:[
    {id:"effect-competitive",name:"Efeito de lobby Competitivo",kind:"Efeito",description:"Partículas discretas no lobby.",preview:"competitive",price:0,rarity:"Épico"},
    {id:"effect-ghost",name:"Ghost Trail",kind:"Efeito",description:"Rastro violeta ao entrar na sala.",preview:"void",price:800,rarity:"Lendário"},
    {id:"effect-prism",name:"Prism Pulse",kind:"Efeito",description:"Pulso cromático de baixa intensidade.",preview:"prism",price:550,rarity:"Raro"},
  ],
  pro:[],
};

function Smoke(){return <div className="store-smoke" aria-hidden="true"><i/><i/><i/><i/></div>}
function BundlePreview({variant,compact=false}:{variant:string;compact?:boolean}){return <div className={`store-bundle-art store-bundle-art-${variant} ${compact?"is-compact":""}`}><Smoke/><div className="store-crate"><span className="store-crate-lock">V</span><span className="store-crate-line"/></div><span className="store-crate-shadow"/></div>}
function ProductPreview({item,display}:{item:StoreItem;display:string}){return <div className={`store-product-preview store-preview-${item.preview}`}><span className="store-preview-glow"/>{item.kind==="Moldura"?<ProfileAvatar name={display} size={58}/>:item.kind==="Banner"?<b>{display}</b>:item.kind==="Papel de parede"?<span className="store-preview-lines"/>:<WandSparkles size={32}/>}</div>}

export default function StoreShowcase({display,isAdmin=false}:{display:string;isAdmin?:boolean}){
  const [tab,setTab]=useState("bundles");
  const [selected,setSelected]=useState("competitive");
  const [owned,setOwned]=useState<string[]>(isAdmin?bundles.flatMap(bundle=>bundle.items):[]);
  const selectedBundle=bundles.find(bundle=>bundle.id===selected)??bundles[0];
  const items=catalog[tab]??[];
  function release(id:string){setOwned(value=>value.includes(id)?value:value.concat(id))}
  return <section className="store-showcase">
    <header className="store-heading"><div><h1>Loja de Cosméticos</h1><p>Personalize seu perfil e destaque-se no GrindLobby.</p></div><div className="store-credit"><Coins size={16}/><span>1.200</span></div></header>
    <nav className="store-tabs" aria-label="Categorias da loja">{tabs.map(({id,label,icon:Icon})=><button key={id} onClick={()=>setTab(id)} className={tab===id?"is-active":""}><Icon size={15}/>{label}</button>)}</nav>
    {tab==="bundles"?<>
      <div className="store-layout"><div className="store-main">
        <section className="store-hero"><div className="store-hero-copy"><span className="store-eyebrow">Coleções exclusivas</span><h2>Coleções exclusivas para representar seu estilo.</h2><p>Todos os itens disponíveis para admins.</p><div className="store-hero-tags"><span><Shield size={13}/>6 itens inclusos</span><span><Sparkles size={13}/>Efeitos premium</span></div></div><BundlePreview variant="competitive"/></section>
        <div className="store-section-label"><CrownIcon/><span>BUNDLES EM DESTAQUE</span></div>
        <div className="store-bundle-grid">{bundles.map(bundle=><button key={bundle.id} onClick={()=>setSelected(bundle.id)} className={`store-bundle-card ${selected===bundle.id?"is-selected":""}`}><BundlePreview variant={bundle.preview} compact/><strong>{bundle.name}</strong><small>6 itens inclusos</small><ul>{bundle.items.map(item=><li key={item}><Check size={12}/>{item.replace(` ${bundle.name.replace(" Set","")}`,"")}</li>)}</ul><span className="store-release"><Check size={12}/>Liberado</span></button>)}</div>
      </div><aside className="store-inspector"><div className="store-inspector-label">PRÉ-VISUALIZAÇÃO DO BUNDLE</div><h2>{selectedBundle.name}</h2><span className="store-status"><Check size={12}/>Liberado</span><BundlePreview variant={selectedBundle.preview}/><div className="store-inspector-profile"><ProfileAvatar name={display} size={48}/><div><strong>{display}</strong><small>@{display.toLowerCase().replace(/\s+/g,"_")} <span>ADMIN</span></small><em>● Online no GrindLobby</em></div></div><div className="store-inspector-icons">{[Grid3X3,Square,ImageIcon,Shield,Palette,WandSparkles].map((Icon,index)=><span key={index}><Icon size={16}/></span>)}</div><h3>ITENS INCLUSOS</h3><ul className="store-included">{selectedBundle.items.map(item=><li key={item}><span><Check size={14}/></span><div><strong>{item}</strong><small>{item.split(" ").slice(-1)[0]}</small></div><em>Liberado</em></li>)}</ul><button className="store-equip-button" onClick={()=>release(selectedBundle.id)}>Equipar bundle</button><p className="store-footnote">Todos os itens serão aplicados ao seu perfil.</p></aside></div>
      </>:<div className="store-catalog"><div className="store-section-label"><CrownIcon/><span>{tabs.find(item=>item.id===tab)?.label.toUpperCase()}</span></div><div className="store-item-grid">{items.map(item=>{const released=isAdmin||owned.includes(item.id);return <article key={item.id} className="store-item-card"><ProductPreview item={item} display={display}/><div className="store-item-copy"><span className="store-rarity">{item.rarity}</span><h2>{item.name}</h2><p>{item.description}</p><footer>{released?<span className="store-release"><Check size={12}/>Liberado</span>:<><span className="store-price"><Coins size={14}/>{item.price}</span><button onClick={()=>release(item.id)}>Liberar</button></>}</footer></div></article>})}</div></div>}
  </section>;
}

function CrownIcon(){return <span className="store-crown"><Star size={13}/></span>}

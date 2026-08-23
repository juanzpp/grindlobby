"use client";

import {useState} from "react";
import {Loader2,RefreshCw,Sparkles,X} from "lucide-react";

type PreviewPayload={ok?:boolean;imageUrl?:string;image?:string;persisted?:boolean;error?:string;code?:string};

export default function ProfileAvatar3DPreviewDock(){
  const [open,setOpen]=useState(false);
  const [generating,setGenerating]=useState(false);
  const [preview,setPreview]=useState("");
  const [error,setError]=useState("");

  async function generate(){
    setGenerating(true);
    setError("");
    try{
      const response=await fetch("/api/profile/avatar-3d",{method:"POST",headers:{accept:"application/json"},cache:"no-store"});
      const payload=await response.json().catch(()=>({})) as PreviewPayload;
      if(!response.ok)throw new Error(payload.error||"Não foi possível gerar a prévia 3D.");
      const image=payload.imageUrl||payload.image||"";
      if(!image)throw new Error("A geração terminou sem uma imagem válida.");
      setPreview(image);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Não foi possível gerar a prévia 3D.");
    }finally{
      setGenerating(false);
    }
  }

  return <div className={`profile-ai-dock ${open?"is-open":""}`}>
    {!open?<button type="button" className="profile-ai-trigger" onClick={()=>setOpen(true)}><span className="profile-ai-trigger-icon"><Sparkles size={17}/></span><span><b>Personagem 3D</b><small>Prévia com IA</small></span></button>:null}
    {open?<section className="profile-ai-panel" aria-label="Prévia de personagem 3D">
      <header><div><span className="profile-ai-kicker">GRIND CHARACTER LAB</span><h2>Sua face em um personagem 3D</h2></div><button type="button" onClick={()=>setOpen(false)} aria-label="Fechar prévia"><X size={17}/></button></header>
      <div className={`profile-ai-stage ${preview?"has-preview":""}`}>
        {preview?<img src={preview} alt="Prévia temporária do personagem 3D" referrerPolicy="no-referrer"/>:<div className="profile-ai-placeholder"><span className="profile-ai-silhouette"/><div><Sparkles size={20}/><p>A prévia usa sua foto de perfil atual como referência facial.</p></div></div>}
        {generating?<div className="profile-ai-generating"><Loader2 className="animate-spin" size={22}/><span>Construindo personagem…</span></div>:null}
      </div>
      {error?<p className="profile-ai-error" role="alert">{error}</p>:null}
      <p className="profile-ai-note">A imagem é apenas uma amostra visual do perfil e não é salva automaticamente pelo GrindLobby.</p>
      <button type="button" className="profile-ai-generate" disabled={generating} onClick={()=>void generate()}>{generating?<Loader2 className="animate-spin" size={16}/>:preview?<RefreshCw size={16}/>:<Sparkles size={16}/>}<span>{preview?"Gerar outra prévia":"Gerar prévia 3D"}</span></button>
    </section>:null}
  </div>;
}

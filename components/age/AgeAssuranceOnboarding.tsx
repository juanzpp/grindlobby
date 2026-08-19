"use client";

import {useState} from "react";
import {ShieldCheck,Users,Loader2,ArrowRight,RefreshCcw} from "lucide-react";
import type {AgeBand,AgeAssuranceSnapshot,AgeCapabilities} from "@/lib/age-assurance-types";
import {AGE_BAND_LABELS,AGE_BAND_OPTIONS} from "@/lib/age-band";

type AgeResponse={assurance:AgeAssuranceSnapshot;capabilities:AgeCapabilities};

function assuranceCopy(assurance:AgeAssuranceSnapshot,capabilities:AgeCapabilities){
  if(capabilities.isVerified)return {
    label:"Age assurance concluída",
    text:"A faixa foi confirmada por um mecanismo de age assurance confiável e apenas o resultado mínimo foi mantido.",
  };
  if(assurance.status==="review_requested")return {
    label:"Revisão solicitada",
    text:"A faixa atual está contestada e aguardando revisão. Nenhuma evidência sensível foi solicitada ou armazenada.",
  };
  if(capabilities.guardianRequired)return {
    label:"Pendente — responsável necessário",
    text:"A faixa veio do fallback de onboarding e não está verificada. O fluxo de responsável permanece necessário para lobby, voz e tela.",
  };
  return {
    label:"Pendente — não verificada",
    text:"A faixa veio do fallback de onboarding. Ela personaliza proteções temporariamente, mas não comprova idade nem libera compras.",
  };
}

export function AgeAssuranceStatus({
  assurance,
  capabilities,
  onChange,
}:{
  assurance:AgeAssuranceSnapshot;
  capabilities:AgeCapabilities;
  onChange:(result:AgeResponse)=>void;
}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  if(!assurance.ageBand)return null;
  const copy=assuranceCopy(assurance,capabilities);

  async function requestReview(){
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/me/age-assurance",{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"request_review"}),
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Não foi possível solicitar a revisão.");
      onChange(body as AgeResponse);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Não foi possível solicitar a revisão.");
    }finally{setBusy(false)}
  }

  return <section className={`age-assurance-status age-experience-${capabilities.experience}`} aria-live="polite">
    <ShieldCheck size={18}/>
    <div>
      <small>FAIXA {AGE_BAND_LABELS[assurance.ageBand].toUpperCase()}</small>
      <strong>{copy.label}</strong>
      <p>{copy.text}{capabilities.reason?` ${capabilities.reason}`:""}</p>
      {error&&<span className="age-inline-error" role="alert">{error}</span>}
    </div>
    {capabilities.canRequestReview&&<button type="button" disabled={busy} onClick={requestReview}>
      {busy?<Loader2 size={14} className="animate-spin"/>:<RefreshCcw size={14}/>}
      Solicitar revisão da faixa
    </button>}
  </section>;
}

export default function AgeAssuranceOnboarding({onComplete}:{onComplete:(result:AgeResponse)=>void}){
  const [selected,setSelected]=useState<AgeBand|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function submit(){
    if(!selected)return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/me/age-assurance",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ageBand:selected}),
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Não foi possível continuar.");
      onComplete(body as AgeResponse);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Não foi possível continuar.");
    }finally{setBusy(false)}
  }

  return <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-title">
    <section className="age-card">
      <div className="age-symbol"><ShieldCheck size={28}/></div>
      <small>PROTEÇÃO POR DESIGN</small>
      <h1 id="age-title">Antes de entrar no Grind</h1>
      <p>Informe somente sua faixa etária para o fallback temporário. Não pedimos data de nascimento, documento, selfie, vídeo ou biometria. Esta seleção ficará pendente e não significa idade verificada.</p>
      <div className="age-options">
        {AGE_BAND_OPTIONS.map(choice=><button
          key={choice.value}
          type="button"
          className={selected===choice.value?"selected":""}
          aria-pressed={selected===choice.value}
          onClick={()=>setSelected(choice.value)}
        >
          <span>{choice.label}</span>
          <small>{choice.detail}</small>
        </button>)}
      </div>
      {selected&&(selected==="under_13"||selected==="13_15")&&<div className="age-guardian-note"><Users size={17}/><span>O acesso a lobby, voz e tela permanecerá bloqueado até a validação do responsável por um fluxo dedicado.</span></div>}
      {error&&<p className="age-error" role="alert">{error}</p>}
      <button className="primary age-continue" type="button" disabled={!selected||busy} onClick={submit}>
        {busy?<><Loader2 size={16} className="animate-spin"/>Iniciando aferição…</>:<>Continuar com privacidade<ArrowRight size={16}/></>}
      </button>
      <small className="age-privacy">Persistimos somente faixa, status, método e timestamps. Evidências sensíveis não fazem parte deste fluxo.</small>
    </section>
  </div>;
}

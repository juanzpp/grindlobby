"use client";

import {useState} from "react";
import {ShieldCheck,Users,Loader2,ArrowRight} from "lucide-react";
import type {AgeBand,AgeAssuranceSnapshot,AgeCapabilities} from "@/lib/age-assurance-types";

type AgeResponse={assurance:AgeAssuranceSnapshot;capabilities:AgeCapabilities};

const choices:Array<{value:AgeBand;label:string;detail:string}>=[
  {value:"under_13",label:"Menos de 13",detail:"A participação exige validação de responsável."},
  {value:"13_15",label:"13 a 15",detail:"A participação exige validação de responsável."},
  {value:"16_17",label:"16 ou 17",detail:"Recursos são liberados conforme a aferição aplicável."},
  {value:"18_plus",label:"18 ou mais",detail:"Compras ainda exigem aferição concluída."},
];

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
      <p>Informe somente sua faixa etária. Não pedimos data de nascimento nem documento nesta etapa. A opção inicia a aferição; ela não declara que sua idade foi verificada.</p>
      <div className="age-options">
        {choices.map(choice=><button
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
      <small className="age-privacy">O registro persiste apenas a faixa, o status e os timestamps necessários para auditoria.</small>
    </section>
  </div>;
}

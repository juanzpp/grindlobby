"use client";

import Image from "next/image";
import Link from "next/link";
import {useRouter,useSearchParams} from "next/navigation";
import {FormEvent,Suspense,useEffect,useRef,useState} from "react";
import {ArrowRight,Check,Eye,EyeOff,Info,Lock,Mail,MailCheck,UserPlus} from "lucide-react";
import GrindPortalLoading from "@/components/feedback/GrindPortalLoading";

type LoginPhase="idle"|"authenticating"|"transitioning"|"loading"|"completing";

const messages:Record<string,string>={
  confirmed:"E-mail confirmado. Sua conta está pronta.",
  password_updated:"Senha atualizada. Entre novamente.",
  confirmation_failed:"O link de confirmação é inválido ou expirou.",
};
const REMEMBER_PREFERENCE_KEY="grindlobby.rememberLogin";
const REMEMBERED_EMAIL_KEY="grindlobby.rememberedEmail";

function LoginForm(){
  const query=useSearchParams();
  const router=useRouter();
  const timers=useRef<number[]>([]);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [remember,setRemember]=useState(true);
  const [rememberEca,setRememberEca]=useState(true);
  const [phase,setPhase]=useState<LoginPhase>("idle");
  const [error,setError]=useState("");
  const [confirmationMessage,setConfirmationMessage]=useState("");
  const [resending,setResending]=useState(false);

  useEffect(()=>{
    const activeTimers=timers.current;
    const remembered=window.localStorage.getItem(REMEMBER_PREFERENCE_KEY)!=="false";
    setRemember(remembered);
    if(remembered)setEmail(window.localStorage.getItem(REMEMBERED_EMAIL_KEY)??"");
    return()=>activeTimers.forEach(timer=>window.clearTimeout(timer));
  },[]);

  function wait(ms:number){
    return new Promise<void>(resolve=>timers.current.push(window.setTimeout(resolve,ms)));
  }

  async function completeLogin(){
    const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase("transitioning");
    await wait(reducedMotion?30:1080);
    setPhase("loading");
    try{await fetch("/api/me",{cache:"no-store"})}catch{/* The destination validates the session again. */}
    setPhase("completing");
    await wait(reducedMotion?20:220);
    router.prefetch("/");
    router.replace("/");
    router.refresh();
  }

  function persistRememberPreference(){
    window.localStorage.setItem(REMEMBER_PREFERENCE_KEY,String(remember));
    if(remember)window.localStorage.setItem(REMEMBERED_EMAIL_KEY,email.trim());
    else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  }

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(phase!=="idle")return;
    setPhase("authenticating");
    setError("");
    try{
      const response=await fetch("/api/auth/login",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({identifier:email,password,remember}),
      });
      const data=await response.json();
      if(!response.ok){
        setPhase("idle");
        if(data.code==="email_unconfirmed")router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        else setError(data.error||"Não foi possível entrar.");
        return;
      }
      persistRememberPreference();
      window.sessionStorage.setItem("grindlobby.portalTransition","active");
      void completeLogin();
    }catch{
      setPhase("idle");
      setError("Sem conexão. Verifique sua rede e tente novamente.");
    }
  }

  async function resendConfirmation(){
    if(resending)return;
    if(!email.trim()){
      setError("Informe seu e-mail para reenviar a confirmação.");
      return;
    }
    setResending(true);setError("");setConfirmationMessage("");
    try{
      const response=await fetch("/api/auth/resend-confirmation",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({email:email.trim()}),
      });
      if(!response.ok)throw new Error();
      setConfirmationMessage("Se a conta estiver pendente, enviaremos uma nova mensagem.");
    }catch{
      setError("Não foi possível reenviar a confirmação agora.");
    }finally{setResending(false)}
  }

  const disabled=phase!=="idle";
  const entering=phase==="transitioning";
  const statusMessage=messages[query.get("status")||""];

  return <main className={`lovable-login ${entering?"is-entering":""}`}>
    <div className="lovable-login-grid">
      <section className="lovable-login-hero" aria-label="GrindLobby">
        <div className="lovable-login-art">
          <Image src="/lovable/login-portal.jpg" alt="Portal monumental da GrindLobby com feixe de luz violeta" width={1280} height={1280} priority sizes="(max-width: 900px) 100vw, 58vw"/>
          <span className="lovable-login-core" aria-hidden="true"/>
        </div>
        <h1 className="lovable-login-wordmark font-display">GRINDLOBBY</h1>
        <div className="lovable-login-divider" aria-hidden="true"><span/><b>◆</b><span/></div>
        <p className="lovable-login-tagline font-display">Seu caminho. Sua lenda.</p>
        <p className="lovable-login-copy">Compita. Evolua. Conquiste.<br/>O próximo nível começa aqui.</p>
      </section>

      <section className="lovable-login-card">
        <header className="lovable-login-card-head">
          <Image className="lovable-login-mini-logo" src="/brand/ascent-portal.png" alt="" width={128} height={128} sizes="96px"/>
          <h1 className="font-display">GRINDLOBBY</h1>
          <p>Entre. Foque. Supere.<br/>O topo espera por você.</p>
        </header>

        <form className="lovable-login-form" onSubmit={submit}>
          {statusMessage?<div className="lovable-feedback lovable-feedback-success" role="status">{statusMessage}</div>:null}
          <label className="lovable-field">
            <span>E-mail</span>
            <span className="lovable-input-wrap"><Mail size={16}/><input type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="seu@email.com" autoComplete="email" disabled={disabled} required/></span>
          </label>
          <label className="lovable-field">
            <span>Senha</span>
            <span className="lovable-input-wrap"><Lock size={16}/><input type={showPassword?"text":"password"} value={password} onChange={event=>setPassword(event.target.value)} placeholder="••••••••••••" autoComplete="current-password" disabled={disabled} required/><button type="button" className="lovable-password-toggle" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?"Ocultar senha":"Mostrar senha"} disabled={disabled}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></span>
          </label>

          <div className="lovable-login-options">
            <button type="button" className={`lovable-toggle ${remember?"is-checked":""}`} onClick={()=>setRemember(value=>!value)} disabled={disabled}><span>{remember?<Check size={12}/>:null}</span><b>Lembrar senha</b><Info size={14}/></button>
            <button type="button" className={`lovable-toggle ${rememberEca?"is-checked":""}`} onClick={()=>setRememberEca(value=>!value)} disabled={disabled}><span>{rememberEca?<Check size={12}/>:null}</span><b>Lembrar ECA digital</b><Info size={14}/></button>
          </div>

          {error?<div className="lovable-feedback lovable-feedback-error" role="alert">{error}</div>:null}
          {confirmationMessage?<div className="lovable-feedback lovable-feedback-success" role="status">{confirmationMessage}</div>:null}
          <button type="submit" className="lovable-login-submit lovable-btn-primary" disabled={disabled}>{phase==="authenticating"?"Autenticando sessão":"Entrar"}<ArrowRight size={20}/></button>
          <Link className="lovable-login-forgot" href="/forgot-password">Esqueci minha senha</Link>
        </form>

        <section className="lovable-confirmation">
          <span className="lovable-confirmation-icon"><MailCheck size={20}/></span>
          <div><strong>Confirmação por e-mail obrigatória</strong><p>Verifique sua caixa de entrada para ativar sua conta.</p></div>
          <button type="button" onClick={resendConfirmation} disabled={resending||disabled}>{resending?"Reenviando…":"Reenviar confirmação"}</button>
        </section>

        <footer className="lovable-login-footer">
          <p>Ainda não tem uma conta? <Link href="/register">Criar conta</Link><UserPlus size={16}/></p>
          <small><Lock size={13}/>Seus dados estão protegidos com segurança de nível competitivo.</small>
        </footer>
      </section>
    </div>

    {entering?<div className="lovable-login-flash" aria-hidden="true"/>:null}
    {phase==="loading"||phase==="completing"?<GrindPortalLoading variant="fullscreen" label="Sincronizando perfil" complete={phase==="completing"}/>:null}
  </main>;
}

export default function Login(){
  return <Suspense fallback={<GrindPortalLoading variant="fullscreen" label="Autenticando sessão"/>}><LoginForm/></Suspense>;
}

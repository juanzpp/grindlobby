'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import anime from 'animejs';
import {
  ArrowRight, Building2, Check, Eye, EyeOff, Fingerprint, Grid3X3,
  LockKeyhole, Mail, ScanFace, ShieldCheck, Signal, X, LoaderCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { requestPlatformPasskey, type PasskeyLoginOptionsJSON } from '@/lib/webauthn';

type Org = { name: string; slug: string };
type Health = { ok: boolean; version?: string };

type Modal = 'forgot' | 'pin' | 'company' | 'passkey' | 'reset' | null;

function BottleMark({ background = false }: { background?: boolean }) {
  return (
    <svg className={background ? 'login-bottle-mark background' : 'login-bottle-mark'} viewBox="0 0 90 104" aria-hidden="true">
      <path className="cap" d="M40 7h10v9H40zM38 16h14" />
      <path className="bottle" d="M38 16h14v13l6 8v51c0 5-3.5 8-8 8H40c-4.5 0-8-3-8-8V37l6-8V16Z" />
      <path className="glass" d="M35 43h20M35 68h20M40 48h10v14H40zM41 34v8" />
      <ellipse className="orbit" cx="45" cy="57" rx="34" ry="13" transform="rotate(-8 45 57)" />
      <circle className="orbit-node" cx="74" cy="50" r="2.6" />
    </svg>
  );
}

export default function LoginApp() {
  const router = useRouter();
  const search = useSearchParams();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [email, setEmail] = useState(() => typeof window === 'undefined' ? '' : localStorage.getItem('adega_login_email') || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [version, setVersion] = useState('1.1.0');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [org, setOrg] = useState(() => typeof window === 'undefined' ? 'principal' : localStorage.getItem('adega_org') || 'principal');
  const [pin, setPin] = useState('');
  const [resetToken, setResetToken] = useState(search.get('reset') || '');
  const [newPassword, setNewPassword] = useState('');
  const [passkeyInfo, setPasskeyInfo] = useState('');
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const selectedOrg = useMemo(() => orgs.find(o => o.slug === org), [orgs, org]);
  const previewingLoader = process.env.NODE_ENV === 'development' && search.get('preview-loader') === '1';
  const showPostLoginLoader = transitioning || previewingLoader;

  useEffect(() => {
    Promise.allSettled([
      api<Health>('/api/health'),
      api<Org[]>('/api/auth/organizations'),
      api<any>('/api/settings'),
    ]).then(([healthResult, orgResult, settingsResult]) => {
      if (healthResult.status === 'fulfilled') {
        setOnline(Boolean(healthResult.value.ok));
        if (healthResult.value.version) setVersion(healthResult.value.version);
      } else setOnline(false);
      if (orgResult.status === 'fulfilled') setOrgs(orgResult.value);
      if (settingsResult.status === 'fulfilled') setSupportWhatsapp(String(settingsResult.value.whatsapp || '').replace(/\D/g,''));
    });

    api('/api/auth/me').then(() => router.replace('/gestor')).catch(() => undefined);

    if (search.get('reset')) setModal('reset');

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      anime.timeline({ easing: 'easeOutExpo' })
        .add({ targets: '.login-live-card', opacity: [0, 1], translateY: [18, 0], scale: [.985, 1], duration: 850 })
        .add({ targets: '.login-live-card .login-animate', opacity: [0, 1], translateY: [10, 0], delay: anime.stagger(35), duration: 460 }, '-=610');
      anime({ targets: '.login-corner-light', opacity: [.35, 1], scale: [.92, 1.08], direction: 'alternate', loop: true, duration: 1800, easing: 'easeInOutSine' });
      anime({ targets: '.login-energy-line.one', translateX: [-40, 32], translateY: [7, -5], opacity: [.16, .5], direction: 'alternate', loop: true, duration: 4800, easing: 'easeInOutSine' });
      anime({ targets: '.login-energy-line.two', translateX: [28, -34], opacity: [.12, .36], direction: 'alternate', loop: true, duration: 5600, easing: 'easeInOutSine' });
    }
  }, [router, search]);

  useEffect(() => {
    if (!showPostLoginLoader) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const progress = { value: 0 };
    const duration = reduced ? 700 : 3200;
    const progressAnimation = anime({
      targets: progress,
      value: 100,
      round: 1,
      duration,
      easing: reduced ? 'linear' : 'easeInOutQuart',
      update: () => setLoadProgress(progress.value),
    });
    const sceneAnimation = reduced ? null : anime.timeline({ loop: false })
      .add({ targets: '.post-login-content', opacity: [0, 1], translateY: [18, 0], duration: 650, easing: 'easeOutExpo' })
      .add({ targets: '.post-login-bottle', rotate: [-4, 1.5], translateY: [-4, 3], duration: 1250, direction: 'alternate', loop: 2, easing: 'easeInOutSine' }, 150)
      .add({ targets: '.post-login-bottle-liquid', translateX: [-12, 14], translateY: [3, -4], skewX: [-7, 8], duration: 760, direction: 'alternate', loop: 4, easing: 'easeInOutSine' }, 180)
      .add({ targets: '.post-login-loader', opacity: [1, 0], duration: 420, easing: 'easeInQuad' }, duration - 220);
    const destinationTimer = transitioning ? window.setTimeout(() => router.replace('/gestor'), duration + 80) : null;
    return () => {
      progressAnimation.pause();
      sceneAnimation?.pause();
      if (destinationTimer) window.clearTimeout(destinationTimer);
    };
  }, [showPostLoginLoader, transitioning, router]);

  function clearFeedback() { setError(''); setMessage(''); }

  async function doLogin(e: FormEvent) {
    e.preventDefault(); clearFeedback(); setLoading(true);
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password, remember, organization_slug: org }) });
      if (remember) localStorage.setItem('adega_login_email', email); else localStorage.removeItem('adega_login_email');
      localStorage.setItem('adega_org', org);
      setMessage('Acesso autorizado. Abrindo o gestor…');
      setTransitioning(true);
    } catch (err: any) { setError(err.message || 'Não foi possível entrar'); }
    finally { setLoading(false); }
  }

  async function forgotPassword(e: FormEvent) {
    e.preventDefault(); clearFeedback(); setLoading(true);
    try {
      const result: any = await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email, organization_slug: org }) });
      if (result.development_reset_token) {
        setResetToken(result.development_reset_token);
        setModal('reset');
        setMessage('Ambiente de desenvolvimento: token de recuperação gerado com segurança.');
      } else {
        setModal(null); setMessage(result.message || 'Verifique seu e-mail para continuar.');
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault(); clearFeedback(); setLoading(true);
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, password: newPassword }) });
      setNewPassword(''); setModal(null); setMessage('Senha atualizada. Você já pode entrar.');
      router.replace('/login');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function doPin(e: FormEvent) {
    e.preventDefault(); clearFeedback(); setLoading(true);
    try {
      await api('/api/auth/pin', { method: 'POST', body: JSON.stringify({ email, pin, remember, organization_slug: org }) });
      setPin(''); setModal(null); setTransitioning(true);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function checkPasskey(mode: 'bio' | 'face') {
    clearFeedback(); setPasskeyInfo(''); setModal('passkey');
    if (!email.trim()) {
      setPasskeyInfo('Digite o e-mail da conta antes de usar a biometria do dispositivo.');
      return;
    }
    if (!window.PublicKeyCredential) {
      setPasskeyInfo('Este navegador não oferece WebAuthn/passkeys. Use e-mail e senha ou PIN.');
      return;
    }
    setLoading(true);
    try {
      const platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!platform) {
        setPasskeyInfo('Este aparelho não disponibilizou um autenticador seguro de plataforma.');
        return;
      }
      setPasskeyInfo(mode === 'face' ? 'Confirme com Face ID / reconhecimento do dispositivo…' : 'Confirme com a biometria ou PIN seguro do dispositivo…');
      const options = await api<PasskeyLoginOptionsJSON>('/api/auth/passkey/login/options', {
        method: 'POST', body: JSON.stringify({ email, organization_slug: org }),
      });
      const assertion = await requestPlatformPasskey(options);
      await api('/api/auth/passkey/login/verify', {
        method: 'POST', body: JSON.stringify({ ...assertion, remember }),
      });
      if (remember) localStorage.setItem('adega_login_email', email); else localStorage.removeItem('adega_login_email');
      localStorage.setItem('adega_org', org);
      setPasskeyInfo('Identidade confirmada. Abrindo o gestor…');
      setTransitioning(true);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError' ? 'A autenticação foi cancelada ou expirou.' : (err?.message || 'Não foi possível autenticar com a passkey.');
      setPasskeyInfo(msg);
    } finally { setLoading(false); }
  }

  function chooseOrg(slug: string) {
    setOrg(slug); localStorage.setItem('adega_org', slug); setModal(null); clearFeedback();
  }

  return (
    <div ref={rootRef} className="login-screen">
      <div className="login-blueprint-bg" />
      <div className="login-ambient-light" aria-hidden="true">
        <span className="left-lamp" />
        <span className="wall-sign" />
        <span className="counter-glow" />
      </div>
      <div className="login-vignette" />
      <i className="login-energy-line one" /><i className="login-energy-line two" />

      <form className="login-live-card" onSubmit={doLogin} noValidate>
        <span className="login-corner-light top" /><span className="login-corner-light left" /><span className="login-corner-light right" /><span className="login-border-flow top"/><span className="login-border-flow right"/><span className="login-border-flow bottom"/><span className="login-border-flow left"/>
        <div className="login-brand login-animate"><BottleMark /><strong>ADEGA</strong><b>CRM</b><span>SUA ADEGA, SEMPRE POR PERTO.</span></div>

        <label className="login-field-label login-animate">E-mail</label>
        <div className="login-field login-animate"><Mail size={17}/><input type="email" autoComplete="username" inputMode="email" value={email} onInput={e=>setEmail(e.currentTarget.value)} placeholder="seu@email.com" aria-label="E-mail" /></div>
        <label className="login-field-label login-animate">Senha</label>
        <div className="login-field login-animate"><LockKeyhole size={18}/><input autoComplete="current-password" type={showPassword?'text':'password'} value={password} onInput={e=>setPassword(e.currentTarget.value)} placeholder="••••••••" aria-label="Senha"/><button type="button" className="eye-button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Ocultar senha':'Mostrar senha'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>

        <div className="login-options login-animate"><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span><Check size={12}/></span>Lembrar meu acesso</label><button type="button" onClick={()=>{clearFeedback();setModal('forgot')}}>Esqueceu sua senha?</button></div>

        <button className="login-enter login-animate" disabled={loading || !email || !password} type="submit"><span>{loading?'AUTENTICANDO':'ENTRAR'}</span>{loading?<LoaderCircle className="spin"/>:<ArrowRight/>}<i/></button>

        <div className="login-divider login-animate"><span/>ou continuar com<span/></div>
        <div className="login-alt-grid login-animate">
          <button type="button" onClick={()=>checkPasskey('bio')}><Fingerprint/><span>Biometria</span></button>
          <button type="button" onClick={()=>checkPasskey('face')}><ScanFace/><span>Reconhecimento<br/>facial</span></button>
          <button type="button" onClick={()=>{clearFeedback();setModal('pin')}}><Grid3X3/><span>PIN de acesso</span></button>
        </div>
        <button type="button" className="login-company login-animate" onClick={()=>{clearFeedback();setModal('company')}}><Building2/><span>{selectedOrg?.name ? `Empresa: ${selectedOrg.name}` : 'Entrar com outra empresa'}</span></button>

        <div className="login-secure login-animate"><ShieldCheck/><strong>Ambiente seguro</strong><span>Seus dados são protegidos e a sessão usa cookie HttpOnly.</span></div>
        {(error||message)&&<div className={`login-feedback ${error?'error':'success'}`} role="status">{error||message}</div>}
      </form>

      <div className="login-system-live"><i className={online===false?'bad':''}/><div><strong>{online===false?'Sistema indisponível':'Sistema online'}</strong><span>{online===false?'API não respondeu':'Todos os serviços operando'}</span></div><Signal className={online===false?'bad':''}/></div>
      <div className="login-footer-live"><span>versão {version}</span><i/><button onClick={()=>{if(supportWhatsapp) window.open(`https://wa.me/${supportWhatsapp}`,'_blank','noopener,noreferrer'); else setMessage('Configure o WhatsApp de suporte em Configurações.')}}>Suporte</button></div>

      {showPostLoginLoader&&<section className="post-login-loader" role="status" aria-live="polite" aria-label={`Preparando seu ambiente, ${loadProgress}%`}>
        <div className="post-login-scene" />
        <div className="post-login-veil" />
        <div className="post-login-content">
          <div className="post-login-pour" aria-hidden="true">
            <img className="post-login-bottle" src="/assets/whisky-loader-v1.png" alt="" />
            <i className="post-login-bottle-liquid" />
            <i className="post-login-drops"><b/><b/><b/></i>
          </div>
          <div className="post-login-track" aria-hidden="true"><i className={loadProgress > .5 ? 'is-flowing' : ''} style={{width:`${loadProgress}%`}}><b/><span/></i></div>
          <div className="post-login-copy"><span>Sincronizando seu ambiente de gestão…</span></div>
        </div>
      </section>}

      {modal&&<div className="login-modal-layer" role="dialog" aria-modal="true"><div className="login-modal-backdrop" onClick={()=>setModal(null)}/><section className="login-modal">
        <button className="modal-x" onClick={()=>setModal(null)}><X/></button>
        {modal==='forgot'&&<form onSubmit={forgotPassword}><Mail/><h3>Recuperar acesso</h3><p>Enviaremos um link de recuperação para o e-mail cadastrado.</p><label>E-mail<input value={email} onChange={e=>setEmail(e.target.value)} autoFocus/></label><button className="modal-gold" disabled={loading}>Enviar recuperação</button></form>}
        {modal==='pin'&&<form onSubmit={doPin}><Grid3X3/><h3>PIN de acesso</h3><p>Use o PIN configurado para esta conta.</p><label>E-mail<input value={email} onChange={e=>setEmail(e.target.value)}/></label><label>PIN<input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,8))} inputMode="numeric" autoFocus placeholder="••••••"/></label><button className="modal-gold" disabled={loading||pin.length<4}>Entrar com PIN</button></form>}
        {modal==='company'&&<div className="modal-content"><Building2/><h3>Selecionar empresa</h3><p>Escolha qual operação deseja acessar.</p><div className="company-list">{orgs.map(o=><button key={o.slug} className={o.slug===org?'active':''} onClick={()=>chooseOrg(o.slug)}><Building2/><span><b>{o.name}</b><small>{o.slug}</small></span>{o.slug===org&&<Check/>}</button>)}</div></div>}
        {modal==='passkey'&&<div className="modal-content"><Fingerprint/><h3>Biometria do dispositivo</h3><p>{passkeyInfo||'Aguardando o autenticador seguro do aparelho…'}</p><button className="modal-gold" onClick={()=>setModal(null)}>Entendi</button></div>}
        {modal==='reset'&&<form onSubmit={resetPassword}><LockKeyhole/><h3>Definir nova senha</h3><p>Mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo.</p><label>Nova senha<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoFocus/></label><button className="modal-gold" disabled={loading||newPassword.length<10}>Atualizar senha</button></form>}
      </section></div>}
    </div>
  );
}

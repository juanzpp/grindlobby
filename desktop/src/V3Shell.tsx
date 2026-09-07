import { ChevronRight, LockKeyhole, ShieldCheck, Trophy, UserRound, Users } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import V3App from './V3App'
import { animateLogin } from './motion'
import heroImage from '../../src/assets/login-portal.jpg'
import { currentSession, signIn, signUp, supabase } from './lib/supabase'
import { beginPasswordRecovery, beginSocialLogin, installOAuthDeepLinkListener, type SocialProvider } from './lib/oauth'

const socialProviders: Array<{ id: SocialProvider; label: string; icon: string; className: string }> = [
  { id: 'steam', label: 'Steam', icon: '/brands/steam.svg', className: 'steam' },
  { id: 'discord', label: 'Discord', icon: '/brands/discord.svg', className: 'discord' },
  { id: 'google', label: 'Google', icon: '/brands/google.svg', className: 'google' },
  { id: 'xbox', label: 'Xbox', icon: '/brands/xbox.svg', className: 'xbox' },
]

export default function V3Shell() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)
  const [authMessage, setAuthMessage] = useState('')
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    let mounted = true
    let unlisten = () => {}

    void currentSession().then((value) => {
      if (!mounted) return
      setSession(value)
      setBooting(false)
    })

    const { data } = supabase.auth.onAuthStateChange((event, value) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(value)
      setBooting(false)
    })

    void installOAuthDeepLinkListener(
      (message) => setAuthMessage(message),
      () => setRecovering(true),
    ).then((stop) => {
      if (!mounted) stop()
      else unlisten = stop
    })

    return () => {
      mounted = false
      unlisten()
      data.subscription.unsubscribe()
    }
  }, [])

  if (booting) {
    return (
      <main className="v3-splash v3-splash-clean">
        <strong>GRINDLOBBY</strong>
        <span>JOGUE. CONECTE. EVOLUA.</span>
      </main>
    )
  }

  if (session && recovering) return <PasswordReset onDone={() => setRecovering(false)} />
  if (session) return <V3App />
  return <CleanLogin externalMessage={authMessage} onExternalMessage={setAuthMessage} />
}

function PasswordReset({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    if (password.length < 8) {
      setMessage('A nova senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setMessage('As senhas não coincidem.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMessage('Senha atualizada com sucesso.')
      window.setTimeout(onDone, 500)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar sua senha.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="v3-login v3-login-clean" style={{ backgroundImage: `url(${heroImage})` }}>
      <div className="v3-login-shade" />
      <section className="v3-login-card v3-login-card-clean v3-password-reset-card">
        <h2>Nova senha</h2>
        <span className="v3-card-tagline">RECUPERAÇÃO DA CONTA GRINDLOBBY</span>
        <form onSubmit={submit}>
          <label><LockKeyhole /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nova senha" autoComplete="new-password" /></label>
          <label><LockKeyhole /><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Repita a nova senha" autoComplete="new-password" /></label>
          {message && <div className="v3-form-message">{message}</div>}
          <button className="v3-primary v3-login-submit" disabled={busy || password.length < 8 || confirm.length < 8}>{busy ? 'Salvando...' : 'Atualizar senha'} <ChevronRight /></button>
        </form>
      </section>
    </main>
  )
}

function CleanLogin({ externalMessage, onExternalMessage }: { externalMessage: string; onExternalMessage: (message: string) => void }) {
  const root = useRef<HTMLElement>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [identifier, setIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => animateLogin(root.current), [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    onExternalMessage('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(identifier, password, remember)
      } else {
        const created = await signUp(identifier, password, username)
        if (!created) {
          setMessage('Conta criada. Confirme o e-mail para entrar.')
          setMode('login')
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível autenticar.')
    } finally {
      setBusy(false)
    }
  }

  async function recoverPassword() {
    setMessage('')
    onExternalMessage('')
    setRecoveryBusy(true)
    try {
      await beginPasswordRecovery(identifier)
      setMessage('Enviamos um link de recuperação para o seu e-mail. Ao abrir o link, o GrindLobby voltará para esta tela para você definir a nova senha.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o e-mail de recuperação.')
    } finally {
      setRecoveryBusy(false)
    }
  }

  async function socialLogin(provider: SocialProvider) {
    setMessage('')
    onExternalMessage('')
    setSocialBusy(provider)
    try {
      await beginSocialLogin(provider)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Não foi possível entrar com ${provider}.`)
      setSocialBusy(null)
    }
  }

  return (
    <main ref={root} className="v3-login v3-login-clean" style={{ backgroundImage: `url(${heroImage})` }}>
      <div className="v3-login-shade" />

      <section className="v3-login-copy">
        <h1 data-login-copy>Mais que<br />jogos, uma<br />comunidade<br />que <em>joga junto.</em></h1>
        <p data-login-copy>Encontre teammates, suba de elo,<br />participe de comunidades e viva<br />o seu próximo capítulo no GrindLobby.</p>
        <div className="v3-login-benefits" data-login-copy>
          <span><Users /> Jogue com pessoas reais</span>
          <span><ShieldCheck /> Evolua no seu ritmo</span>
          <span><Users /> Comunidades ativas</span>
          <span><Trophy /> Seu progresso importa</span>
        </div>
        <div className="v3-login-mantra" data-login-copy>MESMOS JOGOS.<br />PESSOAS MELHORES.</div>
      </section>

      <section className="v3-login-card v3-login-card-clean" data-login-card>
        <h2>GrindLobby</h2>
        <span className="v3-card-tagline">JOGUE. CONECTE. EVOLUA.</span>

        <div className="v3-auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Entrar</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Criar conta</button>
        </div>

        <form onSubmit={submit}>
          {mode === 'signup' && <label><UserRound /><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Seu nick" autoComplete="username" /></label>}
          <label><span className="field-icon">✉</span><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={mode === 'login' ? 'Seu e-mail ou usuário' : 'Seu e-mail'} autoComplete="email" /></label>
          <label><LockKeyhole /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
          {mode === 'login' && <div className="v3-remember"><label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Lembrar senha</label><button type="button" disabled={recoveryBusy} onClick={() => void recoverPassword()}>{recoveryBusy ? 'Enviando...' : 'Esqueceu sua senha?'}</button></div>}
          {(message || externalMessage) && <div className="v3-form-message">{message || externalMessage}</div>}
          <button className="v3-primary v3-login-submit" disabled={busy || !identifier || password.length < 8}>{busy ? 'Conectando...' : mode === 'login' ? 'Entrar no Lobby' : 'Criar conta'} <ChevronRight /></button>
        </form>

        <div className="v3-login-divider"><span /> OU ENTRE COM <span /></div>
        <div className="v3-social-row v3-social-row-icons">
          {socialProviders.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={`v3-social-provider ${provider.className}`}
              aria-label={`Entrar com ${provider.label}`}
              title={`Entrar com ${provider.label}`}
              disabled={socialBusy !== null}
              onClick={() => void socialLogin(provider.id)}
            >
              <img src={provider.icon} alt="" aria-hidden="true" />
              <span>{socialBusy === provider.id ? '...' : provider.label}</span>
            </button>
          ))}
        </div>

        <small>Novo por aqui? <button onClick={() => setMode('signup')}>Criar uma conta</button></small>
      </section>

      <footer className="v3-login-footer"><span>DISCIPLINA HOJE. LENDAS AMANHÃ.</span><small>GrindLobby v0.3.0</small></footer>
    </main>
  )
}

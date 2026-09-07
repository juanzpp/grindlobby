import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Copy, Crown, LoaderCircle, QrCode, ShieldCheck, X } from 'lucide-react'
import { EDGE_FUNCTION_BASE, SUPABASE_PUBLISHABLE_KEY, supabase } from './lib/supabase'

type PixConfig = {
  configured: boolean
  paymentMethod: 'pix'
  amountCents: number | null
  durationDays: number | null
  liveMode: boolean | null
}

type PixCharge = {
  orderId: string
  status: string
  amountCents: number
  durationDays: number
  qrCode: string | null
  qrCodeBase64: string | null
  ticketUrl: string | null
  expiresAt: string
}

type ProfileTier = { account_tier: string | null; app_role: string | null }

const shellStyle: React.CSSProperties = {
  position: 'fixed',
  right: 92,
  top: 53,
  zIndex: 120,
}

const premiumButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  height: 34,
  padding: '0 13px',
  borderRadius: 10,
  border: '1px solid rgba(180,118,255,.42)',
  background: 'linear-gradient(135deg, rgba(105,45,230,.32), rgba(35,20,68,.9))',
  color: '#f4ecff',
  fontSize: 12,
  fontWeight: 700,
  boxShadow: '0 0 28px rgba(132,67,255,.18)',
  cursor: 'pointer',
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 500,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(2,2,10,.72)',
  backdropFilter: 'blur(12px)',
}

const modalStyle: React.CSSProperties = {
  width: 'min(430px, calc(100vw - 40px))',
  borderRadius: 20,
  border: '1px solid rgba(162,102,255,.32)',
  background: 'linear-gradient(155deg, rgba(20,16,39,.98), rgba(7,7,18,.99))',
  boxShadow: '0 30px 90px rgba(0,0,0,.62), 0 0 55px rgba(117,58,255,.16)',
  color: '#f7f3ff',
  padding: 22,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,.12)',
  background: 'rgba(255,255,255,.045)',
  color: '#fff',
  padding: '0 12px',
  outline: 'none',
  marginTop: 8,
}

function money(cents: number | null) {
  if (cents == null) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function sanitizeCpf(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

function formatCpf(value: string) {
  const digits = sanitizeCpf(value)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export default function BillingPortal() {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileTier | null>(null)
  const [config, setConfig] = useState<PixConfig | null>(null)
  const [open, setOpen] = useState(false)
  const [cpf, setCpf] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [charge, setCharge] = useState<PixCharge | null>(null)
  const requestKey = useRef(crypto.randomUUID())

  useEffect(() => {
    let active = true
    const sync = async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      setAccessToken(data.session?.access_token || null)
      if (!data.session?.user) {
        setProfile(null)
        setConfig(null)
        return
      }
      const { data: row } = await supabase
        .from('profiles')
        .select('account_tier,app_role')
        .eq('id', data.session.user.id)
        .maybeSingle()
      if (active) setProfile((row as ProfileTier | null) || null)
    }
    void sync()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token || null)
      if (!session) {
        setProfile(null)
        setConfig(null)
      } else {
        void sync()
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!accessToken) return
    let active = true
    void fetch(`${EDGE_FUNCTION_BASE}/grind-pix-checkout`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as PixConfig | { error?: string } | null
        if (!response.ok || !payload || !('configured' in payload)) throw new Error('Não foi possível verificar o Pix.')
        if (active) setConfig(payload)
      })
      .catch(() => {
        if (active) setConfig(null)
      })
    return () => { active = false }
  }, [accessToken])

  useEffect(() => {
    if (!charge || !accessToken || charge.status === 'approved') return
    const timer = window.setInterval(async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) return
      const { data } = await supabase.from('profiles').select('account_tier,app_role').eq('id', userId).maybeSingle()
      const tier = data as ProfileTier | null
      if (tier?.account_tier === 'pro' || tier?.app_role === 'admin') {
        setProfile(tier)
        setCharge((current) => current ? { ...current, status: 'approved' } : current)
        window.clearInterval(timer)
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [charge, accessToken])

  const pro = profile?.account_tier === 'pro' || profile?.app_role === 'admin'
  const visible = Boolean(accessToken && config?.configured && !pro)
  const label = useMemo(() => {
    if (!config?.amountCents) return 'Premium via Pix'
    return `Premium · ${money(config.amountCents)}`
  }, [config])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!accessToken || !config?.configured) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${EDGE_FUNCTION_BASE}/grind-pix-checkout`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ cpf: sanitizeCpf(cpf), requestKey: requestKey.current }),
      })
      const payload = (await response.json().catch(() => null)) as PixCharge | { error?: string } | null
      if (!response.ok || !payload || !('orderId' in payload)) {
        throw new Error(payload && 'error' in payload ? payload.error || 'Não foi possível criar o Pix.' : 'Não foi possível criar o Pix.')
      }
      setCharge(payload)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o Pix.')
    } finally {
      setBusy(false)
    }
  }

  async function copyCode() {
    if (!charge?.qrCode) return
    await navigator.clipboard.writeText(charge.qrCode)
  }

  function close() {
    if (charge?.status === 'approved') location.reload()
    setOpen(false)
    setError('')
    if (!charge || charge.status === 'approved') {
      setCharge(null)
      setCpf('')
      requestKey.current = crypto.randomUUID()
    }
  }

  if (!visible && !open) return null

  return (
    <>
      {visible && <div style={shellStyle}>
        <button type="button" style={premiumButtonStyle} onClick={() => setOpen(true)}>
          <Crown size={14} /> {label}
        </button>
      </div>}
      {open && <div style={backdropStyle} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
        <section style={modalStyle} role="dialog" aria-modal="true" aria-label="Grind Premium via Pix">
          <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 12, background: 'rgba(133,68,255,.18)', color: '#c89aff' }}><QrCode size={21} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, letterSpacing: '.14em', color: '#a991c9' }}>GRIND PREMIUM · PIX</div>
              <h2 style={{ margin: '4px 0 2px', fontSize: 20 }}>Liberar 1080p e Premium</h2>
              <p style={{ margin: 0, color: '#9f98b4', fontSize: 12 }}>{config?.durationDays || 30} dias · {money(config?.amountCents || null)}</p>
            </div>
            <button type="button" onClick={close} aria-label="Fechar" style={{ border: 0, background: 'transparent', color: '#aaa4ba', cursor: 'pointer' }}><X size={18} /></button>
          </header>

          {!charge ? <form onSubmit={submit} style={{ marginTop: 20 }}>
            <label style={{ display: 'block', color: '#cfc9dc', fontSize: 12 }}>
              CPF do pagador
              <input
                style={inputStyle}
                inputMode="numeric"
                autoComplete="off"
                value={formatCpf(cpf)}
                onChange={(event) => setCpf(sanitizeCpf(event.target.value))}
                placeholder="000.000.000-00"
              />
            </label>
            <p style={{ margin: '9px 0 15px', color: '#817a92', fontSize: 11, lineHeight: 1.45 }}>
              O CPF é enviado diretamente ao provedor para emitir o Pix e não é salvo no banco do GrindLobby.
            </p>
            {error && <div style={{ marginBottom: 12, padding: 10, borderRadius: 9, background: 'rgba(225,65,92,.1)', color: '#ff9aaa', fontSize: 12 }}>{error}</div>}
            <button
              type="submit"
              disabled={busy || sanitizeCpf(cpf).length !== 11}
              style={{ ...premiumButtonStyle, width: '100%', justifyContent: 'center', height: 44, opacity: busy || sanitizeCpf(cpf).length !== 11 ? .5 : 1 }}
            >
              {busy ? <LoaderCircle size={15} className="spin" /> : <QrCode size={15} />}
              {busy ? 'Gerando Pix...' : `Gerar Pix de ${money(config?.amountCents || null)}`}
            </button>
          </form> : <div style={{ marginTop: 20 }}>
            {charge.qrCodeBase64 && <div style={{ display: 'grid', placeItems: 'center', padding: 14, borderRadius: 14, background: '#fff' }}>
              <img src={`data:image/png;base64,${charge.qrCodeBase64}`} alt="QR Code Pix" style={{ width: 210, height: 210, objectFit: 'contain' }} />
            </div>}
            <div style={{ marginTop: 12, padding: 11, borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ fontSize: 11, color: '#91899f' }}>STATUS</div>
              <strong style={{ display: 'block', marginTop: 3, color: charge.status === 'approved' ? '#7cf4b5' : '#e5d9ff' }}>
                {charge.status === 'approved' ? 'Pagamento aprovado — Premium ativo' : 'Aguardando pagamento'}
              </strong>
            </div>
            {charge.qrCode && <button type="button" onClick={() => void copyCode()} style={{ ...premiumButtonStyle, width: '100%', justifyContent: 'center', marginTop: 10, height: 42 }}><Copy size={14} /> Copiar Pix copia e cola</button>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 13, color: '#858092', fontSize: 11 }}><ShieldCheck size={13} /> Liberação automática após a confirmação do provedor.</div>
          </div>}
        </section>
      </div>}
    </>
  )
}

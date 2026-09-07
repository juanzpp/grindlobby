import {
  Bell,
  ChevronRight,
  Copy,
  Crown,
  Gamepad2,
  Headphones,
  Home,
  LockKeyhole,
  LogOut,
  Maximize2,
  Mic,
  MicOff,
  Minus,
  MonitorUp,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import BillingPortal from './BillingPortal'
import { animateLogin, animateSurface } from './motion'
import heroImage from '../../src/assets/login-portal.jpg'
import rankEmblem from '../../src/assets/rank-emblem.png'
import storeBundles from '../../src/assets/store-bundles.jpg'
import storeEffects from '../../src/assets/store-effects.jpg'
import storeRank from '../../src/assets/store-rank.jpg'
import logoUrl from '../../public/grindlobby-logo.png'
import {
  acceptCommunityInvite,
  closeLobby,
  createCommunity,
  createCommunityInvite,
  createCommunityPost,
  createLobby,
  equipCosmetic,
  heartbeatProfile,
  joinLobby,
  loadCommunities,
  loadCommunityPosts,
  loadLeaderboard,
  loadLobbies,
  loadPreferences,
  loadProfile,
  savePreferences,
  updateProfile,
  type Community,
  type CommunityPost,
  type DesktopPreferences,
  type GrindProfile,
  type LeaderboardRow,
  type Lobby,
} from './lib/grind'
import { currentSession, signIn, signOut, signUp, supabase } from './lib/supabase'
import { voiceSession, type StreamPreset, type VoiceSnapshot } from './lib/voice'
import {
  listNativeCaptureSources,
  startNativeScreenShare,
  stopNativeScreenShare,
  type CaptureSourceKind,
  type NativeCaptureSource,
} from './lib/native-screen'

const nav = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'lobbies', label: 'Lobbies', icon: Gamepad2 },
  { id: 'communities', label: 'Comunidades', icon: Users },
  { id: 'ranking', label: 'Top Elos', icon: Trophy },
  { id: 'music', label: 'Música', icon: Music2 },
  { id: 'store', label: 'Loja', icon: ShoppingBag },
  { id: 'profile', label: 'Perfil', icon: UserRound },
  { id: 'settings', label: 'Configurações', icon: Settings },
] as const

type Section = (typeof nav)[number]['id']
type DataState = {
  profile: GrindProfile | null
  lobbies: Lobby[]
  leaderboard: LeaderboardRow[]
  communities: Community[]
  preferences: DesktopPreferences | null
}

const EMPTY_VOICE: VoiceSnapshot = {
  lobbyCode: null,
  connected: false,
  connecting: false,
  muted: false,
  deafened: false,
  sharing: false,
  rttMs: null,
  participants: [],
  localScreen: null,
  remoteScreens: {},
}

function isPro(profile: GrindProfile | null) {
  return profile?.account_tier === 'pro' || profile?.app_role === 'admin'
}

function initials(value?: string | null) {
  return (value || 'GL')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function winRate(row: { matches_played?: number | null; matches_won?: number | null }) {
  const total = Number(row.matches_played || 0)
  return total ? Math.round((Number(row.matches_won || 0) / total) * 100) : 0
}

async function windowAction(action: 'minimize' | 'maximize' | 'close') {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    if (action === 'minimize') await win.minimize()
    if (action === 'maximize') await win.toggleMaximize()
    if (action === 'close') await win.close()
  } catch {
    // The browser-only CI preview intentionally has no Tauri window runtime.
  }
}

function useVoice() {
  const [voice, setVoice] = useState<VoiceSnapshot>(EMPTY_VOICE)
  useEffect(() => voiceSession.subscribe(setVoice), [])
  return voice
}

export default function V3App() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let mounted = true
    void currentSession().then((value) => {
      if (!mounted) return
      setSession(value)
      setBooting(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      setSession(value)
      setBooting(false)
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (booting) return <Splash />
  if (!session) return <Login />
  return <Desktop session={session} />
}

function Splash() {
  return (
    <main className="v3-splash">
      <div className="v3-splash-orbit" data-motion="glow"><img src={logoUrl} alt="GrindLobby" /></div>
      <strong>GRINDLOBBY</strong>
      <span>JOGUE. CONECTE. EVOLUA.</span>
    </main>
  )
}

function Login() {
  const root = useRef<HTMLElement>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [identifier, setIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => animateLogin(root.current), [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
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

  return (
    <main ref={root} className="v3-login" style={{ backgroundImage: `url(${heroImage})` }}>
      <div className="v3-login-shade" />
      <header className="v3-login-brand" data-login-logo>
        <img src={logoUrl} alt="" />
        <div><strong>GrindLobby</strong><span>JOGUE. CONECTE. EVOLUA.</span></div>
      </header>

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

      <section className="v3-login-card" data-login-card>
        <div className="v3-card-logo" data-motion="glow"><img src={logoUrl} alt="" /></div>
        <h2>GrindLobby</h2>
        <span className="v3-card-tagline">JOGUE. CONECTE. EVOLUA.</span>
        <div className="v3-auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Entrar</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Criar conta</button>
        </div>
        <form onSubmit={submit}>
          {mode === 'signup' && <label><UserRound /><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Seu nick" /></label>}
          <label><span className="field-icon">✉</span><input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={mode === 'login' ? 'Seu e-mail ou usuário' : 'Seu e-mail'} /></label>
          <label><LockKeyhole /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" /></label>
          {mode === 'login' && <div className="v3-remember"><label><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Lembrar senha</label><button type="button">Esqueceu sua senha?</button></div>}
          {message && <div className="v3-form-message">{message}</div>}
          <button className="v3-primary v3-login-submit" disabled={busy || !identifier || password.length < 8}>{busy ? 'Conectando...' : mode === 'login' ? 'Entrar no Lobby' : 'Criar conta'} <ChevronRight /></button>
        </form>
        <div className="v3-login-divider"><span /> OU ENTRE COM <span /></div>
        <div className="v3-social-row"><button>STEAM</button><button>DISCORD</button><button>GOOGLE</button><button>XBOX</button></div>
        <small>Novo por aqui? <button onClick={() => setMode('signup')}>Criar uma conta</button></small>
      </section>

      <footer className="v3-login-footer"><span>DISCIPLINA HOJE. LENDAS AMANHÃ.</span><small>GrindLobby v0.3.0</small></footer>
    </main>
  )
}

function Desktop({ session }: { session: Session }) {
  const voice = useVoice()
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Section>('home')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null)
  const [data, setData] = useState<DataState>({ profile: null, lobbies: [], leaderboard: [], communities: [], preferences: null })

  const refresh = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled([loadProfile(), loadLobbies(), loadLeaderboard(30), loadCommunities(), loadPreferences()])
    const [profile, lobbies, leaderboard, communities, preferences] = results
    setData((current) => ({
      profile: profile.status === 'fulfilled' ? profile.value : current.profile,
      lobbies: lobbies.status === 'fulfilled' ? lobbies.value : current.lobbies,
      leaderboard: leaderboard.status === 'fulfilled' ? leaderboard.value : current.leaderboard,
      communities: communities.status === 'fulfilled' ? communities.value : current.communities,
      preferences: preferences.status === 'fulfilled' ? preferences.value : current.preferences,
    }))
    const failure = results.find((item) => item.status === 'rejected') as PromiseRejectedResult | undefined
    if (failure) setNotice(failure.reason instanceof Error ? failure.reason.message : 'Alguns dados não carregaram.')
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    void heartbeatProfile(true)
    const timer = window.setInterval(() => void heartbeatProfile(true), 60_000)
    return () => {
      window.clearInterval(timer)
      void heartbeatProfile(false)
    }
  }, [refresh])

  useEffect(() => animateSurface(surfaceRef.current), [active])

  useEffect(() => {
    if (!voice.lobbyCode) return
    const found = data.lobbies.find((item) => item.routeCode === voice.lobbyCode)
    if (found) setActiveLobby(found)
  }, [voice.lobbyCode, data.lobbies])

  async function enterLobby(lobby: Lobby) {
    try {
      await joinLobby(lobby)
      setActiveLobby(lobby)
      await voiceSession.connect(lobby.routeCode, data.preferences?.desktop_settings)
      setNotice(`Conectado à call de ${lobby.name}.`)
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível entrar na call.')
    }
  }

  async function logout() {
    await stopNativeScreenShare().catch(() => {})
    await voiceSession.disconnect()
    await heartbeatProfile(false)
    await signOut()
  }

  const profileName = data.profile?.display_name || data.profile?.username || session.user.email?.split('@')[0] || 'Jogador'

  return (
    <main className="v3-app">
      <Sidebar active={active} onChange={setActive} profile={data.profile} onLogout={() => void logout()} />
      <section className="v3-main">
        <Topbar query={query} setQuery={setQuery} profile={data.profile} name={profileName} loading={loading} onRefresh={() => void refresh()} />
        {notice && <button className="v3-notice" onClick={() => setNotice('')}>{notice}<X /></button>}
        <div ref={surfaceRef} className="v3-surface">
          {active === 'home' && <HomeSurface data={data} voice={voice} activeLobby={activeLobby} onNavigate={setActive} onJoin={enterLobby} setNotice={setNotice} />}
          {active === 'lobbies' && <LobbiesSurface data={data} query={query} onJoin={enterLobby} onRefresh={refresh} setNotice={setNotice} />}
          {active === 'communities' && <CommunitiesSurface communities={data.communities} name={profileName} onRefresh={refresh} setNotice={setNotice} />}
          {active === 'ranking' && <RankingSurface rows={data.leaderboard} query={query} />}
          {active === 'music' && <MusicSurface />}
          {active === 'store' && <ProfileStoreSurface profile={data.profile} storeOnly onProfile={(profile) => setData((value) => ({ ...value, profile }))} setNotice={setNotice} />}
          {active === 'profile' && <ProfileStoreSurface profile={data.profile} onProfile={(profile) => setData((value) => ({ ...value, profile }))} setNotice={setNotice} />}
          {active === 'settings' && <SettingsSurface preferences={data.preferences} onSave={(preferences) => setData((value) => ({ ...value, preferences }))} setNotice={setNotice} />}
        </div>
      </section>
      {voice.lobbyCode && <CallDock voice={voice} lobby={activeLobby} profile={data.profile} setNotice={setNotice} />}
      <BillingPortal />
    </main>
  )
}

function Sidebar({ active, onChange, profile, onLogout }: { active: Section; onChange: (section: Section) => void; profile: GrindProfile | null; onLogout: () => void }) {
  return (
    <aside className="v3-sidebar">
      <div className="v3-sidebar-brand"><img src={logoUrl} alt="" /><strong>GrindLobby</strong><span>JOGUE. CONECTE. EVOLUA.</span></div>
      <nav>{nav.map((item) => { const Icon = item.icon; return <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onChange(item.id)}><Icon />{item.label}</button> })}</nav>
      <div className="v3-sidebar-spacer" />
      <button className="v3-premium-card" onClick={() => onChange('store')}><Crown /><div><strong>{isPro(profile) ? 'Premium ativo' : 'Seja Premium'}</strong><span>{isPro(profile) ? '1080p liberado' : 'Via Pix · desbloqueie seu potencial.'}</span></div><ChevronRight /></button>
      <button className="v3-logout" onClick={onLogout}><LogOut /> Deslogar</button>
      <div className="v3-version"><span>GrindLobby v0.3.0</span><small>Jogue maior.</small></div>
    </aside>
  )
}

function Topbar({ query, setQuery, profile, name, loading, onRefresh }: { query: string; setQuery: (value: string) => void; profile: GrindProfile | null; name: string; loading: boolean; onRefresh: () => void }) {
  return (
    <header className="v3-topbar" data-tauri-drag-region>
      <div className="v3-mini-logo"><img src={logoUrl} alt="" /></div>
      <label className="v3-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar jogadores, lobbies, comunidades..." /></label>
      <button className="v3-bell" onClick={onRefresh}><Bell className={loading ? 'spin' : ''} /><i /></button>
      <div className="v3-top-profile"><Avatar profile={profile} name={name} /><div><strong>{name}</strong><span>{isPro(profile) ? '★ Premium' : `Nível ${profile?.account_level || 1}`}</span></div></div>
      <div className="v3-window-controls"><button onClick={() => void windowAction('minimize')}><Minus /></button><button onClick={() => void windowAction('maximize')}><Maximize2 /></button><button className="close" onClick={() => void windowAction('close')}><X /></button></div>
    </header>
  )
}

function Avatar({ profile, name, src, speaking = false }: { profile?: GrindProfile | null; name: string; src?: string | null; speaking?: boolean }) {
  const image = src || profile?.avatar
  return <span className={speaking ? 'v3-avatar speaking' : 'v3-avatar'}>{image ? <img src={image} alt="" /> : initials(name)}</span>
}

function HomeSurface({ data, voice, activeLobby, onNavigate, onJoin, setNotice }: { data: DataState; voice: VoiceSnapshot; activeLobby: Lobby | null; onNavigate: (section: Section) => void; onJoin: (lobby: Lobby) => Promise<void>; setNotice: (value: string) => void }) {
  const profile = data.profile
  const top = data.leaderboard.slice(0, 5)
  const lobbies = data.lobbies.slice(0, 4)
  return (
    <div className="v3-home">
      <section className="v3-home-hero" data-motion="panel" style={{ backgroundImage: `linear-gradient(90deg,rgba(4,4,15,.87),rgba(4,4,15,.12)),url(${heroImage})` }}>
        <div><h1>Bem-vindo ao<br />GrindLobby, <em>{profile?.display_name || profile?.username || 'Jogador'}</em></h1><p>Mais que lobbies. Uma comunidade que joga junto,<br />evolui junto e chega mais longe.</p><div><button className="v3-primary" onClick={() => onNavigate('lobbies')}>Encontrar Lobbies <ChevronRight /></button><button className="v3-secondary" onClick={() => onNavigate('communities')}>Explorar Comunidades</button></div></div>
        <div className="v3-hero-words">JOGADORES<br />COMUNIDADES<br />CONQUISTAS<br />SEM LIMITES</div>
      </section>

      <div className="v3-home-grid">
        <div className="v3-home-left">
          <section className="v3-panel v3-top-rank" data-motion="panel"><PanelTitle title="Top Elos da Semana" action="Ver ranking" onAction={() => onNavigate('ranking')} />{top.length ? top.map((row, index) => <div className="v3-rank-line" key={row.id}><span>{index + 1}</span><Avatar name={row.display_name || row.username || 'GL'} src={row.avatar} /><div><strong>{row.display_name || row.username}</strong><small>{row.favorite_game || 'Competitivo'}</small></div><b>{Number(row.competitive_points || 0).toLocaleString('pt-BR')} PD</b></div>) : <Empty text="Ainda não há jogadores ranqueados." />}</section>
          <section className="v3-panel v3-journey" data-motion="panel"><PanelTitle title="Sua Jornada" action="Ver perfil" onAction={() => onNavigate('profile')} /><div className="v3-journey-main"><img src={rankEmblem} alt="" /><div><span>Elo Principal</span><strong>{profile?.competitive_points ? 'Competitivo' : 'Iniciante I'}</strong><small>{Number(profile?.competitive_points || 0).toLocaleString('pt-BR')} PD</small></div></div><div className="v3-progress"><i style={{ width: `${Math.min(100, (Number(profile?.competitive_points || 0) % 1000) / 10)}%` }} /></div><div className="v3-stat-strip"><Stat value={profile?.matches_played || 0} label="Partidas" /><Stat value={`${winRate(profile || {})}%`} label="Taxa de Vitória" /><Stat value={profile?.matches_won || 0} label="Vitórias" /><Stat value={`Nv. ${profile?.account_level || 1}`} label="Conta" /></div></section>
        </div>

        <div className="v3-home-center">
          <section className="v3-panel v3-live-lobbies" data-motion="panel"><PanelTitle title="Lobbies ao Vivo" action="Ver todos" onAction={() => onNavigate('lobbies')} /><div className="v3-filter-pills"><button className="active">Públicos ({data.lobbies.filter((x) => x.visibility === 'public').length})</button><button>Privados ({data.lobbies.filter((x) => x.visibility === 'private').length})</button></div>{lobbies.length ? lobbies.map((lobby) => <div className="v3-lobby-line" key={lobby.id}><GameMark game={lobby.game} /><div><strong>{lobby.name}</strong><span>{lobby.game} · <b>Voz Ativa</b></span></div><small><Users /> {lobby.members}/{lobby.maxMembers}</small><button onClick={() => void onJoin(lobby)}>{lobby.members >= lobby.maxMembers ? 'Lotado' : 'Entrar'}</button></div>) : <Empty text="Nenhum lobby ao vivo agora." />}</section>
          <section className="v3-panel v3-community-feed" data-motion="panel"><PanelTitle title="Atividade da Comunidade" action="Ver tudo" onAction={() => onNavigate('communities')} />{data.communities.slice(0, 4).map((community) => <div key={community.id}><span className="v3-community-dot">{initials(community.name)}</span><p><strong>{community.name}</strong> está ativa no GrindLobby.</p></div>)}{!data.communities.length && <Empty text="Entre em uma comunidade para ver atividades." />}</section>
        </div>

        <div className="v3-home-right">
          <VoiceCard voice={voice} lobby={activeLobby} />
          <NativeScreenCard voice={voice} profile={profile} lobby={activeLobby} setNotice={setNotice} />
          <section className="v3-panel v3-now-playing" data-motion="panel"><span className="spotify-dot">●</span><div><small>Tocando Agora</small><strong>GRIND BEATS</strong></div><div className="v3-equalizer"><i /><i /><i /><i /><i /><i /><i /><i /></div></section>
          <section className="v3-panel v3-store-highlight" data-motion="panel" style={{ backgroundImage: `linear-gradient(90deg,rgba(8,7,19,.92),rgba(8,7,19,.2)),url(${storeBundles})` }}><div><small>Destaque da Loja</small><strong>Bundle Sombras</strong><span>Pacote exclusivo</span><b>R$ 39,90</b></div><button onClick={() => onNavigate('store')}>Comprar</button></section>
        </div>
      </div>
    </div>
  )
}

function PanelTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="v3-panel-title"><h2>{title}</h2>{action && <button onClick={onAction}>{action}<ChevronRight /></button>}</div>
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>
}

function Empty({ text }: { text: string }) {
  return <div className="v3-empty">{text}</div>
}

function GameMark({ game }: { game: string }) {
  return <span className="v3-game-mark">{initials(game)}</span>
}

function VoiceCard({ voice, lobby }: { voice: VoiceSnapshot; lobby: Lobby | null }) {
  return (
    <section className="v3-panel v3-voice-card" data-motion="panel">
      <PanelTitle title="Chamada de Voz" action={voice.rttMs !== null ? `${voice.rttMs} ms` : voice.connected ? 'Conectado' : 'Offline'} />
      <div className="v3-room-name"><span className="v3-online-dot" /><div><strong>{lobby?.name || voice.lobbyCode || 'Sem call ativa'}</strong><small>{voice.participants.length} na call</small></div></div>
      <div className="v3-participants">{voice.participants.slice(0, 5).map((person) => <div key={person.id}><Avatar name={person.name} speaking={person.speaking} /><small>{person.name}</small></div>)}</div>
      <div className="v3-voice-actions"><button className={voice.muted ? 'danger' : ''} onClick={() => void voiceSession.setMuted(!voice.muted)}>{voice.muted ? <MicOff /> : <Mic />}</button><button className={voice.deafened ? 'danger' : ''} onClick={() => voiceSession.setDeafened(!voice.deafened)}>{voice.deafened ? <VolumeX /> : <Headphones />}</button><button><Settings /></button><button className="hangup" onClick={() => void voiceSession.disconnect()}><Radio /></button></div>
    </section>
  )
}

function NativeScreenCard({ voice, profile, lobby, setNotice }: { voice: VoiceSnapshot; profile: GrindProfile | null; lobby: Lobby | null; setNotice: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [kind, setKind] = useState<CaptureSourceKind>('screen')
  const [sources, setSources] = useState<NativeCaptureSource[]>([])
  const [selected, setSelected] = useState<NativeCaptureSource | null>(null)
  const [preset, setPreset] = useState<StreamPreset>('720p30')
  const [busy, setBusy] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const screens = Object.values(voice.remoteScreens)
  const preview = screens[0] || null

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = preview
  }, [preview])

  async function loadSources(nextKind = kind) {
    try {
      const rows = await listNativeCaptureSources(nextKind)
      setSources(rows)
      setSelected(rows[0] || null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível listar telas do Windows.')
    }
  }

  async function start() {
    if (!lobby || !voice.connected) {
      setNotice('Entre em uma call antes de transmitir a tela.')
      return
    }
    if (!selected) return
    if (preset.startsWith('1080') && !isPro(profile)) {
      setNotice('1080p é exclusivo do Grind Premium.')
      return
    }
    setBusy(true)
    try {
      await startNativeScreenShare({ lobbyId: lobby.routeCode, source: selected, preset, includeCursor: true })
      setSharing(true)
      setOpen(false)
      setNotice(`Transmissão nativa iniciada: ${selected.title}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao iniciar transmissão nativa.')
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    await stopNativeScreenShare().catch(() => {})
    setSharing(false)
    setNotice('Transmissão encerrada.')
  }

  return (
    <section className="v3-panel v3-screen-card" data-motion="panel">
      <div className="v3-screen-title"><h2>Tela ao Vivo</h2><span>{sharing || preview ? '● AO VIVO' : 'Pronta'}</span></div>
      <div className="v3-screen-body">{preview ? <video ref={videoRef} autoPlay muted playsInline /> : <button className="v3-screen-placeholder" onClick={() => { setOpen(true); void loadSources() }}><MonitorUp /><span>{voice.connected ? 'Selecionar tela ou janela do Windows' : 'Entre em uma call para transmitir'}</span></button>}<div className="v3-quality"><strong>Qualidade da transmissão</strong>{(['480p30','480p60','720p30','1080p60'] as StreamPreset[]).map((value) => <button key={value} className={preset === value ? 'active' : ''} disabled={value.startsWith('1080') && !isPro(profile)} onClick={() => setPreset(value)}>{value === '1080p60' ? '1080p Pro' : value.replace('p', 'p ').replace('30','30').replace('60','60')}{value.startsWith('1080') && <Crown />}</button>)}</div></div>
      <div className="v3-screen-footer">{sharing ? <button className="v3-secondary" onClick={() => void stop()}>Parar transmissão</button> : <button className="v3-primary" onClick={() => { setOpen(true); void loadSources() }} disabled={!voice.connected}>Compartilhar pelo Windows</button>}</div>

      {open && <div className="v3-modal-backdrop"><div className="v3-source-modal"><button className="v3-modal-close" onClick={() => setOpen(false)}><X /></button><span className="v3-kicker">CAPTURA NATIVA WINDOWS</span><h2>Escolha o que transmitir</h2><p>O Grind captura diretamente pelo runtime do Windows; nenhuma aba ou seletor do navegador é aberto.</p><div className="v3-source-tabs"><button className={kind === 'screen' ? 'active' : ''} onClick={() => { setKind('screen'); void loadSources('screen') }}>Monitores</button><button className={kind === 'window' ? 'active' : ''} onClick={() => { setKind('window'); void loadSources('window') }}>Janelas</button></div><div className="v3-source-list">{sources.map((source) => <button key={`${source.kind}-${source.id}`} className={selected?.id === source.id && selected.kind === source.kind ? 'active' : ''} onClick={() => setSelected(source)}><MonitorUp /><div><strong>{source.title}</strong><span>{source.kind === 'screen' ? `Monitor ${source.displayId}` : 'Janela do Windows'}</span></div></button>)}{!sources.length && <Empty text="Nenhuma fonte encontrada." />}</div><div className="v3-source-quality">{(['480p30','480p60','720p30','720p60','1080p30','1080p60'] as StreamPreset[]).map((value) => <button key={value} className={preset === value ? 'active' : ''} disabled={value.startsWith('1080') && !isPro(profile)} onClick={() => setPreset(value)}>{value}{value.startsWith('1080') && <Crown />}</button>)}</div><button className="v3-primary v3-source-start" disabled={!selected || busy} onClick={() => void start()}>{busy ? 'Iniciando...' : 'Transmitir agora'}</button></div></div>}
    </section>
  )
}

function LobbiesSurface({ data, query, onJoin, onRefresh, setNotice }: { data: DataState; query: string; onJoin: (lobby: Lobby) => Promise<void>; onRefresh: () => Promise<void>; setNotice: (value: string) => void }) {
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('Squad do Lobby')
  const [game, setGame] = useState('VALORANT')
  const [maxMembers, setMaxMembers] = useState(5)
  const [creating, setCreating] = useState(false)
  const filtered = data.lobbies.filter((lobby) => lobby.visibility === visibility && `${lobby.name} ${lobby.game}`.toLowerCase().includes(query.toLowerCase()))

  async function create(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    try {
      const result = await createLobby({ name, game, visibility, maxMembers })
      setNotice(`Lobby ${result.route_code} criado.`)
      setCreateOpen(false)
      await onRefresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao criar lobby.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="v3-lobbies-page">
      <section className="v3-lobbies-hero" data-motion="panel" style={{ backgroundImage: `linear-gradient(90deg,rgba(5,5,18,.9),rgba(5,5,18,.18)),url(${heroImage})` }}><h1>Lobbies criam partidas.<br />Comunidades criam <em>histórias.</em></h1><p>Encontre seu time. Jogue junto. Evolua sempre.</p></section>
      <div className="v3-lobbies-layout">
        <section className="v3-lobbies-main" data-motion="panel">
          <div className="v3-lobby-tabs"><button className={visibility === 'public' ? 'active' : ''} onClick={() => setVisibility('public')}><Radio /> Lobbies Públicos</button><button className={visibility === 'private' ? 'active' : ''} onClick={() => setVisibility('private')}><LockKeyhole /> Privados</button><button className="create" onClick={() => setCreateOpen(true)}>Criar Lobby <Plus /></button></div>
          <div className="v3-lobby-filters"><button>Todos os Jogos</button><button>Todos os Modos</button><button>Qualquer Elo</button><button><Mic /> Com Voz</button><button>Ordenar: Mais Ativos</button></div>
          <div className="v3-lobby-grid">{filtered.map((lobby) => <article className="v3-lobby-card" key={lobby.id}><div className="v3-lobby-card-art" style={{ backgroundImage: `linear-gradient(90deg,rgba(8,8,19,.94),rgba(8,8,19,.35)),url(${heroImage})` }}><GameMark game={lobby.game} /><div><strong>{lobby.game}</strong><span>● Voz Ativa</span></div><b><Users /> {lobby.members}/{lobby.maxMembers}</b></div><h3>{lobby.name}</h3><div className="v3-tags"><span>Competitivo</span><span>{lobby.visibility === 'private' ? 'Privado' : 'Público'}</span></div><div className="v3-lobby-card-foot"><div className="v3-mini-avatars">{Array.from({ length: Math.min(4, lobby.members) }).map((_, index) => <span key={index}>{index + 1}</span>)}</div><button onClick={() => void onJoin(lobby)}>Entrar</button>{data.profile?.id === lobby.ownerId && <button className="close-lobby" onClick={() => void closeLobby(lobby.id).then(onRefresh).catch((error) => setNotice(error instanceof Error ? error.message : 'Falha ao encerrar.'))}>×</button>}</div></article>)}{!filtered.length && <Empty text="Nenhum lobby disponível com esses filtros." />}</div>
        </section>
        <aside className="v3-featured-communities" data-motion="panel"><PanelTitle title="Comunidades em Destaque" action="Ver todas" /><div className="v3-featured-main" style={{ backgroundImage: `linear-gradient(0deg,rgba(6,6,18,.94),rgba(6,6,18,.18)),url(${heroImage})` }}><h3>{data.communities[0]?.name || 'GrindLobby Oficial'}</h3><p>{data.communities[0]?.description || 'A maior comunidade de gamers do Grind.'}</p><button>Entrar</button></div><h3>Explorar Comunidades</h3>{data.communities.slice(0, 5).map((community) => <div className="v3-community-row" key={community.id}><span>{initials(community.name)}</span><div><strong>{community.name}</strong><small>{community.tags.join(' · ') || community.role}</small></div><button>Entrar</button></div>)}</aside>
      </div>
      {createOpen && <div className="v3-modal-backdrop"><form className="v3-source-modal" onSubmit={create}><button type="button" className="v3-modal-close" onClick={() => setCreateOpen(false)}><X /></button><span className="v3-kicker">NOVO LOBBY</span><h2>Criar Lobby</h2><label>Nome<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>Jogo<input value={game} onChange={(e) => setGame(e.target.value)} /></label><label>Máximo de jogadores<input type="number" min={2} max={50} value={maxMembers} onChange={(e) => setMaxMembers(Number(e.target.value))} /></label><button className="v3-primary" disabled={creating}>{creating ? 'Criando...' : 'Criar Lobby'}</button></form></div>}
    </div>
  )
}

function CommunitiesSurface({ communities, name, onRefresh, setNotice }: { communities: Community[]; name: string; onRefresh: () => Promise<void>; setNotice: (value: string) => void }) {
  const [selectedId, setSelectedId] = useState(communities[0]?.id || '')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [description, setDescription] = useState('')
  const [invite, setInvite] = useState('')
  const [post, setPost] = useState('')
  const selected = communities.find((item) => item.id === selectedId)

  useEffect(() => { if (!selectedId && communities[0]) setSelectedId(communities[0].id) }, [communities, selectedId])
  useEffect(() => { if (selectedId) void loadCommunityPosts(selectedId).then(setPosts).catch(() => setPosts([])) }, [selectedId])

  async function create(event: FormEvent) {
    event.preventDefault()
    try {
      const id = await createCommunity({ name: newName, description, tags: ['gaming'] })
      await onRefresh(); setSelectedId(id); setCreateOpen(false); setNewName(''); setDescription('')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao criar comunidade.') }
  }

  async function createInvite() {
    if (!selected) return
    try { const token = await createCommunityInvite(selected.id); await navigator.clipboard.writeText(token); setNotice('Convite copiado.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao gerar convite.') }
  }

  async function acceptInvite() {
    try { const id = await acceptCommunityInvite(invite, name); await onRefresh(); setSelectedId(id || ''); setInvite('') } catch (error) { setNotice(error instanceof Error ? error.message : 'Convite inválido.') }
  }

  async function publish() {
    if (!selected || !post.trim()) return
    try { await createCommunityPost(selected.id, 'Novo post', post); setPost(''); setPosts(await loadCommunityPosts(selected.id)) } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao publicar.') }
  }

  return <div className="v3-communities"><aside className="v3-panel v3-community-nav" data-motion="panel"><div className="v3-panel-title"><h2>Comunidades</h2><button onClick={() => setCreateOpen(true)}><Plus /></button></div>{communities.map((community) => <button key={community.id} className={selectedId === community.id ? 'active' : ''} onClick={() => setSelectedId(community.id)}><span>{initials(community.name)}</span><div><strong>{community.name}</strong><small>{community.role}</small></div></button>)}<div className="v3-invite-box"><input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Token de convite" /><button onClick={() => void acceptInvite()}>Entrar</button></div></aside><main className="v3-community-content">{selected ? <><section className="v3-community-banner" data-motion="panel" style={{ backgroundImage: selected.bannerUrl ? `linear-gradient(90deg,rgba(5,5,18,.86),rgba(5,5,18,.2)),url(${selected.bannerUrl})` : `linear-gradient(90deg,rgba(5,5,18,.86),rgba(5,5,18,.2)),url(${heroImage})` }}><span>{selected.logoUrl ? <img src={selected.logoUrl} alt="" /> : initials(selected.name)}</span><div><small>GRIND FAM</small><h1>{selected.name}</h1><p>{selected.description}</p></div><button onClick={() => void createInvite()}><Copy /> Convite</button></section><section className="v3-panel v3-post-compose" data-motion="panel"><textarea value={post} onChange={(e) => setPost(e.target.value)} placeholder="Compartilhe algo com a comunidade..." /><button className="v3-primary" onClick={() => void publish()}>Publicar</button></section><div className="v3-post-grid">{posts.map((item) => <article className="v3-panel" data-motion="panel" key={item.id}><small>{item.type}</small><h3>{item.title}</h3><p>{item.body}</p><span>{new Date(item.created_at).toLocaleString('pt-BR')}</span></article>)}{!posts.length && <Empty text="Nenhuma atividade nesta comunidade." />}</div></> : <Empty text="Selecione ou crie uma comunidade." />}</main>{createOpen && <div className="v3-modal-backdrop"><form className="v3-source-modal" onSubmit={create}><button type="button" className="v3-modal-close" onClick={() => setCreateOpen(false)}><X /></button><h2>Nova Comunidade</h2><label>Nome<input value={newName} onChange={(e) => setNewName(e.target.value)} /></label><label>Descrição<textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label><button className="v3-primary">Criar comunidade</button></form></div>}</div>
}

function RankingSurface({ rows, query }: { rows: LeaderboardRow[]; query: string }) {
  const filtered = rows.filter((row) => `${row.display_name} ${row.username} ${row.favorite_game}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="v3-ranking"><section className="v3-ranking-hero" data-motion="panel" style={{ backgroundImage: `linear-gradient(90deg,rgba(5,5,18,.9),rgba(5,5,18,.16)),url(${heroImage})` }}><h1>Top Elos</h1><p>Os jogadores que mais evoluíram no GrindLobby.</p></section><div className="v3-podium">{filtered.slice(0, 3).map((row, index) => <article className="v3-panel" data-motion="panel" key={row.id}><span>#{index + 1}</span><Avatar name={row.display_name || row.username || 'GL'} src={row.avatar} /><h3>{row.display_name || row.username}</h3><strong>{Number(row.competitive_points || 0).toLocaleString('pt-BR')} PD</strong><small>{winRate(row)}% vitórias</small></article>)}</div><section className="v3-panel v3-ranking-table" data-motion="panel">{filtered.map((row, index) => <div key={row.id}><b>{index + 1}</b><Avatar name={row.display_name || row.username || 'GL'} src={row.avatar} /><span><strong>{row.display_name || row.username}</strong><small>{row.favorite_game || 'Competitivo'}</small></span><span>{row.matches_won || 0} vitórias</span><span>Nv. {row.account_level || 1}</span><strong>{Number(row.competitive_points || 0).toLocaleString('pt-BR')} PD</strong></div>)}</section></div>
}

function MusicSurface() {
  const [url, setUrl] = useState('')
  const [track, setTrack] = useState('')
  const [playing, setPlaying] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  function load(event: FormEvent) { event.preventDefault(); setTrack(url.trim()); requestAnimationFrame(() => void audio.current?.play().then(() => setPlaying(true)).catch(() => setPlaying(false))) }
  return <div className="v3-music"><section className="v3-music-hero" data-motion="panel"><Music2 /><div><h1>Grind Beats</h1><p>Player integrado ao cliente desktop.</p></div></section><section className="v3-panel v3-music-player" data-motion="panel"><div className={playing ? 'v3-disc playing' : 'v3-disc'}><Music2 /></div><div><small>Tocando agora</small><h2>{track ? new URL(track, location.href).pathname.split('/').pop() || 'Faixa externa' : 'Nenhuma faixa carregada'}</h2><p>{track || 'Cole uma URL direta de áudio suportada pelo Windows WebView.'}</p><audio ref={audio} src={track || undefined} controls onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /></div></section><form className="v3-panel v3-music-add" data-motion="panel" onSubmit={load}><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://.../musica.mp3" /><button className="v3-primary">{playing ? <Pause /> : <Play />} Reproduzir</button></form></div>
}

const cosmetics = [
  { id: 'frame-eclipse', slot: 'avatar_frame', title: 'Frame Eclipse', price: 'R$ 14,90', asset: storeEffects },
  { id: 'banner-galactic', slot: 'profile_banner', title: 'Banner Galáctico', price: 'R$ 11,90', asset: storeBundles },
  { id: 'badge-competitive', slot: 'profile_badge', title: 'Badge Competitivo', price: 'R$ 9,90', asset: storeRank },
  { id: 'effect-violet', slot: 'profile_effect', title: 'Efeito Violet', price: 'R$ 9,90', asset: storeEffects },
] as const

function ownedSet(value: unknown) {
  if (Array.isArray(value)) return new Set(value.map(String))
  if (value && typeof value === 'object') return new Set(Object.keys(value as Record<string, unknown>).filter((key) => Boolean((value as Record<string, unknown>)[key])))
  return new Set<string>()
}

function ProfileStoreSurface({ profile, storeOnly = false, onProfile, setNotice }: { profile: GrindProfile | null; storeOnly?: boolean; onProfile: (profile: GrindProfile) => void; setNotice: (value: string) => void }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [editOpen, setEditOpen] = useState(false)
  const owned = ownedSet(profile?.cosmetic_owned)
  useEffect(() => setDisplayName(profile?.display_name || ''), [profile])

  async function save(event: FormEvent) {
    event.preventDefault()
    try { const updated = await updateProfile({ display_name: displayName }); onProfile(updated); setEditOpen(false); setNotice('Perfil atualizado.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao atualizar perfil.') }
  }
  async function equip(item: (typeof cosmetics)[number]) {
    try { const updated = await equipCosmetic(item.slot, item.id); onProfile(updated); setNotice(`${item.title} equipado.`) } catch (error) { setNotice(error instanceof Error ? error.message : 'Item ainda não pertence à sua conta.') }
  }

  return <div className={storeOnly ? 'v3-profile-store store-only' : 'v3-profile-store'}>{!storeOnly && <section className="v3-profile-side"><div className="v3-profile-cover" data-motion="panel" style={{ backgroundImage: `linear-gradient(0deg,rgba(6,6,18,.92),rgba(6,6,18,.1)),url(${profile?.profile_banner || heroImage})` }}><h1>Perfil</h1><p>Mais que um jogador. Uma história em construção.</p></div><div className="v3-profile-card v3-panel" data-motion="panel"><div className="v3-big-avatar"><Avatar profile={profile} name={profile?.display_name || profile?.username || 'GL'} /><img src={rankEmblem} alt="" /></div><div className="v3-profile-name"><h2>{profile?.display_name || profile?.username || 'Jogador'} {isPro(profile) && <Crown />}</h2><span>#{profile?.id?.slice(0,4) || '0000'} · {isPro(profile) ? 'Premium' : 'Free'}</span><button onClick={() => setEditOpen(true)}>Editar</button></div><div className="v3-level-box"><span>Nível {profile?.account_level || 1}</span><div><i style={{ width: `${Math.min(100, Number(profile?.account_xp || 0) % 100)}%` }} /></div></div></div><section className="v3-panel v3-profile-ranks" data-motion="panel"><img src={rankEmblem} alt="" /><div><small>Elo Principal</small><strong>{profile?.competitive_points ? 'Competitivo' : 'Iniciante I'}</strong><span>{profile?.favorite_game || 'Sem jogo favorito'}</span></div><div className="v3-rank-mini"><span>Top Elos</span><b>{Number(profile?.competitive_points || 0).toLocaleString('pt-BR')} PD</b></div></section><section className="v3-panel v3-profile-stats" data-motion="panel"><Stat value={profile?.matches_won || 0} label="Vitórias" /><Stat value={`${winRate(profile || {})}%`} label="Taxa de Vitória" /><Stat value={profile?.matches_played || 0} label="Partidas" /><Stat value={`Nv. ${profile?.account_level || 1}`} label="Nível" /></section><section className="v3-achievements" data-motion="panel"><h3>Conquistas</h3><div>{['Veterano','Rumo ao Radiante','MVP','Boa Call','Squad','Comunidade','Streamer','Lenda'].map((name, index) => <article className="v3-panel" key={name}><span>{index % 2 ? '◇' : '✦'}</span><strong>{name}</strong><small>{index % 2 ? 'Conquista em progresso' : 'Desbloqueada'}</small></article>)}</div></section></section>}

    <section className="v3-store-side"><header className="v3-store-head" data-motion="panel"><div><h1>Loja</h1><p>Estilo, identidade e exclusividade para a sua jornada.</p></div><button><ShoppingBag /> Carrinho (0)</button></header><section className="v3-store-hero" data-motion="panel" style={{ backgroundImage: `linear-gradient(90deg,rgba(8,7,19,.88),rgba(8,7,19,.2)),url(${storeBundles})` }}><div><h2>BUNDLES EXCLUSIVOS</h2><p>Mostre quem você é dentro e fora do jogo.</p><button>Ver todos os Bundles <ChevronRight /></button></div></section><div className="v3-store-tabs"><button className="active">Todos</button><button>Bundles</button><button>Avatares</button><button>Frames</button><button>Banners</button><button>Emotes</button><button>Efeitos</button></div><div className="v3-store-title"><h2>Destaques da Loja</h2><button>Ver tudo <ChevronRight /></button></div><div className="v3-store-grid">{cosmetics.map((item, index) => { const unlocked = profile?.app_role === 'admin' || owned.has(item.id); const equipped = String(profile?.cosmetic_equipped?.[item.slot] || '') === item.id; return <article className="v3-store-item v3-panel" data-motion="panel" key={item.id}><div className="v3-store-image"><img src={item.asset} alt="" /><span>{index === 0 ? 'Mais Vendido' : index === 1 ? 'Novo' : index === 2 ? 'Exclusivo' : 'Popular'}</span></div><h3>{item.title}</h3><small>{item.slot.replace('_',' ')}</small><b>{item.price}</b><button className={unlocked ? 'v3-primary' : 'v3-secondary'} disabled={equipped} onClick={() => unlocked ? void equip(item) : setNotice('Adquira o item pelo checkout da loja quando ele estiver publicado.')}>{equipped ? 'Em uso' : unlocked ? 'Equipar' : 'Comprar'}</button></article> })}</div><div className="v3-store-title"><h2>Outros Itens</h2></div><div className="v3-store-compact">{cosmetics.map((item) => <article className="v3-panel" data-motion="panel" key={`compact-${item.id}`}><img src={item.asset} alt="" /><div><strong>{item.title}</strong><span>{item.price}</span></div><button><ShoppingBag /></button></article>)}</div><footer className="v3-store-guarantees"><div><ShieldCheck /><span><strong>Compras seguras</strong>Seus dados estão protegidos.</span></div><div><Sparkles /><span><strong>Entrega imediata</strong>Receba seus itens na hora.</span></div><div><Crown /><span><strong>Itens exclusivos</strong>Disponíveis apenas no GrindLobby.</span></div></footer></section>
    {editOpen && <div className="v3-modal-backdrop"><form className="v3-source-modal" onSubmit={save}><button type="button" className="v3-modal-close" onClick={() => setEditOpen(false)}><X /></button><h2>Editar perfil</h2><label>Nome<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label><button className="v3-primary">Salvar</button></form></div>}
  </div>
}

function SettingsSurface({ preferences, onSave, setNotice }: { preferences: DesktopPreferences | null; onSave: (preferences: DesktopPreferences) => void; setNotice: (value: string) => void }) {
  const [prefs, setPrefs] = useState<DesktopPreferences>(preferences || { show_online: true, allow_friend_requests: true, allow_messages_from_friends: true, desktop_settings: { outputVolume: 80, noiseSuppression: true, echoCancellation: true, autoGainControl: true } })
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  useEffect(() => { if (preferences) setPrefs(preferences) }, [preferences])
  useEffect(() => { void navigator.mediaDevices.enumerateDevices().then((devices) => { setInputs(devices.filter((d) => d.kind === 'audioinput')); setOutputs(devices.filter((d) => d.kind === 'audiooutput')) }).catch(() => {}) }, [])
  function desktop<K extends keyof DesktopPreferences['desktop_settings']>(key: K, value: DesktopPreferences['desktop_settings'][K]) { setPrefs((current) => ({ ...current, desktop_settings: { ...current.desktop_settings, [key]: value } })) }
  async function save() { try { await savePreferences(prefs); onSave(prefs); voiceSession.setOutput(prefs.desktop_settings.outputDeviceId || '', prefs.desktop_settings.outputVolume ?? 80); setNotice('Configurações salvas.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao salvar configurações.') } }
  return <div className="v3-settings"><section className="v3-settings-hero" data-motion="panel"><Settings /><div><h1>Configurações</h1><p>Áudio, privacidade e comportamento do cliente Windows.</p></div></section><div className="v3-settings-grid"><section className="v3-panel" data-motion="panel"><h2>Áudio</h2><label>Microfone<select value={prefs.desktop_settings.inputDeviceId || ''} onChange={(e) => desktop('inputDeviceId', e.target.value)}><option value="">Padrão do Windows</option>{inputs.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microfone'}</option>)}</select></label><label>Saída<select value={prefs.desktop_settings.outputDeviceId || ''} onChange={(e) => desktop('outputDeviceId', e.target.value)}><option value="">Padrão do Windows</option>{outputs.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Saída'}</option>)}</select></label><label>Volume <b>{prefs.desktop_settings.outputVolume ?? 80}%</b><input type="range" min={0} max={100} value={prefs.desktop_settings.outputVolume ?? 80} onChange={(e) => desktop('outputVolume', Number(e.target.value))} /></label><Toggle label="Supressão de ruído" value={prefs.desktop_settings.noiseSuppression ?? true} onChange={(value) => desktop('noiseSuppression', value)} /><Toggle label="Cancelamento de eco" value={prefs.desktop_settings.echoCancellation ?? true} onChange={(value) => desktop('echoCancellation', value)} /><Toggle label="Ganho automático" value={prefs.desktop_settings.autoGainControl ?? true} onChange={(value) => desktop('autoGainControl', value)} /></section><section className="v3-panel" data-motion="panel"><h2>Privacidade</h2><Toggle label="Mostrar status online" value={prefs.show_online} onChange={(value) => setPrefs((current) => ({ ...current, show_online: value }))} /><Toggle label="Permitir pedidos de amizade" value={prefs.allow_friend_requests} onChange={(value) => setPrefs((current) => ({ ...current, allow_friend_requests: value }))} /><Toggle label="Mensagens de amigos" value={prefs.allow_messages_from_friends} onChange={(value) => setPrefs((current) => ({ ...current, allow_messages_from_friends: value }))} /><Toggle label="Reduzir animações" value={prefs.desktop_settings.reduceMotion ?? false} onChange={(value) => desktop('reduceMotion', value)} /><button className="v3-primary" onClick={() => void save()}>Salvar configurações</button></section></div></div>
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <button className="v3-toggle-row" type="button" onClick={() => onChange(!value)}><span>{label}</span><i className={value ? 'active' : ''}><b /></i></button>
}

function CallDock({ voice, lobby, profile, setNotice }: { voice: VoiceSnapshot; lobby: Lobby | null; profile: GrindProfile | null; setNotice: (value: string) => void }) {
  const [preset, setPreset] = useState<StreamPreset>('720p30')
  const [picker, setPicker] = useState(false)
  const [sources, setSources] = useState<NativeCaptureSource[]>([])
  const [selected, setSelected] = useState<NativeCaptureSource | null>(null)
  async function openPicker() { try { const rows = await listNativeCaptureSources('screen'); setSources(rows); setSelected(rows[0] || null); setPicker(true) } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao listar monitores.') } }
  async function share() { if (!lobby || !selected) return; if (preset.startsWith('1080') && !isPro(profile)) { setNotice('1080p é exclusivo do Grind Premium.'); return } try { await startNativeScreenShare({ lobbyId: lobby.routeCode, source: selected, preset }); setPicker(false); setNotice('Tela sendo transmitida pelo capturador nativo do Windows.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha na transmissão nativa.') } }
  return <div className="v3-call-dock"><div className="v3-dock-room"><span className="v3-online-dot" /><div><strong>Chamada de Voz Ativa</strong><span>{lobby?.name || voice.lobbyCode}</span></div></div><div className="v3-dock-people">{voice.participants.slice(0, 5).map((person) => <div key={person.id}><Avatar name={person.name} speaking={person.speaking} /><small>{person.name}</small></div>)}</div><span className="v3-more">+{Math.max(0, voice.participants.length - 5)}</span><div className="v3-dock-actions"><button onClick={() => void voiceSession.setMuted(!voice.muted)}>{voice.muted ? <MicOff /> : <Mic />}</button><button onClick={() => voiceSession.setDeafened(!voice.deafened)}>{voice.deafened ? <VolumeX /> : <Headphones />}</button><button onClick={() => void openPicker()}><MonitorUp /></button><button className="hangup" onClick={() => void stopNativeScreenShare().catch(() => {}).then(() => voiceSession.disconnect())}><Radio /></button></div><div className="v3-dock-music"><Music2 /><div><small>Tocando Agora</small><strong>GRIND BEATS</strong></div><div className="v3-equalizer"><i /><i /><i /><i /><i /><i /></div></div>{picker && <div className="v3-modal-backdrop"><div className="v3-source-modal"><button className="v3-modal-close" onClick={() => setPicker(false)}><X /></button><h2>Compartilhar pelo Windows</h2><div className="v3-source-list">{sources.map((source) => <button key={source.id} className={selected?.id === source.id ? 'active' : ''} onClick={() => setSelected(source)}><MonitorUp /><strong>{source.title}</strong></button>)}</div><select value={preset} onChange={(e) => setPreset(e.target.value as StreamPreset)}><option value="480p30">480p 30 FPS</option><option value="480p60">480p 60 FPS</option><option value="720p30">720p 30 FPS</option><option value="720p60">720p 60 FPS</option>{isPro(profile) && <><option value="1080p30">1080p 30 FPS</option><option value="1080p60">1080p 60 FPS</option></>}</select><button className="v3-primary" disabled={!selected} onClick={() => void share()}>Transmitir</button></div></div>}</div>
}

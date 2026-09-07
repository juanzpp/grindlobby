import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Bell,
  ChevronRight,
  CircleUserRound,
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
  RefreshCw,
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
  leaveLobby,
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

const sections = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'lobbies', label: 'Lobbies', icon: Gamepad2 },
  { id: 'communities', label: 'Comunidades', icon: Users },
  { id: 'ranking', label: 'Top Elos', icon: Trophy },
  { id: 'music', label: 'Música', icon: Music2 },
  { id: 'store', label: 'Loja', icon: ShoppingBag },
  { id: 'profile', label: 'Perfil', icon: UserRound },
  { id: 'settings', label: 'Configurações', icon: Settings },
] as const

type SectionId = (typeof sections)[number]['id']

type AppData = {
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

async function withWindow(action: 'minimize' | 'maximize' | 'close') {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const window = getCurrentWindow()
    if (action === 'minimize') await window.minimize()
    if (action === 'maximize') await window.toggleMaximize()
    if (action === 'close') await window.close()
  } catch {
    // Browser preview does not expose the Tauri window API.
  }
}

function initials(value?: string | null) {
  return (value || 'GL').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function winRate(row: { matches_played?: number | null; matches_won?: number | null }) {
  const played = Number(row.matches_played || 0)
  return played ? Math.round((Number(row.matches_won || 0) / played) * 100) : 0
}

function isPro(profile: GrindProfile | null) {
  return profile?.account_tier === 'pro' || profile?.app_role === 'admin'
}

function useVoiceSnapshot() {
  const [voice, setVoice] = useState<VoiceSnapshot>(EMPTY_VOICE)
  useEffect(() => voiceSession.subscribe(setVoice), [])
  return voice
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let mounted = true
    void currentSession().then((value) => {
      if (!mounted) return
      setSession(value)
      setBooting(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, value) => setSession(value))
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  if (booting) return <SplashScreen />
  if (!session) return <AuthScreen />
  return <DesktopShell session={session} />
}

function SplashScreen() {
  return (
    <main className="splash-screen">
      <div className="splash-orbit"><img src={logoUrl} alt="GrindLobby" /></div>
      <p>GRINDLOBBY</p>
      <span>CARREGANDO DESKTOP V2</span>
    </main>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [identifier, setIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(identifier, password, remember)
      } else {
        const session = await signUp(identifier, password, username)
        setMessage(session ? 'Conta criada.' : 'Conta criada. Confira seu e-mail para confirmar o acesso.')
        if (!session) setMode('login')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível autenticar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-art" style={{ backgroundImage: `linear-gradient(90deg, rgba(4,4,14,.2), rgba(4,4,14,.82)), url(${heroImage})` }}>
        <div className="auth-brand"><img src={logoUrl} alt="" /><strong>GrindLobby</strong><span>JOGUE. CONECTE. EVOLUA.</span></div>
        <div className="auth-copy">
          <span className="eyebrow">GRIND DESKTOP</span>
          <h1>Mais que jogos, uma comunidade que <em>joga junto.</em></h1>
          <p>Voz de baixa latência, tela ao vivo, comunidades e evolução competitiva em um cliente desktop próprio.</p>
          <div className="auth-points"><span>● Call persistente</span><span>● SFU LiveKit</span><span>● Lobbies públicos e privados</span></div>
        </div>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <img className="auth-logo" src={logoUrl} alt="GrindLobby" />
        <h2>GrindLobby</h2>
        <p>Bem-vindo de volta ao lobby.</p>
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Entrar</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Criar conta</button>
        </div>
        {mode === 'signup' && <label>Usuário<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Seu nick" autoComplete="username" /></label>}
        <label>{mode === 'login' ? 'E-mail ou usuário' : 'E-mail'}<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="voce@exemplo.com" autoComplete="email" /></label>
        <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {mode === 'login' && <label className="remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Lembrar senha neste PC</label>}
        {message && <div className="form-message">{message}</div>}
        <button className="primary wide" disabled={busy || !identifier || password.length < 8}>{busy ? 'Conectando...' : mode === 'login' ? 'Entrar no Lobby' : 'Criar conta'} <ChevronRight size={17} /></button>
        <div className="auth-security"><ShieldCheck size={16} /> Sessão protegida pelo GrindLobby</div>
      </form>
    </main>
  )
}

function DesktopShell({ session }: { session: Session }) {
  const [active, setActive] = useState<SectionId>('home')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AppData>({ profile: null, lobbies: [], leaderboard: [], communities: [], preferences: null })
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null)
  const voice = useVoiceSnapshot()

  const refresh = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled([loadProfile(), loadLobbies(), loadLeaderboard(20), loadCommunities(), loadPreferences()])
    const [profile, lobbies, leaderboard, communities, preferences] = results
    setData((previous) => ({
      profile: profile.status === 'fulfilled' ? profile.value : previous.profile,
      lobbies: lobbies.status === 'fulfilled' ? lobbies.value : previous.lobbies,
      leaderboard: leaderboard.status === 'fulfilled' ? leaderboard.value : previous.leaderboard,
      communities: communities.status === 'fulfilled' ? communities.value : previous.communities,
      preferences: preferences.status === 'fulfilled' ? preferences.value : previous.preferences,
    }))
    const failure = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined
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

  useEffect(() => {
    if (!voice.lobbyCode) return
    const lobby = data.lobbies.find((item) => item.routeCode === voice.lobbyCode)
    if (lobby) setActiveLobby(lobby)
  }, [voice.lobbyCode, data.lobbies])

  async function enterVoice(lobby: Lobby) {
    setNotice('')
    try {
      await joinLobby(lobby)
      setActiveLobby(lobby)
      const settings = data.preferences?.desktop_settings
      await voiceSession.connect(lobby.routeCode, settings)
      setNotice(`Conectado à call de ${lobby.name}.`)
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível entrar no lobby.')
    }
  }

  async function logout() {
    await voiceSession.disconnect()
    await heartbeatProfile(false)
    await signOut()
  }

  const profileName = data.profile?.display_name || data.profile?.username || session.user.email?.split('@')[0] || 'Jogador'

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="titlebar" data-tauri-drag-region>
        <div className="brand-mini" data-tauri-drag-region><img src={logoUrl} alt="" /><span>GRINDLOBBY</span></div>
        <div className="window-controls"><button onClick={() => void withWindow('minimize')} aria-label="Minimizar"><Minus size={15} /></button><button onClick={() => void withWindow('maximize')} aria-label="Maximizar"><Maximize2 size={13} /></button><button className="close" onClick={() => void withWindow('close')} aria-label="Fechar"><X size={15} /></button></div>
      </header>
      <div className="workspace">
        <Sidebar active={active} onChange={setActive} profile={data.profile} onLogout={() => void logout()} />
        <section className="content">
          <Topbar query={query} onQuery={setQuery} profileName={profileName} profile={data.profile} loading={loading} refresh={() => void refresh()} />
          {notice && <button className="notice" onClick={() => setNotice('')}>{notice}<X size={13} /></button>}
          <div className="surface-scroll">
            {active === 'home' && <Dashboard data={data} voice={voice} query={query} onNavigate={setActive} onJoin={enterVoice} activeLobby={activeLobby} setNotice={setNotice} />}
            {active === 'lobbies' && <LobbiesSurface lobbies={data.lobbies} query={query} profile={data.profile} onJoin={enterVoice} onRefresh={refresh} setNotice={setNotice} />}
            {active === 'communities' && <CommunitiesSurface communities={data.communities} profileName={profileName} onRefresh={refresh} setNotice={setNotice} />}
            {active === 'ranking' && <RankingSurface rows={data.leaderboard} query={query} />}
            {active === 'music' && <MusicSurface />}
            {active === 'store' && <StoreSurface profile={data.profile} onProfile={(profile) => setData((v) => ({ ...v, profile }))} setNotice={setNotice} />}
            {active === 'profile' && <ProfileSurface profile={data.profile} onProfile={(profile) => setData((v) => ({ ...v, profile }))} setNotice={setNotice} />}
            {active === 'settings' && <SettingsSurface preferences={data.preferences} onPreferences={(preferences) => setData((v) => ({ ...v, preferences }))} setNotice={setNotice} />}
          </div>
        </section>
      </div>
      {voice.lobbyCode && <CallDock voice={voice} lobby={activeLobby} profile={data.profile} preferences={data.preferences} setNotice={setNotice} />}
    </main>
  )
}

function Sidebar({ active, onChange, profile, onLogout }: { active: SectionId; onChange: (value: SectionId) => void; profile: GrindProfile | null; onLogout: () => void }) {
  return (
    <aside className="sidebar">
      <div className="logo-block"><img src={logoUrl} alt="GrindLobby" /><div><strong>GrindLobby</strong><span>JOGUE. CONECTE. EVOLUA.</span></div></div>
      <nav className="nav-list">
        {sections.map((item) => { const Icon = item.icon; return <button key={item.id} className={active === item.id ? 'nav-item active' : 'nav-item'} onClick={() => onChange(item.id)}><Icon size={18} /><span>{item.label}</span></button> })}
      </nav>
      <div className="sidebar-spacer" />
      <div className={isPro(profile) ? 'premium-card active' : 'premium-card'}><Crown size={20} /><div><strong>{isPro(profile) ? 'Premium ativo' : 'Seja Premium'}</strong><span>{isPro(profile) ? '1080p liberado' : '1080p e benefícios exclusivos'}</span></div></div>
      <button className="logout-button" onClick={onLogout}><LogOut size={16} /> Deslogar</button>
      <div className="version">GrindLobby Desktop V2 · 0.2.0</div>
    </aside>
  )
}

function Topbar({ query, onQuery, profileName, profile, loading, refresh }: { query: string; onQuery: (value: string) => void; profileName: string; profile: GrindProfile | null; loading: boolean; refresh: () => void }) {
  return (
    <div className="topbar">
      <label className="search-box"><Search size={16} /><input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Buscar jogadores, lobbies, comunidades..." /></label>
      <button className="icon-button" aria-label="Atualizar" onClick={refresh}><RefreshCw className={loading ? 'spin' : ''} size={16} /></button>
      <button className="icon-button" aria-label="Notificações"><Bell size={17} /><span className="badge-dot" /></button>
      <div className="mini-profile"><Avatar name={profileName} src={profile?.avatar} /><div><strong>{profileName}</strong><span>{isPro(profile) ? '★ Premium' : `Nível ${profile?.account_level || 1}`}</span></div></div>
    </div>
  )
}

function Avatar({ name, src, speaking = false }: { name: string; src?: string | null; speaking?: boolean }) {
  return <span className={speaking ? 'avatar speaking' : 'avatar'}>{src ? <img src={src} alt="" /> : initials(name)}</span>
}

function Dashboard({ data, voice, query, onNavigate, onJoin, activeLobby, setNotice }: { data: AppData; voice: VoiceSnapshot; query: string; onNavigate: (value: SectionId) => void; onJoin: (lobby: Lobby) => Promise<void>; activeLobby: Lobby | null; setNotice: (value: string) => void }) {
  const top = data.leaderboard.slice(0, 5)
  const lobbies = data.lobbies.filter((lobby) => lobby.name.toLowerCase().includes(query.toLowerCase()) || lobby.game.toLowerCase().includes(query.toLowerCase())).slice(0, 4)
  const profile = data.profile
  return (
    <div className="dashboard-grid">
      <article className="welcome-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(5,5,18,.94) 0%, rgba(5,5,18,.48) 45%, rgba(5,5,18,.12) 100%), url(${heroImage})` }}>
        <div><span className="eyebrow">GRIND HUB</span><h1>Bem-vindo ao<br />GrindLobby, <em>{profile?.display_name || profile?.username || 'Jogador'}</em></h1><p>Mais que lobbies. Uma comunidade que joga junto, evolui junto e chega mais longe.</p><div className="hero-actions"><button className="primary" onClick={() => onNavigate('lobbies')}>Encontrar Lobbies <ChevronRight size={16} /></button><button className="secondary" onClick={() => onNavigate('communities')}>Explorar Comunidades</button></div></div>
      </article>
      <article className="panel ranking-card"><CardTitle title="Top Elos da Semana" action="Ver ranking" onClick={() => onNavigate('ranking')} />{top.length ? top.map((row, index) => <div className="rank-row" key={row.id}><span className={`rank-number n${index + 1}`}>{index + 1}</span><Avatar name={row.display_name || row.username || 'GL'} src={row.avatar} /><div><strong>{row.display_name || row.username}</strong><span>{row.favorite_game || 'Competitivo'}</span></div><b>{Number(row.competitive_points || 0).toLocaleString('pt-BR')} PD</b></div>) : <Empty text="Nenhum jogador ranqueado ainda." />}</article>
      <article className="panel live-lobbies"><CardTitle title="Lobbies ao Vivo" action="Ver todos" onClick={() => onNavigate('lobbies')} />{lobbies.length ? lobbies.map((lobby) => <div className="lobby-row" key={lobby.id}><GameBadge game={lobby.game} /><div><strong>{lobby.name}</strong><span>{lobby.game} · {lobby.visibility === 'private' ? 'Privado' : 'Público'}</span></div><span className="members"><Users size={13} /> {lobby.members}/{lobby.maxMembers}</span><button className="tiny-primary" onClick={() => void onJoin(lobby)}>Entrar</button></div>) : <Empty text="Nenhum lobby aberto agora." />}</article>
      <article className="panel call-card"><CardTitle title="Chamada de Voz" action={voice.rttMs !== null ? `${voice.rttMs} ms` : voice.connected ? 'Conectado' : 'Offline'} /><div className="call-room"><div><span className={voice.connected ? 'status-dot online' : 'status-dot'} /><strong>{activeLobby?.name || voice.lobbyCode || 'Sem call ativa'}</strong><small>{voice.participants.length} na call</small></div></div><div className="participant-strip">{voice.participants.slice(0, 6).map((person) => <div key={person.id}><Avatar name={person.name} speaking={person.speaking} /><span>{person.name}</span></div>)}</div><VoiceButtons voice={voice} /></article>
      <article className="panel journey-card"><CardTitle title="Sua Jornada" action="Ver perfil" onClick={() => onNavigate('profile')} /><div className="journey"><img src={rankEmblem} alt="" /><div><span>Elo principal</span><strong>{profile?.competitive_points ? 'Competitivo' : 'Iniciante'}</strong><small>{Number(profile?.competitive_points || 0).toLocaleString('pt-BR')} PD</small></div></div><div className="stats-grid"><Stat label="Partidas" value={profile?.matches_played || 0} /><Stat label="Taxa de vitória" value={`${winRate(profile || {})}%`} /><Stat label="Vitórias" value={profile?.matches_won || 0} /><Stat label="Nível" value={profile?.account_level || 1} /></div></article>
      <article className="panel community-card"><CardTitle title="Comunidades" action="Abrir" onClick={() => onNavigate('communities')} /><div className="community-list">{data.communities.slice(0, 4).map((community) => <div key={community.id}><span className="community-icon">{initials(community.name)}</span><div><strong>{community.name}</strong><span>{community.tags.slice(0, 2).join(' · ') || community.role}</span></div></div>)}{!data.communities.length && <Empty text="Crie ou entre em uma Community." />}</div></article>
      <ScreenCard voice={voice} profile={profile} setNotice={setNotice} />
    </div>
  )
}

function CardTitle({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) { return <div className="card-title"><h2>{title}</h2>{action && <button onClick={onClick}>{action}{onClick && <ChevronRight size={13} />}</button>}</div> }
function Empty({ text }: { text: string }) { return <div className="empty-state">{text}</div> }
function Stat({ label, value }: { label: string; value: string | number }) { return <div><strong>{value}</strong><span>{label}</span></div> }
function GameBadge({ game }: { game: string }) { return <span className="game-badge">{initials(game)}</span> }

function VoiceButtons({ voice }: { voice: VoiceSnapshot }) {
  return <div className="voice-buttons"><button className={voice.muted ? 'round danger-soft' : 'round'} onClick={() => void voiceSession.setMuted(!voice.muted)}>{voice.muted ? <MicOff size={18} /> : <Mic size={18} />}</button><button className={voice.deafened ? 'round danger-soft' : 'round'} onClick={() => voiceSession.setDeafened(!voice.deafened)}>{voice.deafened ? <VolumeX size={18} /> : <Headphones size={18} />}</button><button className="round"><Settings size={17} /></button><button className="round hangup" onClick={() => void voiceSession.disconnect()}><Radio size={18} /></button></div>
}

function ScreenCard({ voice, profile, setNotice }: { voice: VoiceSnapshot; profile: GrindProfile | null; setNotice: (value: string) => void }) {
  const [preset, setPreset] = useState<StreamPreset>('720p30')
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = voice.localScreen }, [voice.localScreen])
  async function share(value: StreamPreset) {
    if (value.startsWith('1080') && !isPro(profile)) { setNotice('1080p é exclusivo do Grind Premium.'); return }
    try { setPreset(value); await voiceSession.startScreen(value) } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao compartilhar a tela.') }
  }
  return <article className="panel screen-card"><CardTitle title="Tela ao Vivo" action={voice.sharing ? 'AO VIVO' : 'Pronta'} />{voice.sharing ? <video ref={videoRef} autoPlay muted playsInline /> : <div className="screen-placeholder"><MonitorUp size={30} /><span>Entre em uma call e escolha a qualidade.</span></div>}<div className="quality-grid">{(['480p30','480p60','720p30','720p60','1080p30','1080p60'] as StreamPreset[]).map((value) => <button key={value} className={preset === value ? 'selected' : ''} disabled={value.startsWith('1080') && !isPro(profile)} onClick={() => void share(value)}>{value.replace('p', 'p ').replace('30','30 FPS').replace('60','60 FPS')}{value.startsWith('1080') && <Crown size={11} />}</button>)}</div>{voice.sharing && <button className="secondary wide" onClick={() => void voiceSession.stopScreen()}>Parar transmissão</button>}</article>
}

function LobbiesSurface({ lobbies, query, profile, onJoin, onRefresh, setNotice }: { lobbies: Lobby[]; query: string; profile: GrindProfile | null; onJoin: (lobby: Lobby) => Promise<void>; onRefresh: () => Promise<void>; setNotice: (value: string) => void }) {
  const [name, setName] = useState('Meu lobby')
  const [game, setGame] = useState('VALORANT')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [maxMembers, setMaxMembers] = useState(10)
  const [creating, setCreating] = useState(false)
  const visible = lobbies.filter((lobby) => `${lobby.name} ${lobby.game}`.toLowerCase().includes(query.toLowerCase()))
  async function create(event: FormEvent) { event.preventDefault(); setCreating(true); try { const result = await createLobby({ name, game, visibility, maxMembers }); setNotice(`Lobby ${result.route_code} criado.`); await onRefresh() } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao criar lobby.') } finally { setCreating(false) } }
  async function close(lobby: Lobby) { try { await closeLobby(lobby.id); await onRefresh(); setNotice('Lobby encerrado.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao encerrar lobby.') } }
  return <div className="page-grid"><section className="page-heading"><div><span className="eyebrow">MATCH HUB</span><h1>Lobbies</h1><p>Salas públicas e privadas ligadas ao backend real do Grind.</p></div></section><form className="panel create-lobby" onSubmit={create}><h2>Criar Lobby</h2><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do lobby" /><input value={game} onChange={(e) => setGame(e.target.value)} placeholder="Jogo" /><select value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}><option value="public">Público</option><option value="private">Privado</option></select><input type="number" min={2} max={50} value={maxMembers} onChange={(e) => setMaxMembers(Number(e.target.value))} /><button className="primary" disabled={creating}><Plus size={16} /> {creating ? 'Criando...' : 'Criar Lobby'}</button></form><section className="lobby-cards">{visible.map((lobby) => <article className="panel lobby-card" key={lobby.id}><div className="lobby-card-top"><GameBadge game={lobby.game} /><span className={lobby.visibility === 'private' ? 'privacy private' : 'privacy'}>{lobby.visibility === 'private' ? <LockKeyhole size={12} /> : <Radio size={12} />}{lobby.visibility}</span></div><h3>{lobby.name}</h3><p>{lobby.game}</p><div className="lobby-card-bottom"><span><Users size={14} /> {lobby.members}/{lobby.maxMembers}</span><button className="primary small" onClick={() => void onJoin(lobby)}>Entrar na call</button>{profile?.id === lobby.ownerId && <button className="ghost-danger" onClick={() => void close(lobby)}>Encerrar</button>}</div></article>)}{!visible.length && <Empty text="Nenhum lobby disponível com esse filtro." />}</section></div>
}

function CommunitiesSurface({ communities, profileName, onRefresh, setNotice }: { communities: Community[]; profileName: string; onRefresh: () => Promise<void>; setNotice: (value: string) => void }) {
  const [selectedId, setSelectedId] = useState(communities[0]?.id || '')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')
  useEffect(() => { if (!selectedId && communities[0]) setSelectedId(communities[0].id) }, [communities, selectedId])
  useEffect(() => { if (selectedId) void loadCommunityPosts(selectedId).then(setPosts).catch(() => setPosts([])) }, [selectedId])
  const selected = communities.find((item) => item.id === selectedId)
  async function create(event: FormEvent) { event.preventDefault(); try { const id = await createCommunity({ name: newName, description: newDescription, tags: ['gaming'] }); setNewName(''); setNewDescription(''); await onRefresh(); setSelectedId(id); setNotice('Community criada com ambientes padrão.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao criar Community.') } }
  async function invite() { if (!selected) return; try { const token = await createCommunityInvite(selected.id); await navigator.clipboard.writeText(token); setNotice('Convite copiado. Ele expira em 7 dias.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao gerar convite.') } }
  async function accept() { try { const id = await acceptCommunityInvite(inviteToken, profileName); setInviteToken(''); await onRefresh(); setSelectedId(id || ''); setNotice('Você entrou na Community.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Convite inválido.') } }
  async function publish(event: FormEvent) { event.preventDefault(); if (!selected) return; try { await createCommunityPost(selected.id, postTitle, postBody); setPostTitle(''); setPostBody(''); setPosts(await loadCommunityPosts(selected.id)) } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao publicar.') } }
  return <div className="communities-page"><section className="community-sidebar panel"><h2>Minhas Communities</h2>{communities.map((community) => <button key={community.id} className={selectedId === community.id ? 'community-select active' : 'community-select'} onClick={() => setSelectedId(community.id)}><span>{initials(community.name)}</span><div><strong>{community.name}</strong><small>{community.role}</small></div></button>)}<form className="community-create" onSubmit={create}><h3>Nova Community</h3><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome" /><textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Descrição" /><button className="primary small"><Plus size={14} /> Criar</button></form><div className="invite-join"><input value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} placeholder="Token de convite" /><button className="secondary small" onClick={() => void accept()}>Entrar</button></div></section><section className="community-main">{selected ? <><article className="community-hero panel" style={selected.bannerUrl ? { backgroundImage: `linear-gradient(90deg,rgba(5,5,18,.9),rgba(5,5,18,.35)),url(${selected.bannerUrl})` } : undefined}><span className="community-big-icon">{selected.logoUrl ? <img src={selected.logoUrl} alt="" /> : initials(selected.name)}</span><div><span className="eyebrow">GRIND FAM</span><h1>{selected.name}</h1><p>{selected.description}</p><div className="tag-row">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><button className="secondary" onClick={() => void invite()}><Copy size={15} /> Gerar convite</button></article><form className="panel post-form" onSubmit={publish}><input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="Título do post" /><textarea value={postBody} onChange={(e) => setPostBody(e.target.value)} placeholder="Compartilhe algo com a comunidade..." /><button className="primary small">Publicar</button></form><div className="posts">{posts.map((post) => <article className="panel post" key={post.id}><span className="post-type">{post.type}</span><h3>{post.title}</h3><p>{post.body}</p><small>{new Date(post.created_at).toLocaleString('pt-BR')}</small></article>)}{!posts.length && <Empty text="Nenhuma atividade nesta Community." />}</div></> : <Empty text="Selecione ou crie uma Community." />}</section></div>
}

function RankingSurface({ rows, query }: { rows: LeaderboardRow[]; query: string }) {
  const filtered = rows.filter((row) => `${row.display_name} ${row.username} ${row.favorite_game}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="ranking-page"><section className="page-heading"><div><span className="eyebrow">COMPETITIVE RANKING</span><h1>Top Elos</h1><p>Ranking alimentado pelo progresso real dos jogadores.</p></div></section><div className="podium">{filtered.slice(0, 3).map((row, index) => <article className={`podium-card p${index + 1}`} key={row.id}><span className="podium-place">#{index + 1}</span><Avatar name={row.display_name || row.username || 'GL'} src={row.avatar} /><h3>{row.display_name || row.username}</h3><strong>{Number(row.competitive_points || 0).toLocaleString('pt-BR')} PD</strong><small>{winRate(row)}% vitórias · {row.favorite_game || 'Competitivo'}</small></article>)}</div><section className="panel leaderboard-table">{filtered.map((row, index) => <div className="leader-row" key={row.id}><b>{index + 1}</b><Avatar name={row.display_name || row.username || 'GL'} src={row.avatar} /><div><strong>{row.display_name || row.username}</strong><span>{row.favorite_game || 'Sem jogo favorito'}</span></div><span>{row.matches_won || 0} vitórias</span><span>Nv. {row.account_level || 1}</span><strong>{Number(row.competitive_points || 0).toLocaleString('pt-BR')} PD</strong></div>)}</section></div>
}

function MusicSurface() {
  const [url, setUrl] = useState('')
  const [track, setTrack] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  function load(event: FormEvent) { event.preventDefault(); setTrack(url.trim()); setPlaying(false); requestAnimationFrame(() => void audioRef.current?.play().then(() => setPlaying(true)).catch(() => setPlaying(false))) }
  return <div className="music-page"><section className="page-heading"><div><span className="eyebrow">GRIND BEATS</span><h1>Música</h1><p>Player local real para links diretos de áudio. Não simula duração nem reprodução.</p></div></section><article className="panel music-player"><div className={playing ? 'disc playing' : 'disc'}><Music2 size={42} /></div><div className="music-info"><span>Tocando agora</span><h2>{track ? new URL(track, location.href).pathname.split('/').pop() || 'Áudio externo' : 'Nenhuma faixa carregada'}</h2><p>{track || 'Cole uma URL direta de MP3/AAC/OGG abaixo.'}</p><audio ref={audioRef} src={track || undefined} controls onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /></div></article><form className="panel music-add" onSubmit={load}><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://.../musica.mp3" /><button className="primary"><Play size={16} /> Reproduzir</button></form><div className="panel music-note"><ShieldCheck size={18} /><p>Spotify e YouTube exigem APIs/licenças próprias; por isso este módulo não finge reprodução desses serviços. O player acima toca mídia real suportada pelo WebView.</p></div></div>
}

const cosmetics = [
  { id: 'frame-eclipse', slot: 'avatar_frame', title: 'Frame Eclipse', asset: storeEffects },
  { id: 'banner-galactic', slot: 'profile_banner', title: 'Banner Galáctico', asset: storeBundles },
  { id: 'badge-competitive', slot: 'profile_badge', title: 'Badge Competitivo', asset: storeRank },
  { id: 'effect-violet', slot: 'profile_effect', title: 'Efeito Violet', asset: storeEffects },
]

function ownedSet(value: unknown) {
  if (Array.isArray(value)) return new Set(value.map(String))
  if (value && typeof value === 'object') return new Set(Object.keys(value as Record<string, unknown>).filter((key) => Boolean((value as Record<string, unknown>)[key])))
  return new Set<string>()
}

function StoreSurface({ profile, onProfile, setNotice }: { profile: GrindProfile | null; onProfile: (profile: GrindProfile) => void; setNotice: (value: string) => void }) {
  const owned = ownedSet(profile?.cosmetic_owned)
  async function equip(item: (typeof cosmetics)[number]) { try { const updated = await equipCosmetic(item.slot, item.id); onProfile(updated); setNotice(`${item.title} equipado.`) } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao equipar item.') } }
  return <div className="store-page"><section className="store-hero panel" style={{ backgroundImage: `linear-gradient(90deg,rgba(5,5,18,.88),rgba(5,5,18,.25)),url(${storeBundles})` }}><div><span className="eyebrow">GRIND STORE</span><h1>Bundles exclusivos</h1><p>Equipe seus cosméticos já liberados na conta.</p></div><Sparkles size={40} /></section><section className="store-grid">{cosmetics.map((item) => { const unlocked = profile?.app_role === 'admin' || owned.has(item.id); const equipped = String(profile?.cosmetic_equipped?.[item.slot] || '') === item.id; return <article className="panel store-item" key={item.id}><img src={item.asset} alt="" /><span>{equipped ? 'Equipado' : unlocked ? 'Disponível' : 'Bloqueado'}</span><h3>{item.title}</h3><button disabled={!unlocked || equipped} className={unlocked ? 'primary small' : 'secondary small'} onClick={() => void equip(item)}>{equipped ? 'Em uso' : unlocked ? 'Equipar' : 'Não adquirido'}</button></article> })}</section><article className="panel pro-banner"><Crown size={28} /><div><h2>Grind Premium</h2><p>1080p, cosméticos premium e prioridade de recursos. O checkout Pix só será exibido quando o provedor de cobrança estiver conectado server-side — sem botão de pagamento falso.</p></div><span className={isPro(profile) ? 'pro-status active' : 'pro-status'}>{isPro(profile) ? 'ATIVO' : 'FREE'}</span></article></div>
}

function ProfileSurface({ profile, onProfile, setNotice }: { profile: GrindProfile | null; onProfile: (profile: GrindProfile) => void; setNotice: (value: string) => void }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [favoriteGame, setFavoriteGame] = useState(profile?.favorite_game || '')
  const [region, setRegion] = useState(profile?.region || '')
  useEffect(() => { setDisplayName(profile?.display_name || ''); setBio(profile?.bio || ''); setFavoriteGame(profile?.favorite_game || ''); setRegion(profile?.region || '') }, [profile])
  async function save(event: FormEvent) { event.preventDefault(); try { const updated = await updateProfile({ display_name: displayName, bio, favorite_game: favoriteGame, region }); onProfile(updated); setNotice('Perfil atualizado.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao salvar perfil.') } }
  return <div className="profile-page"><article className="profile-hero panel" style={{ backgroundImage: profile?.profile_banner ? `linear-gradient(90deg,rgba(5,5,18,.88),rgba(5,5,18,.28)),url(${profile.profile_banner})` : `linear-gradient(90deg,rgba(5,5,18,.88),rgba(5,5,18,.28)),url(${heroImage})` }}><div className="profile-avatar-wrap"><Avatar name={profile?.display_name || profile?.username || 'GL'} src={profile?.avatar} /><span className="profile-level">{profile?.account_level || 1}</span></div><div><span className="eyebrow">PERFIL</span><h1>{profile?.display_name || profile?.username}</h1><p>@{profile?.username} · {profile?.favorite_game || 'Gamer'}</p></div>{isPro(profile) && <span className="premium-chip"><Crown size={13} /> Premium</span>}</article><div className="profile-columns"><form className="panel profile-form" onSubmit={save}><h2>Editar perfil</h2><label>Nome<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label><label>Bio<textarea value={bio} onChange={(e) => setBio(e.target.value)} /></label><label>Jogo favorito<input value={favoriteGame} onChange={(e) => setFavoriteGame(e.target.value)} /></label><label>Região<input value={region} onChange={(e) => setRegion(e.target.value)} /></label><button className="primary">Salvar alterações</button></form><article className="panel profile-stats"><h2>Competitivo</h2><img src={rankEmblem} alt="" /><Stat label="Pontos competitivos" value={Number(profile?.competitive_points || 0).toLocaleString('pt-BR')} /><Stat label="Vitórias" value={profile?.matches_won || 0} /><Stat label="Taxa de vitória" value={`${winRate(profile || {})}%`} /></article></div></div>
}

function SettingsSurface({ preferences, onPreferences, setNotice }: { preferences: DesktopPreferences | null; onPreferences: (preferences: DesktopPreferences) => void; setNotice: (value: string) => void }) {
  const [prefs, setPrefs] = useState<DesktopPreferences>(preferences || { show_online: true, allow_friend_requests: true, allow_messages_from_friends: true, desktop_settings: { outputVolume: 80, noiseSuppression: true, echoCancellation: true, autoGainControl: true } })
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  useEffect(() => { if (preferences) setPrefs(preferences) }, [preferences])
  useEffect(() => { void navigator.mediaDevices.enumerateDevices().then((devices) => { setInputs(devices.filter((device) => device.kind === 'audioinput')); setOutputs(devices.filter((device) => device.kind === 'audiooutput')) }).catch(() => {}) }, [])
  function desktop<K extends keyof DesktopPreferences['desktop_settings']>(key: K, value: DesktopPreferences['desktop_settings'][K]) { setPrefs((current) => ({ ...current, desktop_settings: { ...current.desktop_settings, [key]: value } })) }
  async function save() { try { await savePreferences(prefs); onPreferences(prefs); voiceSession.setOutput(prefs.desktop_settings.outputDeviceId || '', prefs.desktop_settings.outputVolume ?? 80); setNotice('Configurações salvas.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao salvar configurações.') } }
  return <div className="settings-page"><section className="page-heading"><div><span className="eyebrow">DESKTOP CONTROL</span><h1>Configurações</h1><p>Áudio, privacidade e comportamento persistidos na sua conta.</p></div></section><div className="settings-columns"><article className="panel settings-card"><h2>Áudio</h2><label>Microfone<select value={prefs.desktop_settings.inputDeviceId || ''} onChange={(e) => desktop('inputDeviceId', e.target.value)}><option value="">Padrão do sistema</option>{inputs.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microfone'}</option>)}</select></label><label>Saída<select value={prefs.desktop_settings.outputDeviceId || ''} onChange={(e) => desktop('outputDeviceId', e.target.value)}><option value="">Padrão do sistema</option>{outputs.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Saída'}</option>)}</select></label><label className="range-label"><span>Volume <b>{prefs.desktop_settings.outputVolume ?? 80}%</b></span><input type="range" min={0} max={100} value={prefs.desktop_settings.outputVolume ?? 80} onChange={(e) => desktop('outputVolume', Number(e.target.value))} /></label><Toggle label="Supressão de ruído" value={prefs.desktop_settings.noiseSuppression ?? true} onChange={(value) => desktop('noiseSuppression', value)} /><Toggle label="Cancelamento de eco" value={prefs.desktop_settings.echoCancellation ?? true} onChange={(value) => desktop('echoCancellation', value)} /><Toggle label="Ganho automático" value={prefs.desktop_settings.autoGainControl ?? true} onChange={(value) => desktop('autoGainControl', value)} /></article><article className="panel settings-card"><h2>Privacidade</h2><Toggle label="Mostrar status online" value={prefs.show_online} onChange={(value) => setPrefs((current) => ({ ...current, show_online: value }))} /><Toggle label="Permitir pedidos de amizade" value={prefs.allow_friend_requests} onChange={(value) => setPrefs((current) => ({ ...current, allow_friend_requests: value }))} /><Toggle label="Mensagens de amigos" value={prefs.allow_messages_from_friends} onChange={(value) => setPrefs((current) => ({ ...current, allow_messages_from_friends: value }))} /><Toggle label="Reduzir animações" value={prefs.desktop_settings.reduceMotion ?? false} onChange={(value) => desktop('reduceMotion', value)} /><button className="primary wide" onClick={() => void save()}>Salvar configurações</button></article></div></div>
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { return <button type="button" className="toggle-row" onClick={() => onChange(!value)}><span>{label}</span><i className={value ? 'toggle active' : 'toggle'}><b /></i></button> }

function CallDock({ voice, lobby, profile, preferences, setNotice }: { voice: VoiceSnapshot; lobby: Lobby | null; profile: GrindProfile | null; preferences: DesktopPreferences | null; setNotice: (value: string) => void }) {
  const [preset, setPreset] = useState<StreamPreset>('720p30')
  async function share() { if (preset.startsWith('1080') && !isPro(profile)) { setNotice('1080p é exclusivo do Grind Premium.'); return } try { if (voice.sharing) await voiceSession.stopScreen(); else await voiceSession.startScreen(preset) } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao compartilhar tela.') } }
  return <div className="call-dock"><div className="dock-status"><span className={voice.connected ? 'status-dot online' : 'status-dot'} /><div><strong>{voice.connected ? 'Chamada de Voz Ativa' : voice.connecting ? 'Conectando...' : 'Call desconectada'}</strong><span>{lobby?.name || voice.lobbyCode} {voice.rttMs !== null ? `· ${voice.rttMs} ms` : ''}</span></div></div><div className="dock-participants">{voice.participants.slice(0, 5).map((person) => <div key={person.id}><Avatar name={person.name} speaking={person.speaking} /><small>{person.name}</small></div>)}</div><div className="dock-controls"><button className={voice.muted ? 'round danger-soft' : 'round'} onClick={() => void voiceSession.setMuted(!voice.muted)}>{voice.muted ? <MicOff size={17} /> : <Mic size={17} />}</button><button className={voice.deafened ? 'round danger-soft' : 'round'} onClick={() => voiceSession.setDeafened(!voice.deafened)}>{voice.deafened ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><select value={preset} onChange={(e) => setPreset(e.target.value as StreamPreset)}><option value="480p30">480p 30</option><option value="480p60">480p 60</option><option value="720p30">720p 30</option><option value="720p60">720p 60</option>{isPro(profile) && <><option value="1080p30">1080p 30</option><option value="1080p60">1080p 60</option></>}</select><button className={voice.sharing ? 'round share active' : 'round share'} onClick={() => void share()}><MonitorUp size={17} /></button><button className="round hangup" onClick={() => void voiceSession.disconnect()}><Radio size={18} /></button></div><div className="dock-output"><Headphones size={14} /><span>{preferences?.desktop_settings.outputVolume ?? 80}%</span></div></div>
}

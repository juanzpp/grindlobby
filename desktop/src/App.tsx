import { useMemo, useState } from 'react'
import {
  Boxes,
  ChevronRight,
  Gamepad2,
  Home,
  Maximize2,
  MessageSquareText,
  Minus,
  Music2,
  ShieldCheck,
  ShoppingBag,
  Trophy,
  UserRound,
  X,
} from 'lucide-react'

const sections = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'lobbies', label: 'Lobbies', icon: Gamepad2 },
  { id: 'communities', label: 'Comunidades', icon: MessageSquareText },
  { id: 'ranking', label: 'Top Elos', icon: Trophy },
  { id: 'music', label: 'Música', icon: Music2 },
  { id: 'store', label: 'Loja', icon: ShoppingBag },
  { id: 'profile', label: 'Perfil', icon: UserRound },
] as const

type SectionId = (typeof sections)[number]['id']

async function withWindow(action: 'minimize' | 'maximize' | 'close') {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const window = getCurrentWindow()
  if (action === 'minimize') await window.minimize()
  if (action === 'maximize') await window.toggleMaximize()
  if (action === 'close') await window.close()
}

export default function App() {
  const [active, setActive] = useState<SectionId>('home')
  const section = useMemo(() => sections.find((item) => item.id === active)!, [active])

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="titlebar" data-tauri-drag-region>
        <div className="brand-mini" data-tauri-drag-region>
          <img src="/grindlobby-logo.png" alt="GrindLobby" />
          <span>GRINDLOBBY</span>
        </div>
        <div className="window-controls">
          <button aria-label="Minimizar" onClick={() => void withWindow('minimize')}><Minus size={15} /></button>
          <button aria-label="Maximizar" onClick={() => void withWindow('maximize')}><Maximize2 size={13} /></button>
          <button className="close" aria-label="Fechar" onClick={() => void withWindow('close')}><X size={15} /></button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="logo-block">
            <img src="/grindlobby-logo.png" alt="" />
            <div>
              <strong>GRIND</strong>
              <span>DESKTOP</span>
            </div>
          </div>

          <nav className="nav-list" aria-label="Navegação principal">
            {sections.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={active === item.id ? 'nav-item active' : 'nav-item'}
                  onClick={() => setActive(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="sidebar-status">
            <ShieldCheck size={17} />
            <div>
              <strong>Desktop nativo</strong>
              <span>Tauri 2 · runtime local</span>
            </div>
          </div>
        </aside>

        <section className="content">
          <div className="content-topline">
            <div>
              <span className="eyebrow">GRIND HUB</span>
              <h1>{section.label}</h1>
            </div>
            <div className="online-pill"><span /> Sistema online</div>
          </div>

          {active === 'home' ? <HomeSurface onNavigate={setActive} /> : <SectionSurface title={section.label} />}
        </section>
      </div>
    </main>
  )
}

function HomeSurface({ onNavigate }: { onNavigate: (section: SectionId) => void }) {
  return (
    <div className="home-grid">
      <article className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">SEU HUB COMPETITIVO</span>
          <h2>Jogue, converse e evolua sem sair do Grind.</h2>
          <p>Base desktop reconstruída para voz persistente, baixa latência e navegação independente do navegador.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => onNavigate('lobbies')}>Abrir lobbies <ChevronRight size={16} /></button>
            <button className="secondary" onClick={() => onNavigate('ranking')}>Ver ranking</button>
          </div>
        </div>
        <div className="portal-visual" aria-hidden="true">
          <div className="portal-ring ring-a" />
          <div className="portal-ring ring-b" />
          <div className="portal-core"><img src="/grindlobby-logo.png" alt="" /></div>
        </div>
      </article>

      <article className="metric-card">
        <div className="metric-icon"><Boxes size={20} /></div>
        <span>Lobbies</span>
        <strong>Pronto para integração</strong>
        <small>Camada desktop separada do site</small>
      </article>

      <article className="metric-card">
        <div className="metric-icon"><Gamepad2 size={20} /></div>
        <span>Voz e stream</span>
        <strong>LiveKit / SFU</strong>
        <small>Sessão persistente entre telas</small>
      </article>

      <article className="activity-card">
        <div className="card-heading">
          <div>
            <span className="eyebrow">ARQUITETURA</span>
            <h3>Desktop V2</h3>
          </div>
          <span className="version-badge">0.1.0</span>
        </div>
        <div className="activity-row"><span>Shell nativo Tauri</span><strong>ATIVO</strong></div>
        <div className="activity-row"><span>Navegação local</span><strong>ATIVO</strong></div>
        <div className="activity-row"><span>Integrações do Grind</span><strong>PRÓXIMA FASE</strong></div>
      </article>
    </div>
  )
}

function SectionSurface({ title }: { title: string }) {
  return (
    <div className="section-surface">
      <div className="section-orb" />
      <span className="eyebrow">MÓDULO DESKTOP</span>
      <h2>{title}</h2>
      <p>Esta superfície já faz parte do novo shell nativo. A lógica real deste módulo será ligada aos serviços atuais do Grind sem reutilizar a camada web como navegador embutido.</p>
    </div>
  )
}

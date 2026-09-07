const GAME_ICON: Record<string, string> = {
  valorant: '/game-icons/valorant.svg',
  'league of legends': '/game-icons/leagueoflegends.svg',
  lol: '/game-icons/leagueoflegends.svg',
}

const GAME_LABEL: Array<[RegExp, string]> = [
  [/valorant/i, 'VAL'],
  [/league|\blol\b/i, 'LOL'],
  [/counter|\bcs2\b|\bcsgo\b/i, 'CS2'],
  [/minecraft/i, 'MC'],
  [/fortnite/i, 'FN'],
  [/warzone|call of duty|\bcod\b/i, 'COD'],
  [/ea fc|fifa/i, 'FC'],
  [/rocket league/i, 'RL'],
]

function text(node: Element | null) {
  return (node?.textContent || '').trim()
}

function setText(node: Element | null, value: string) {
  if (node && text(node) !== value) node.textContent = value
}

function setHtml(node: HTMLElement | null, value: string) {
  if (node && node.innerHTML !== value) node.innerHTML = value
}

function normalizeGame(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function gameLabel(value: string) {
  return GAME_LABEL.find(([pattern]) => pattern.test(value))?.[1] || value.trim().slice(0, 4).toUpperCase()
}

function navigate(label: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.v3-sidebar nav button'))
    .find((item) => text(item).toLowerCase() === label.toLowerCase())
  button?.click()
}

function patchGameMarks() {
  const rows = document.querySelectorAll<HTMLElement>('.v3-lobby-card, .v3-lobby-line')
  rows.forEach((row) => {
    const game = text(row.querySelector('.v3-lobby-card-art strong')) || text(row.querySelector('.v3-lobby-line > div strong + span')) || text(row.querySelector('.v3-lobby-line > div span')).split('·')[0].trim()
    const mark = row.querySelector<HTMLElement>('.v3-game-mark')
    if (!mark || !game || mark.dataset.realGame === game) return
    mark.dataset.realGame = game
    mark.title = game
    const icon = GAME_ICON[normalizeGame(game)]
    if (icon) {
      mark.replaceChildren()
      const image = document.createElement('img')
      image.src = icon
      image.alt = ''
      image.setAttribute('aria-hidden', 'true')
      mark.appendChild(image)
    } else {
      mark.textContent = gameLabel(game)
      mark.classList.add('real-game-label')
    }
  })
}

function patchHome() {
  document.querySelectorAll('.v3-now-playing,.v3-store-highlight').forEach((node) => node.remove())
  document.querySelectorAll('.v3-dock-music').forEach((node) => node.remove())

  setText(document.querySelector('.v3-community-feed .v3-panel-title h2'), 'Suas Comunidades')
  document.querySelectorAll<HTMLElement>('.v3-community-feed p').forEach((item) => {
    const name = text(item.querySelector('strong'))
    if (name) setHtml(item, `<strong>${name}</strong> · você faz parte desta comunidade.`)
  })

  const journey = document.querySelector('.v3-journey-main')
  if (journey) {
    setText(journey.querySelector('span'), 'Grind Rating')
    setText(journey.querySelector('strong'), 'Pontuação competitiva')
  }

  const publicButton = document.querySelector<HTMLButtonElement>('.v3-live-lobbies .v3-filter-pills button:first-child')
  const privateButton = document.querySelector<HTMLButtonElement>('.v3-live-lobbies .v3-filter-pills button:nth-child(2)')
  if (publicButton && !publicButton.dataset.realAction) {
    publicButton.dataset.realAction = '1'
    publicButton.addEventListener('click', () => navigate('Lobbies'))
  }
  if (privateButton && !privateButton.dataset.realAction) {
    privateButton.dataset.realAction = '1'
    privateButton.addEventListener('click', () => {
      navigate('Lobbies')
      window.setTimeout(() => {
        const privateTab = Array.from(document.querySelectorAll<HTMLButtonElement>('.v3-lobby-tabs button')).find((button) => /privados/i.test(text(button)))
        privateTab?.click()
      }, 30)
    })
  }
}

function patchVoice() {
  const settingsButton = document.querySelector<HTMLButtonElement>('.v3-voice-actions button:nth-child(3)')
  if (settingsButton && !settingsButton.dataset.realAction) {
    settingsButton.dataset.realAction = '1'
    settingsButton.title = 'Abrir configurações de áudio'
    settingsButton.setAttribute('aria-label', 'Abrir configurações de áudio')
    settingsButton.addEventListener('click', () => navigate('Configurações'))
  }
}

function parseMembers(card: Element) {
  const raw = text(card.querySelector('.v3-lobby-card-art b'))
  const match = raw.match(/(\d+)\s*\/\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

function patchLobbyFilters() {
  const bar = document.querySelector<HTMLElement>('.v3-lobby-filters')
  const grid = document.querySelector<HTMLElement>('.v3-lobby-grid')
  if (!bar || !grid || bar.dataset.realFilters === '1') return

  bar.dataset.realFilters = '1'
  const cards = () => Array.from(grid.querySelectorAll<HTMLElement>('.v3-lobby-card'))
  const games = Array.from(new Set(cards().map((card) => text(card.querySelector('.v3-lobby-card-art strong'))).filter(Boolean))).sort((a, b) => a.localeCompare(b))

  const game = document.createElement('select')
  game.className = 'v3-real-select'
  game.setAttribute('aria-label', 'Filtrar por jogo')
  game.innerHTML = `<option value="">Todos os jogos</option>${games.map((value) => `<option value="${value.replace(/"/g, '&quot;')}">${value}</option>`).join('')}`

  const order = document.createElement('select')
  order.className = 'v3-real-select'
  order.setAttribute('aria-label', 'Ordenar lobbies')
  order.innerHTML = '<option value="active">Mais ativos</option><option value="slots">Mais vagas</option><option value="name">Nome A–Z</option>'

  const refresh = document.createElement('button')
  refresh.type = 'button'
  refresh.className = 'v3-real-filter-button'
  refresh.textContent = 'Atualizar'
  refresh.addEventListener('click', () => window.location.reload())

  function apply() {
    const selected = normalizeGame(game.value)
    const list = cards()
    list.forEach((card) => {
      const cardGame = normalizeGame(text(card.querySelector('.v3-lobby-card-art strong')))
      card.hidden = Boolean(selected && cardGame !== selected)
    })
    const visible = list.filter((card) => !card.hidden)
    visible.sort((a, b) => {
      if (order.value === 'name') return text(a.querySelector('h3')).localeCompare(text(b.querySelector('h3')))
      const aMembers = parseMembers(a)
      const bMembers = parseMembers(b)
      if (order.value === 'slots') {
        const aRaw = text(a.querySelector('.v3-lobby-card-art b')).match(/(\d+)\s*\/\s*(\d+)/)
        const bRaw = text(b.querySelector('.v3-lobby-card-art b')).match(/(\d+)\s*\/\s*(\d+)/)
        const aSlots = aRaw ? Number(aRaw[2]) - Number(aRaw[1]) : 0
        const bSlots = bRaw ? Number(bRaw[2]) - Number(bRaw[1]) : 0
        return bSlots - aSlots
      }
      return bMembers - aMembers
    })
    visible.forEach((card) => grid.appendChild(card))
  }

  game.addEventListener('change', apply)
  order.addEventListener('change', apply)
  bar.replaceChildren(game, order, refresh)

  document.querySelectorAll('.v3-lobby-card .v3-tags').forEach((tags) => {
    const first = tags.querySelector('span:first-child')
    if (first && /competitivo/i.test(text(first))) first.remove()
  })
  document.querySelectorAll('.v3-mini-avatars').forEach((node) => node.remove())
}

function patchCommunitiesFromLobby() {
  const aside = document.querySelector<HTMLElement>('.v3-featured-communities')
  if (!aside) return
  setText(aside.querySelector('.v3-panel-title h2'), 'Suas Comunidades')

  const rows = aside.querySelectorAll('.v3-community-row')
  const featured = aside.querySelector<HTMLElement>('.v3-featured-main')
  if (!rows.length && featured) featured.remove()

  aside.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    if (button.dataset.realAction) return
    button.dataset.realAction = '1'
    if (/ver todas|entrar|abrir/i.test(text(button))) {
      button.textContent = /ver todas/i.test(text(button)) ? 'Ver todas' : 'Abrir'
      button.addEventListener('click', () => navigate('Comunidades'))
    }
  })
}

function patchNotifications() {
  const bell = document.querySelector<HTMLButtonElement>('.v3-bell')
  if (!bell) return
  if (bell.title !== 'Atualizar dados') bell.title = 'Atualizar dados'
  if (bell.getAttribute('aria-label') !== 'Atualizar dados') bell.setAttribute('aria-label', 'Atualizar dados')
  bell.querySelector('i')?.remove()
}

function patchSearch() {
  const input = document.querySelector<HTMLInputElement>('.v3-search input')
  if (!input) return
  const placeholder = 'Filtrar lobbies e ranking...'
  if (input.placeholder !== placeholder) input.placeholder = placeholder
}

function patchPremium() {
  const card = document.querySelector<HTMLButtonElement>('.v3-premium-card')
  if (!card || card.dataset.realPremium === '1' || /premium ativo/i.test(text(card))) return
  card.dataset.realPremium = '1'
  card.title = 'Abrir checkout Premium via Pix'
  card.addEventListener('click', () => {
    window.setTimeout(() => {
      const checkout = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => button !== card && /premium\s*(?:via pix|·)/i.test(text(button)))
      checkout?.click()
    }, 80)
  })
}

function patchAchievements() {
  const section = document.querySelector<HTMLElement>('.v3-achievements')
  if (!section || section.dataset.realAchievements === '1') return
  section.dataset.realAchievements = '1'

  const stats = Array.from(document.querySelectorAll<HTMLElement>('.v3-profile-stats > div'))
  const byLabel = new Map(stats.map((item) => [text(item.querySelector('span')).toLowerCase(), text(item.querySelector('strong'))]))
  const wins = Number((byLabel.get('vitórias') || '0').replace(/\D/g, ''))
  const matches = Number((byLabel.get('partidas') || '0').replace(/\D/g, ''))
  const level = Number((byLabel.get('nível') || '0').replace(/\D/g, ''))

  const achievements = [
    { title: 'Primeira vitória', current: wins, target: 1 },
    { title: '10 vitórias', current: wins, target: 10 },
    { title: '100 partidas', current: matches, target: 100 },
    { title: 'Nível 10', current: level, target: 10 },
  ]

  const heading = document.createElement('h3')
  heading.textContent = 'Conquistas reais'
  const list = document.createElement('div')
  achievements.forEach((achievement) => {
    const unlocked = achievement.current >= achievement.target
    const article = document.createElement('article')
    article.className = 'v3-panel'
    article.innerHTML = `<span>${unlocked ? '✓' : '◇'}</span><strong>${achievement.title}</strong><small>${unlocked ? 'Desbloqueada' : `${Math.min(achievement.current, achievement.target)}/${achievement.target}`}</small>`
    list.appendChild(article)
  })
  section.replaceChildren(heading, list)
}

function patchProfileRating() {
  const rank = document.querySelector<HTMLElement>('.v3-profile-ranks')
  if (!rank) return
  setText(rank.querySelector('small'), 'Grind Rating')
  setText(rank.querySelector('strong'), 'Pontuação competitiva')
}

function patchStore() {
  const store = document.querySelector<HTMLElement>('.v3-store-side')
  if (!store || store.dataset.realStore === '1') return
  store.dataset.realStore = '1'

  setText(store.querySelector('.v3-store-head h1'), 'Inventário')
  setText(store.querySelector('.v3-store-head p'), 'Somente itens realmente vinculados à sua conta aparecem aqui.')
  setText(store.querySelector('.v3-store-hero h2'), 'COSMÉTICOS DA SUA CONTA')
  setText(store.querySelector('.v3-store-hero p'), 'Equipe somente itens realmente adquiridos e vinculados ao seu perfil.')
  store.querySelector('.v3-store-head > button')?.remove()
  store.querySelector('.v3-store-tabs')?.remove()
  store.querySelector('.v3-store-compact')?.remove()
  store.querySelector('.v3-store-guarantees')?.remove()
  store.querySelector('.v3-store-hero button')?.remove()

  const titles = Array.from(store.querySelectorAll<HTMLElement>('.v3-store-title'))
  if (titles[0]) {
    setText(titles[0].querySelector('h2'), 'Itens disponíveis na sua conta')
    titles[0].querySelector('button')?.remove()
  }
  titles.slice(1).forEach((item) => item.remove())

  const grid = store.querySelector<HTMLElement>('.v3-store-grid')
  if (!grid) return
  const items = Array.from(grid.querySelectorAll<HTMLElement>('.v3-store-item'))
  items.forEach((item) => {
    const button = item.querySelector<HTMLButtonElement>('button:last-child')
    if (!button) return
    if (/^comprar$/i.test(text(button))) item.remove()
  })
  if (!grid.querySelector('.v3-store-item')) {
    const empty = document.createElement('div')
    empty.className = 'v3-empty v3-real-inventory-empty'
    empty.textContent = 'Nenhum cosmético adquirido ainda. O checkout de itens só será exibido quando o catálogo Pix estiver publicado no backend.'
    grid.appendChild(empty)
  }
}

function patchMusic() {
  const page = document.querySelector<HTMLElement>('.v3-music')
  if (!page || page.dataset.realMusic === '1') return
  page.dataset.realMusic = '1'
  setText(page.querySelector('.v3-music-hero h1'), 'Player de Áudio')
  setText(page.querySelector('.v3-music-hero p'), 'Reprodução dentro do GrindLobby, sem abrir navegador externo.')

  const form = page.querySelector<HTMLFormElement>('.v3-music-add')
  const audio = page.querySelector<HTMLAudioElement>('audio')
  if (!form || !audio) return

  const picker = document.createElement('input')
  picker.type = 'file'
  picker.accept = 'audio/*'
  picker.hidden = true
  const open = document.createElement('button')
  open.type = 'button'
  open.className = 'v3-secondary v3-local-audio'
  open.textContent = 'Abrir áudio do PC'
  open.addEventListener('click', () => picker.click())
  picker.addEventListener('change', () => {
    const file = picker.files?.[0]
    if (!file) return
    audio.src = URL.createObjectURL(file)
    void audio.play()
    setText(page.querySelector('.v3-music-player h2'), file.name)
    setText(page.querySelector('.v3-music-player p'), `${(file.size / 1024 / 1024).toFixed(1)} MB · arquivo local`)
  })
  form.prepend(picker, open)
}

function patchAll() {
  patchGameMarks()
  patchHome()
  patchVoice()
  patchLobbyFilters()
  patchCommunitiesFromLobby()
  patchNotifications()
  patchSearch()
  patchPremium()
  patchAchievements()
  patchProfileRating()
  patchStore()
  patchMusic()
}

let scheduled = false
function schedulePatch() {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(() => {
    scheduled = false
    patchAll()
  })
}

export function installRealMode() {
  patchAll()
  const observer = new MutationObserver(schedulePatch)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  return () => observer.disconnect()
}

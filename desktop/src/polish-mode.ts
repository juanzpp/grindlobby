function value(node: Element | null) {
  return (node?.textContent || '').trim()
}

function setText(node: Element | null, next: string) {
  if (node && value(node) !== next) node.textContent = next
}

function patchMusic() {
  const page = document.querySelector<HTMLElement>('.v3-music')
  if (!page) return

  const detail = page.querySelector('.v3-music-player p')
  if (detail && /webview/i.test(value(detail))) {
    setText(detail, 'Cole uma URL direta de áudio ou abra um arquivo do PC.')
  }

  const form = page.querySelector<HTMLFormElement>('.v3-music-add')
  const urlInput = form?.querySelector<HTMLInputElement>('input:not([type=file])')
  const submit = form?.querySelector<HTMLButtonElement>('button[type=submit],button.v3-primary')
  if (urlInput && submit && !urlInput.dataset.realValidation) {
    urlInput.dataset.realValidation = '1'
    const sync = () => {
      submit.disabled = !urlInput.value.trim()
      submit.title = submit.disabled ? 'Cole uma URL de áudio para reproduzir.' : 'Reproduzir URL de áudio'
    }
    urlInput.addEventListener('input', sync)
    sync()
  }
}

function patchCommunities() {
  const page = document.querySelector<HTMLElement>('.v3-communities')
  if (!page) return

  page.querySelectorAll<HTMLElement>('.v3-community-nav small').forEach((role) => {
    const raw = value(role).toLowerCase()
    if (raw === 'owner') setText(role, 'Dono')
    else if (raw === 'member') setText(role, 'Membro')
    else if (raw === 'moderator') setText(role, 'Moderador')
    else if (raw === 'admin') setText(role, 'Administrador')
  })

  page.querySelectorAll<HTMLElement>('.v3-post-grid article > small').forEach((type) => {
    const raw = value(type).toLowerCase()
    if (raw === 'post') setText(type, 'Publicação')
  })

  const inviteInput = page.querySelector<HTMLInputElement>('.v3-invite-box input')
  const inviteButton = page.querySelector<HTMLButtonElement>('.v3-invite-box button')
  if (inviteInput && inviteButton && !inviteInput.dataset.realValidation) {
    inviteInput.dataset.realValidation = '1'
    const sync = () => {
      inviteButton.disabled = !inviteInput.value.trim()
      inviteButton.title = inviteButton.disabled ? 'Cole um token de convite.' : 'Entrar com convite'
    }
    inviteInput.addEventListener('input', sync)
    sync()
  }

  const compose = page.querySelector<HTMLElement>('.v3-post-compose')
  const textarea = compose?.querySelector<HTMLTextAreaElement>('textarea')
  const publish = compose?.querySelector<HTMLButtonElement>('button')
  if (textarea && publish && !textarea.dataset.realValidation) {
    textarea.dataset.realValidation = '1'
    const sync = () => {
      publish.disabled = !textarea.value.trim()
      publish.title = publish.disabled ? 'Escreva algo antes de publicar.' : 'Publicar na comunidade'
    }
    textarea.addEventListener('input', sync)
    sync()
  }
}

function patchProfile() {
  const profile = document.querySelector<HTMLElement>('.v3-profile-side')
  if (!profile) return
  const edit = profile.querySelector<HTMLButtonElement>('.v3-profile-name > button')
  if (edit) {
    edit.classList.add('v3-real-edit-profile')
    edit.title = 'Editar nome do perfil'
  }
}

function patchInventory() {
  const empty = document.querySelector<HTMLElement>('.v3-real-inventory-empty')
  if (empty) {
    setText(empty, 'Nenhum cosmético na sua conta. Quando novos itens estiverem disponíveis, eles aparecerão aqui.')
  }
}

function patchOfflineVoice() {
  const card = document.querySelector<HTMLElement>('.v3-voice-card')
  if (!card) return
  const offline = /offline/i.test(value(card.querySelector('.v3-panel-title button'))) || /sem call ativa/i.test(value(card.querySelector('.v3-room-name strong')))
  const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>('.v3-voice-actions button'))
  buttons.forEach((button, index) => {
    if (index === 2) return
    button.disabled = offline
    if (offline) button.title = 'Entre em uma call para usar este controle.'
    else button.removeAttribute('title')
  })
}

function patchSidebarPremium() {
  const card = document.querySelector<HTMLButtonElement>('.v3-premium-card')
  if (!card) return
  if (/premium ativo/i.test(value(card))) {
    card.disabled = false
    card.title = 'Abrir inventário Premium'
    card.setAttribute('aria-label', 'Premium ativo — abrir inventário')
  }
}

function patchAll() {
  patchMusic()
  patchCommunities()
  patchProfile()
  patchInventory()
  patchOfflineVoice()
  patchSidebarPremium()
}

let scheduled = false
function schedule() {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(() => {
    scheduled = false
    patchAll()
  })
}

export function installPolishMode() {
  patchAll()
  const observer = new MutationObserver(schedule)
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })
  return () => observer.disconnect()
}

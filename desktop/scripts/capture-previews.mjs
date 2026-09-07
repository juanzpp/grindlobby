import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const UID = '11111111-1111-4111-8111-111111111111'
const SUPABASE = 'https://eilaxaklqgyvgjgpkonv.supabase.co'
const now = Math.floor(Date.now() / 1000)
const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
const token = `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ aud: 'authenticated', exp: now + 7200, iat: now, sub: UID, role: 'authenticated', email: 'preview@grindlobby.app' })}.preview`
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'preview@grindlobby.app', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { username: 'Snowzin', display_name: 'Snowzin' }, identities: [], created_at: new Date().toISOString() }
const session = { access_token: token, refresh_token: 'preview-refresh-token', expires_in: 7200, expires_at: now + 7200, token_type: 'bearer', user }

const profile = { id: UID, username: 'snowzin', display_name: 'Snowzin', avatar: null, status: 'online', account_tier: 'pro', app_role: 'user', account_level: 78, account_xp: 3240, profile_banner: null, avatar_frame: 'eclipse', profile_effect: 'nebula', profile_badge: 'veteran', profile_card_style: 'galactic', cosmetic_owned: ['eclipse','nebula','veteran'], cosmetic_equipped: { frame: 'eclipse', effect: 'nebula' }, competitive_points: 922, matches_played: 214, matches_won: 133, bio: 'Boa call, bora mais uma?', favorite_game: 'Valorant', region: 'BR' }
const leaderboard = [
  ['Snowzin',1842,92,'Valorant'],['Kenzin',1620,88,'Valorant'],['Lunaa',1415,84,'League of Legends'],['Raffcth',1398,79,'CS2'],['Sayurii',1276,75,'Valorant'],['Caiofps',1188,71,'CS2']
].map((x,i)=>({ id:`00000000-0000-4000-8000-00000000000${i+1}`, username:String(x[0]).toLowerCase(), display_name:x[0], avatar:null, account_level:x[2], competitive_points:x[1], matches_played:180-i*11, matches_won:115-i*8, favorite_game:x[3] }))
const lobbyRows = [
  ['l1','GL-VLR001','Rankeada - Focus & Win','VALORANT','public',5],
  ['l2','GL-LOL002','Flex 5v5 - Time fechado','League of Legends','public',5],
  ['l3','GL-CS2003','Competitivo - Mirage Only','CS2','public',5],
  ['l4','GL-MC0004','Mundo dos Inscritos','Minecraft','public',12],
  ['l5','GL-FN0005','Duplas - Build','Fortnite','public',4],
  ['l6','GL-COD006','Squad BR - Urzikstan','Call of Duty','private',4]
].map((x,i)=>({ id:x[0], owner_id:i===0?UID:`owner-${i}`, route_code:x[1], name:x[2], game_label:x[3], visibility:x[4], max_members:x[5], status:'open', updated_at:new Date(Date.now()-i*60000).toISOString() }))
const memberRows = lobbyRows.flatMap((l,i)=>Array.from({length:Math.min(Number(l.max_members)-1, i+2)},()=>({lobby_id:l.id})))
const communities = [
  { id:'c1', owner_id:UID, name:'GrindLobby Oficial', description:'A maior comunidade de gamers do Brasil.', logo_url:null, banner_url:null, privacy:'public', tags:['geral','competitivo'] },
  { id:'c2', owner_id:'owner-2', name:'VALORANT BR', description:'Rank, dicas e agentes dedicados.', logo_url:null, banner_url:null, privacy:'public', tags:['valorant','ranked'] },
  { id:'c3', owner_id:'owner-3', name:'League of Legends BR', description:'Estratégia, times e campeonatos.', logo_url:null, banner_url:null, privacy:'public', tags:['lol','flex'] }
]
const communityMembers = communities.map((c,i)=>({ role:i===0?'owner':'member', communities:c }))
const posts = [
  { id:'p1', community_id:'c1', author_id:UID, type:'post', title:'Rumo ao Desafiante!', body:'Fechando lobby competitivo hoje.', media_url:null, created_at:new Date().toISOString() },
  { id:'p2', community_id:'c1', author_id:'owner-2', type:'post', title:'Scrim aberta', body:'Procurando time para MD3.', media_url:null, created_at:new Date(Date.now()-600000).toISOString() }
]
const prefs = { show_online:true, allow_friend_requests:true, allow_messages_from_friends:true, desktop_settings:{ outputVolume:80, noiseSuppression:true, echoCancellation:true, autoGainControl:true, reduceMotion:false, closeToTray:true } }

const json = (route, body, status=200) => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(body) })

await mkdir('preview-captures', { recursive:true })
const browser = await chromium.launch({ headless:true })
const context = await browser.newContext({ viewport:{ width:1536, height:864 }, deviceScaleFactor:1 })
await context.addInitScript(({ session }) => {
  localStorage.setItem('grind:desktop:remember','local')
  localStorage.setItem('sb-eilaxaklqgyvgjgpkonv-auth-token', JSON.stringify(session))
}, { session })

await context.route(`${SUPABASE}/**`, async (route) => {
  const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const method = req.method()
  if (p === '/auth/v1/user') return json(route, user)
  if (p.includes('/rest/v1/rpc/cleanup_stale_lobbies')) return json(route, null)
  if (p.includes('/rest/v1/profiles')) return json(route, method === 'GET' ? profile : profile)
  if (p.includes('/rest/v1/leaderboard_profiles')) return json(route, leaderboard)
  if (p.includes('/rest/v1/lobbies')) return json(route, lobbyRows)
  if (p.includes('/rest/v1/lobby_members')) return json(route, memberRows)
  if (p.includes('/rest/v1/community_members')) return json(route, communityMembers)
  if (p.includes('/rest/v1/community_posts')) return json(route, posts)
  if (p.includes('/rest/v1/user_preferences')) return json(route, prefs)
  if (p.includes('/functions/v1/')) return json(route, { configured:false })
  return json(route, [])
})

const page = await context.newPage()
await page.goto('http://127.0.0.1:4173', { waitUntil:'networkidle' })
await page.waitForTimeout(1400)

const shots = [
  ['01-inicio.png', null],
  ['02-lobbies.png', 'Lobbies'],
  ['03-comunidades.png', 'Comunidades'],
  ['04-top-elos.png', 'Top Elos'],
  ['05-musica.png', 'Música'],
  ['06-loja.png', 'Loja'],
  ['07-perfil.png', 'Perfil'],
  ['08-configuracoes.png', 'Configurações'],
]
for (const [file, label] of shots) {
  if (label) {
    await page.getByRole('button', { name:label, exact:true }).first().click()
    await page.waitForTimeout(650)
  }
  await page.screenshot({ path:`preview-captures/${file}`, fullPage:false })
}
await browser.close()

import { supabase } from './supabase'

export type GrindProfile = {
  id: string
  username: string
  display_name: string
  avatar: string | null
  status: string | null
  account_tier: string | null
  app_role: string | null
  account_level: number
  account_xp: number
  profile_banner: string | null
  avatar_frame: string | null
  profile_effect: string | null
  profile_badge: string | null
  profile_card_style: string | null
  cosmetic_owned: unknown
  cosmetic_equipped: Record<string, unknown> | null
  competitive_points: number
  matches_played: number
  matches_won: number
  bio: string | null
  favorite_game: string | null
  region: string | null
}

export type LeaderboardRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar: string | null
  account_level: number | null
  competitive_points: number | null
  matches_played: number | null
  matches_won: number | null
  favorite_game: string | null
}

export type Lobby = {
  id: string
  routeCode: string
  ownerId: string
  name: string
  game: string
  visibility: 'public' | 'private'
  maxMembers: number
  members: number
  status: string
}

export type Community = {
  id: string
  ownerId: string
  name: string
  description: string
  logoUrl: string | null
  bannerUrl: string | null
  privacy: string
  tags: string[]
  role: string
}

export type CommunityPost = {
  id: string
  community_id: string
  author_id: string
  type: string
  title: string
  body: string
  media_url: string | null
  created_at: string
}

export type DesktopPreferences = {
  show_online: boolean
  allow_friend_requests: boolean
  allow_messages_from_friends: boolean
  desktop_settings: {
    inputDeviceId?: string
    outputDeviceId?: string
    outputVolume?: number
    noiseSuppression?: boolean
    echoCancellation?: boolean
    autoGainControl?: boolean
    reduceMotion?: boolean
    closeToTray?: boolean
  }
}

const PROFILE_FIELDS =
  'id,username,display_name,avatar,status,account_tier,app_role,account_level,account_xp,profile_banner,avatar_frame,profile_effect,profile_badge,profile_card_style,cosmetic_owned,cosmetic_equipped,competitive_points,matches_played,matches_won,bio,favorite_game,region'

async function requireUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Sessão expirada. Entre novamente.')
  return data.user
}

export async function loadProfile() {
  const user = await requireUser()
  const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', user.id).single()
  if (error) throw error
  return data as GrindProfile
}

export async function updateProfile(values: Partial<Pick<GrindProfile, 'display_name' | 'bio' | 'favorite_game' | 'region'>>) {
  const user = await requireUser()
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select(PROFILE_FIELDS)
    .single()
  if (error) throw error
  return data as GrindProfile
}

export async function heartbeatProfile(online = true) {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  await supabase
    .from('profiles')
    .update({ status: online ? 'online' : 'offline', last_seen_at: new Date().toISOString() })
    .eq('id', data.user.id)
}

export async function loadLeaderboard(limit = 20) {
  const { data, error } = await supabase
    .from('leaderboard_profiles')
    .select('id,username,display_name,avatar,account_level,competitive_points,matches_played,matches_won,favorite_game')
    .order('competitive_points', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as LeaderboardRow[]
}

export async function loadLobbies() {
  await supabase.rpc('cleanup_stale_lobbies')
  const { data, error } = await supabase
    .from('lobbies')
    .select('id,owner_id,route_code,name,game_label,visibility,max_members,status,updated_at')
    .neq('status', 'closed')
    .order('updated_at', { ascending: false })
    .limit(60)
  if (error) throw error

  const ids = (data || []).map((row: any) => row.id)
  const countMap = new Map<string, number>()
  if (ids.length) {
    const { data: members } = await supabase.from('lobby_members').select('lobby_id').in('lobby_id', ids)
    for (const member of members || []) countMap.set(member.lobby_id, (countMap.get(member.lobby_id) || 0) + 1)
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    routeCode: row.route_code || row.id,
    ownerId: row.owner_id,
    name: row.name,
    game: row.game_label || 'Outro',
    visibility: row.visibility === 'private' ? 'private' : 'public',
    maxMembers: row.max_members || 10,
    members: countMap.get(row.id) || 0,
    status: row.status,
  })) as Lobby[]
}

export async function createLobby(input: { name: string; game: string; visibility: 'public' | 'private'; maxMembers: number }) {
  const user = await requireUser()
  const routeCode = `GL-${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`
  const { data, error } = await supabase
    .from('lobbies')
    .insert({
      owner_id: user.id,
      name: input.name.trim() || 'Meu lobby',
      game_label: input.game.trim() || 'Outro',
      visibility: input.visibility,
      max_members: Math.max(2, Math.min(50, input.maxMembers || 10)),
      status: 'open',
      route_code: routeCode,
    })
    .select('id,owner_id,route_code,name,game_label,visibility,max_members,status')
    .single()
  if (error) throw error

  const { error: memberError } = await supabase.rpc('join_lobby_member', {
    p_lobby_id: data.id,
    p_user_id: user.id,
  })
  if (memberError) throw memberError
  localStorage.setItem('grind:desktop:activeLobby', data.route_code)
  return data
}

export async function joinLobby(lobby: Lobby) {
  const user = await requireUser()
  const { data, error } = await supabase.rpc('join_lobby_member', {
    p_lobby_id: lobby.id,
    p_user_id: user.id,
  })
  if (error) throw error
  if (typeof data === 'string' && !['joined', 'already_member', 'ok'].includes(data)) {
    throw new Error(data)
  }
  localStorage.setItem('grind:desktop:activeLobby', lobby.routeCode)
  return lobby
}

export async function leaveLobby(lobbyId: string) {
  const user = await requireUser()
  const { error } = await supabase.from('lobby_members').delete().eq('lobby_id', lobbyId).eq('user_id', user.id)
  if (error) throw error
  localStorage.removeItem('grind:desktop:activeLobby')
}

export async function closeLobby(lobbyId: string) {
  const user = await requireUser()
  const { error } = await supabase
    .from('lobbies')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', lobbyId)
    .eq('owner_id', user.id)
  if (error) throw error
}

export async function loadCommunities() {
  const user = await requireUser()
  const { data, error } = await supabase
    .from('community_members')
    .select('role,communities!inner(id,owner_id,name,description,logo_url,banner_url,privacy,tags)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
  if (error) throw error

  return (data || []).map((row: any) => {
    const community = Array.isArray(row.communities) ? row.communities[0] : row.communities
    return {
      id: community.id,
      ownerId: community.owner_id,
      name: community.name,
      description: community.description || '',
      logoUrl: community.logo_url,
      bannerUrl: community.banner_url,
      privacy: community.privacy,
      tags: community.tags || [],
      role: row.role,
    }
  }) as Community[]
}

export async function createCommunity(input: { name: string; description: string; tags: string[] }) {
  const user = await requireUser()
  const { data, error } = await supabase.rpc('create_community_atomic', {
    p_owner_id: user.id,
    p_name: input.name,
    p_description: input.description,
    p_tags: input.tags,
    p_logo_url: null,
    p_banner_url: null,
  })
  if (error) throw error
  return data as string
}

export async function createCommunityInvite(communityId: string) {
  const { data, error } = await supabase.rpc('create_community_invite_atomic', {
    p_community_id: communityId,
    p_expires_in_hours: 168,
    p_max_uses: 25,
  })
  if (error) throw error
  const token = (data as { token?: string } | null)?.token
  if (!token) throw new Error('Não foi possível gerar o convite.')
  return token
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function acceptCommunityInvite(token: string, actorLabel: string) {
  const user = await requireUser()
  const { data, error } = await supabase.rpc('accept_community_invite_atomic', {
    p_token_hash: await sha256(token.trim()),
    p_user_id: user.id,
    p_actor_label: actorLabel || 'Usuário',
  })
  if (error) throw error
  const result = data as { status?: string; communityId?: string } | null
  if (!result || !['joined', 'already_member'].includes(result.status || '')) {
    throw new Error(result?.status === 'unavailable' ? 'Convite expirado ou indisponível.' : 'Não foi possível entrar na Community.')
  }
  return result.communityId
}

export async function loadCommunityPosts(communityId: string) {
  const { data, error } = await supabase
    .from('community_posts')
    .select('id,community_id,author_id,type,title,body,media_url,created_at')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) throw error
  return (data || []) as CommunityPost[]
}

export async function createCommunityPost(communityId: string, title: string, body: string) {
  const user = await requireUser()
  const { error } = await supabase.from('community_posts').insert({
    community_id: communityId,
    author_id: user.id,
    type: 'post',
    title: title.trim() || 'Novo post',
    body: body.trim(),
  })
  if (error) throw error
}

export async function loadPreferences(): Promise<DesktopPreferences> {
  const user = await requireUser()
  const { data, error } = await supabase
    .from('user_preferences')
    .select('show_online,allow_friend_requests,allow_messages_from_friends,desktop_settings')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  return {
    show_online: data?.show_online ?? true,
    allow_friend_requests: data?.allow_friend_requests ?? true,
    allow_messages_from_friends: data?.allow_messages_from_friends ?? true,
    desktop_settings: (data?.desktop_settings as DesktopPreferences['desktop_settings']) || {},
  }
}

export async function savePreferences(preferences: DesktopPreferences) {
  const user = await requireUser()
  const { error } = await supabase.from('user_preferences').upsert({
    user_id: user.id,
    ...preferences,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function equipCosmetic(slot: string, cosmeticId: string) {
  const profile = await loadProfile()
  const equipped = { ...(profile.cosmetic_equipped || {}), [slot]: cosmeticId }
  const { data, error } = await supabase
    .from('profiles')
    .update({ cosmetic_equipped: equipped, updated_at: new Date().toISOString() })
    .eq('id', profile.id)
    .select(PROFILE_FIELDS)
    .single()
  if (error) throw error
  return data as GrindProfile
}

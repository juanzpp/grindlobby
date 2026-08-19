import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: games }, { data: ranks }, { data: lobbies }, { data: online }] = await Promise.all([
    admin.from('games').select('id,name,slug').order('id').limit(5),
    admin.from('user_game_ranks').select('game_id,rank_name,points,wins,losses').eq('user_id', user.id),
    admin.from('lobbies').select('id,owner_id,game_id,name,description,visibility,max_members,status,created_at').eq('status','open').order('created_at',{ascending:false}).limit(12),
    admin.from('profiles').select('id,username,display_name,avatar,status').eq('status','online').neq('id',user.id).limit(12),
  ])

  const lobbyIds = (lobbies ?? []).map(l => l.id)
  const gameIds = Array.from(new Set((lobbies ?? []).map(l => l.game_id).filter(Boolean))) as number[]
  const ownerIds = Array.from(new Set((lobbies ?? []).map(l => l.owner_id))) as string[]

  const cutoff = new Date(Date.now() - 30000).toISOString()
  const [{ data: memberships }, { data: lobbyGames }, { data: owners }, { data: myMemberships }] = await Promise.all([
    lobbyIds.length ? admin.from('lobby_members').select('lobby_id,user_id').in('lobby_id', lobbyIds).gt('last_seen_at', cutoff) : Promise.resolve({data: [] as any[]}),
    gameIds.length ? admin.from('games').select('id,name,slug').in('id',gameIds) : Promise.resolve({data: [] as any[]}),
    ownerIds.length ? admin.from('profiles').select('id,username,display_name,avatar,status').in('id',ownerIds) : Promise.resolve({data: [] as any[]}),
    admin.from('lobby_members').select('lobby_id').eq('user_id',user.id),
  ])

  const rankMap = new Map((ranks ?? []).map(r => [r.game_id,r]))
  const gameMap = new Map((lobbyGames ?? []).map(g => [g.id,g]))
  const ownerMap = new Map((owners ?? []).map(o => [o.id,o]))
  const counts = new Map<string,number>()
  for (const m of memberships ?? []) counts.set(m.lobby_id,(counts.get(m.lobby_id) ?? 0)+1)
  const mine = new Set((myMemberships ?? []).map(m => m.lobby_id))

  const gameCards = (games ?? []).slice(0,3).map(g => {
    const r:any = rankMap.get(g.id)
    const total = (r?.wins ?? 0) + (r?.losses ?? 0)
    return {
      id:g.id,name:g.name,slug:g.slug,rank:r?.rank_name ?? 'Sem rank',points:r?.points ?? 0,
      winRate: total ? Math.round((r.wins/total)*100) : 0,
      progress: Math.min(96, Math.max(8, (r?.points ?? 0) % 100)),
    }
  })

  const lobbyCards = (lobbies ?? []).map(l => ({
    ...l,
    game: l.game_id ? gameMap.get(l.game_id) ?? null : null,
    owner: ownerMap.get(l.owner_id) ?? null,
    memberCount: counts.get(l.id) ?? 0,
    joined: mine.has(l.id),
  }))

  return NextResponse.json({
    games: gameCards,
    lobbies: lobbyCards,
    online: online ?? [],
    stats: {
      online: (online ?? []).length + 1,
      activeLobbies: (lobbies ?? []).length,
      myLobbies: mine.size,
      rank: ranks?.length ? Math.max(...ranks.map(r => r.points)) : 0,
    }
  })
}

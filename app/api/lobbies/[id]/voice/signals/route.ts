import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const signalTypes = new Set(['offer', 'answer', 'ice-candidate', 'candidate', 'leave'])
const presenceCutoff = () => new Date(Date.now() - 30000).toISOString()

async function authorizedMember(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado.', status: 401 as const }
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('lobby_members')
    .select('user_id')
    .eq('lobby_id', id)
    .eq('user_id', user.id)
    .gt('last_seen_at', presenceCutoff())
    .maybeSingle()
  if (!membership) return { error: 'Você não está presente neste lobby.', status: 403 as const }
  return { admin, user }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorizedMember(id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const url = new URL(request.url)
  const after = Number(url.searchParams.get('after') || 0)
  await auth.admin.from('voice_signals').delete().lt('expires_at', new Date().toISOString())
  const { data, error } = await auth.admin
    .from('voice_signals')
    .select('id,sender_id,target_id,signal_type,payload,created_at')
    .eq('lobby_id', id)
    .gt('id', Number.isFinite(after) ? after : 0)
    .or(`target_id.is.null,target_id.eq.${auth.user.id}`)
    .order('id')
    .limit(100)
  if (error) return NextResponse.json({ error: 'Não foi possível ler a sinalização.' }, { status: 500 })
  if (process.env.NODE_ENV === 'development') console.debug('[voice] signals-get', { lobbyId: id, userId: auth.user.id, count: data?.length ?? 0, cursor: data?.at(-1)?.id ?? after })
  return NextResponse.json({ signals: data ?? [], cursor: data?.at(-1)?.id ?? after })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorizedMember(id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => null) as { targetId?: string | null; type?: string; payload?: unknown } | null
  if (!body?.type || !signalTypes.has(body.type) || !body.payload || typeof body.payload !== 'object') {
    return NextResponse.json({ error: 'Sinal inválido.' }, { status: 400 })
  }
  const targetId = body.targetId || null
  const signalType = body.type === 'candidate' ? 'ice-candidate' : body.type
  if (process.env.NODE_ENV === 'development') console.debug('[voice] signals-post', { lobbyId: id, senderId: auth.user.id, targetId, type: signalType })
  if (targetId) {
    const { data: target } = await auth.admin
      .from('lobby_members')
      .select('user_id')
      .eq('lobby_id', id)
      .eq('user_id', targetId)
      .gt('last_seen_at', presenceCutoff())
      .maybeSingle()
    if (!target) return NextResponse.json({ error: 'Destino não está presente no lobby.' }, { status: 403 })
  }
  const { error } = await auth.admin.from('voice_signals').insert({
    lobby_id: id,
    sender_id: auth.user.id,
    target_id: targetId,
    signal_type: signalType,
    payload: body.payload,
  })
  if (error) return NextResponse.json({ error: 'Não foi possível enviar a sinalização.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

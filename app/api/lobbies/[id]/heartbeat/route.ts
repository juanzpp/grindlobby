import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('lobby_members')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('lobby_id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Não foi possível atualizar a presença.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
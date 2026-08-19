import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('profiles').update({ status: 'offline', last_seen_at: new Date().toISOString() }).eq('id', user.id)
  }
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}

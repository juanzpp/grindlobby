import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: games, error } = await supabase.from('games').select('id,name,slug').order('name')
  if (error) return NextResponse.json({ error: 'Não foi possível carregar os jogos.' }, { status: 500 })
  return NextResponse.json({ games: games ?? [] })
}

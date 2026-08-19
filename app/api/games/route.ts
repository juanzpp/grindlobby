import { createClient } from '@/lib/supabase/server'
import { noStoreJson } from '@/lib/security/request'

export async function GET() {
  const supabase = await createClient()
  const { data: games, error } = await supabase.from('games').select('id,name,slug').order('name')
  if (error) return noStoreJson({ error: 'Não foi possível carregar os jogos.' }, { status: 500 })
  return noStoreJson({ games: games ?? [] })
}

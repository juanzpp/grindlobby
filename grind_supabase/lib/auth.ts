import { createClient } from '@/lib/supabase/server'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, email, display_name, avatar, status')
    .eq('id', user.id)
    .single()

  return profile ?? {
    id: user.id,
    username: user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'player',
    email: user.email ?? '',
    display_name: user.user_metadata?.display_name ?? 'Player',
    avatar: null,
    status: 'online',
  }
}

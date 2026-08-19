import { createClient } from '@/lib/supabase/server'
import { requireEmailConfirmation } from '@/lib/auth-config'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || (requireEmailConfirmation() && !user.email_confirmed_at)) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, email, display_name, avatar, status, account_tier, app_role')
    .eq('id', user.id)
    .single()

  const configuredAdmins=(process.env.GRINDLOBBY_ADMIN_USER_IDS??'').split(',').map(value=>value.trim()).filter(Boolean)
  if (profile) return configuredAdmins.includes(user.id) ? {...profile,app_role:'admin',account_tier:'pro'} : profile

  return {
    id: user.id,
    username: user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'player',
    email: user.email ?? '',
    display_name: user.user_metadata?.display_name ?? 'Player',
    avatar: null,
    status: 'online',
    account_tier: 'free',
    app_role: 'user',
  }
}

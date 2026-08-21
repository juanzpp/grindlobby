import {createClient} from '@/lib/supabase/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {requireEmailConfirmation} from '@/lib/auth-config'
import {isConfiguredAdmin} from '@/lib/admin-config'

type AuthUser={
  id:string
  email?:string|null
  email_confirmed_at?:string|null
  user_metadata?:Record<string,unknown>
}

function bearerToken(request?:Request){
  if(!request)return null
  const value=request.headers.get('authorization')?.trim()??''
  const match=/^Bearer\s+(.+)$/i.exec(value)
  return match?.[1]?.trim()||null
}

async function resolveAuthUser(request?:Request):Promise<{user:AuthUser|null;client:ReturnType<typeof createAdminClient>|Awaited<ReturnType<typeof createClient>>}> {
  const token=bearerToken(request)
  if(token){
    const admin=createAdminClient()
    const {data:{user},error}=await admin.auth.getUser(token)
    return {user:error?null:user as AuthUser|null,client:admin}
  }
  const supabase=await createClient()
  const {data:{user},error}=await supabase.auth.getUser()
  return {user:error?null:user as AuthUser|null,client:supabase}
}

/**
 * Resolve the authenticated GrindLobby user.
 *
 * - Server-rendered/current app calls may omit `request` and continue using the
 *   existing Supabase cookie session.
 * - Decoupled frontends (for example the Lovable UI) may pass a Request with a
 *   Supabase access token in `Authorization: Bearer <token>`.
 *
 * The browser never receives the service-role key: token verification and
 * privileged profile reads stay server-side.
 */
export async function getCurrentUser(request?:Request){
  const {user,client}=await resolveAuthUser(request)
  if(!user||(requireEmailConfirmation()&&!user.email_confirmed_at))return null

  const {data:profile}=await client
    .from('profiles')
    .select('id, username, email, display_name, avatar, status, account_tier, app_role')
    .eq('id',user.id)
    .single()

  const configuredAdmin=isConfiguredAdmin(user.id)
  if(profile)return configuredAdmin
    ? {...profile,app_role:'admin',account_tier:'pro'}
    : {...profile,app_role:'user'}

  const metadata=user.user_metadata??{}
  const username=typeof metadata.username==='string'?metadata.username:user.email?.split('@')[0]??'player'
  const displayName=typeof metadata.display_name==='string'?metadata.display_name:'Player'
  return {
    id:user.id,
    username,
    email:user.email??'',
    display_name:displayName,
    avatar:null,
    status:'online',
    account_tier:configuredAdmin?'pro':'free',
    app_role:configuredAdmin?'admin':'user',
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser()
  if(!user) return NextResponse.json({error:'Não autorizado.'},{status:401})
  const admin=createAdminClient()
  const {data:lobby}=await admin.from('lobbies').select('id,max_members,status').eq('id',id).maybeSingle()
  if(!lobby || lobby.status!=='open') return NextResponse.json({error:'Lobby indisponível.'},{status:404})
  const cutoff=new Date(Date.now()-30000).toISOString()
  const {count}=await admin.from('lobby_members').select('*',{count:'exact',head:true}).eq('lobby_id',id).gt('last_seen_at',cutoff)
  if((count ?? 0)>=lobby.max_members) return NextResponse.json({error:'Lobby cheio.'},{status:409})
  const {error}=await admin.from('lobby_members').upsert({lobby_id:id,user_id:user.id,role:'member'},{onConflict:'lobby_id,user_id',ignoreDuplicates:true})
  if(error) return NextResponse.json({error:'Não foi possível entrar.'},{status:500})
  const {error:presenceError}=await admin.from('lobby_members').update({last_seen_at:new Date().toISOString()}).eq('lobby_id',id).eq('user_id',user.id)
  if(presenceError) return NextResponse.json({error:'Não foi possível atualizar a presença.'},{status:500})
  return NextResponse.json({ok:true,lobbyId:id})
}

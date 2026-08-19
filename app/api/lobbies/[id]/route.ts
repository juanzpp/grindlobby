import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser()
 if(!user) return NextResponse.json({error:'Não autorizado.'},{status:401})
 const admin=createAdminClient()
 const {data:lobby}=await admin.from('lobbies').select('*').eq('id',id).maybeSingle()
 if(!lobby) return NextResponse.json({error:'Lobby não encontrado.'},{status:404})
 const cutoff=new Date(Date.now()-30000).toISOString()
 const [{data:game},{data:members},{data:membership}]=await Promise.all([
  lobby.game_id?admin.from('games').select('id,name,slug').eq('id',lobby.game_id).maybeSingle():Promise.resolve({data:null}),
  admin.from('lobby_members').select('user_id,role,joined_at,last_seen_at').eq('lobby_id',id).gt('last_seen_at',cutoff).order('joined_at'),
  admin.from('lobby_members').select('user_id').eq('lobby_id',id).eq('user_id',user.id).maybeSingle()
 ])
 const ids=(members??[]).map(m=>m.user_id)
 const {data:profiles}=ids.length?await admin.from('profiles').select('id,username,display_name,avatar,status').in('id',ids):{data:[] as any[]}
 const pmap=new Map((profiles??[]).map(p=>[p.id,p]))
 return NextResponse.json({lobby:{...lobby,game,members:(members??[]).map(m=>({...m,profile:pmap.get(m.user_id)})),isMember:Boolean(membership),me:user.id}})
}

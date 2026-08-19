import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser()
  if(!user) return NextResponse.json({error:'Não autorizado.'},{status:401})
  const admin=createAdminClient()
  const expiredAt=new Date(Date.now()-60000).toISOString()
  const {error}=await admin.from('lobby_members').update({last_seen_at:expiredAt}).eq('lobby_id',id).eq('user_id',user.id)
  if(error) return NextResponse.json({error:'Não foi possível sair.'},{status:500})
  return NextResponse.json({ok:true})
}

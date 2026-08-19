import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  gameId: z.coerce.number().int().positive(),
  description: z.string().trim().max(240).optional().default(''),
  visibility: z.enum(['public','private','friends']).default('public'),
  maxMembers: z.coerce.number().int().min(2).max(100),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({error:'Não autorizado.'},{status:401})

  try {
    const body = createSchema.parse(await req.json())
    const admin = createAdminClient()
    const { data: lobby, error } = await admin.from('lobbies').insert({
      owner_id:user.id,game_id:body.gameId,name:body.name,description:body.description,
      visibility:body.visibility,max_members:body.maxMembers,status:'open'
    }).select('id').single()
    if (error || !lobby) throw error ?? new Error('Falha ao criar lobby')

    const { error: memberError } = await admin.from('lobby_members').insert({lobby_id:lobby.id,user_id:user.id,role:'owner'})
    if (memberError) {
      await admin.from('lobbies').delete().eq('id',lobby.id)
      throw memberError
    }
    return NextResponse.json({ok:true,lobbyId:lobby.id})
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({error:'Confira nome, jogo e número de vagas.'},{status:400})
    return NextResponse.json({error:'Não foi possível criar o lobby.'},{status:500})
  }
}

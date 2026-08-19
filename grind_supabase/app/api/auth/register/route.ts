import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().max(160),
  password: z.string().min(10).max(128)
    .regex(/[a-z]/, 'lowercase')
    .regex(/[A-Z]/, 'uppercase')
    .regex(/[0-9]/, 'number'),
  displayName: z.string().min(2).max(40),
})

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json())
    const admin = createAdminClient()

    const { data: existingUsername } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', body.username)
      .maybeSingle()

    if (existingUsername) {
      return NextResponse.json({ error: 'Username já está em uso.' }, { status: 409 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          username: body.username,
          display_name: body.displayName,
        },
      },
    })

    if (error) {
      const status = error.message.toLowerCase().includes('registered') ? 409 : 400
      return NextResponse.json({ error: status === 409 ? 'Email já está em uso.' : error.message }, { status })
    }

    if (data.session && data.user) {
      await supabase.from('profiles').update({ status: 'online' }).eq('id', data.user.id)
    }

    return NextResponse.json({
      ok: true,
      requiresEmailVerification: !data.session,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos. Use uma senha forte com 10+ caracteres, maiúscula, minúscula e número.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Não foi possível criar a conta.' }, { status: 500 })
  }
}

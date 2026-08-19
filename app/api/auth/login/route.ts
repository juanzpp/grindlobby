import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({ identifier: z.string().min(3), password: z.string().min(1), remember: z.boolean().default(true) })

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json())
    let email = body.identifier.trim()

    if (!email.includes('@')) {
      const admin = createAdminClient()
      const { data: profile } = await admin
        .from('profiles')
        .select('email')
        .ilike('username', email)
        .maybeSingle()
      if (!profile?.email) {
        return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 })
      }
      email = profile.email
    }

    const supabase = await createClient({ persistent: body.remember })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: body.password })

    if (error || !data.user) {
      if (error?.message.toLowerCase().includes('email not confirmed')) {
        return NextResponse.json({ error: 'Confirme seu e-mail antes de entrar.', code: 'email_unconfirmed' }, { status: 403 })
      }
      if (/banned|disabled|blocked/i.test(error?.message ?? '')) {
        return NextResponse.json({ error: 'Esta conta está temporariamente bloqueada.', code: 'account_blocked' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 })
    }

    if (!data.user.email_confirmed_at) {
      await supabase.auth.signOut()
      return NextResponse.json({ error: 'Confirme seu e-mail antes de entrar.', code: 'email_unconfirmed' }, { status: 403 })
    }

    await supabase.from('profiles').update({ status: 'online', last_seen_at: new Date().toISOString() }).eq('id', data.user.id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }
}

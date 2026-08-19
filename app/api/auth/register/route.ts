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
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  ageDeclared: z.literal(true),
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
    const origin = new URL(req.url).origin
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          username: body.username,
          display_name: body.displayName,
        },
        emailRedirectTo: `${origin}/auth/callback?next=/login?status=confirmed`,
      },
    })

    if (error) {
      const status = error.message.toLowerCase().includes('registered') ? 409 : 400
      return NextResponse.json({ error: status === 409 ? 'Email já está em uso.' : 'Não foi possível criar a conta com esses dados.' }, { status })
    }

    if (data.session && data.user) {
      await supabase.from('profiles').update({ status: 'online' }).eq('id', data.user.id)
    }

    if (data.user) {
      const acceptedAt = new Date().toISOString()
      const { error: consentError } = await admin.from('user_consents').upsert({
        user_id: data.user.id,
        terms_accepted_at: acceptedAt,
        privacy_accepted_at: acceptedAt,
        age_declaration_at: acceptedAt,
        terms_version: '2026-08-01',
        privacy_version: '2026-08-01',
      }, { onConflict: 'user_id' })
      if (consentError) return NextResponse.json({ error: 'Conta criada, mas não foi possível registrar os consentimentos.' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      requiresEmailVerification: !data.session,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Revise os campos, os consentimentos e use uma senha forte.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Não foi possível criar a conta.' }, { status: 500 })
  }
}

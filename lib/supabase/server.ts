import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient(options:{persistent?:boolean}={}) {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
              if (options.persistent === false) {
                const { maxAge: _maxAge, expires: _expires, ...sessionOptions } = cookieOptions
                cookieStore.set(name, value, sessionOptions)
              } else cookieStore.set(name, value, cookieOptions)
            })
          } catch {
            // Server Components cannot always write cookies. Route handlers can.
          }
        },
      },
    }
  )
}

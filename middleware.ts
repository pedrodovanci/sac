import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { updateSession } from '@/src/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/@vite/client') {
    return new NextResponse('', {
      status: 200,
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'no-store'
      }
    })
  }

  const response = await updateSession(request)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !anonKey) return response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options })
      },
      remove(name, options) {
        response.cookies.set({ name, value: '', ...options })
      }
    }
  })

  const { data } = await supabase.auth.getUser()
  const isAuthenticated = !!data.user

  const pathname = request.nextUrl.pathname
  const isProtected =
    pathname.startsWith('/kanban') || pathname.startsWith('/historico') || pathname.startsWith('/relatorio')
    || pathname.startsWith('/tickets')

  if (isProtected && !isAuthenticated) {
    const redirectUrl = new URL('/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  if (pathname === '/login' && isAuthenticated) {
    const redirectUrl = new URL('/kanban', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ['/login', '/kanban/:path*', '/historico/:path*', '/relatorio/:path*', '/tickets/:path*', '/@vite/client']
}

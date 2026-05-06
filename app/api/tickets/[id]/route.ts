import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import type { Ticket } from '@/src/types'
import { checkRateLimit } from '@/src/lib/rateLimit'

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' }

const PLATAFORMAS = ['Google', 'Reclame Aqui', 'Email', 'WhatsApp', 'Instagram', 'Outro'] as const
const TIPOS = ['Elogio', 'Reclamação', 'Dúvida', 'Suporte'] as const
const STATUS = ['a_responder', 'em_atendimento', 'finalizado'] as const
const SETORES = [
  'Atendimento Exames',
  'Atendimento Consultas',
  'Atendimento Médico',
  'Atendimento WhatsApp',
  'Atendimento Call Center',
  'Entrega de Exames',
  'Cantina',
  'Enfermagem',
  'Técnicos',
  'Outros'
] as const

function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !anonKey) throw new Error('Missing Supabase env vars')

  const cookieStore = cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name, options) {
        cookieStore.set({ name, value: '', ...options })
      }
    }
  })
}

function toStringOrUndefined(value: unknown) {
  if (value === null || value === undefined) return undefined
  return String(value)
}

function sanitizeText(value: unknown, maxLen: number) {
  const raw = toStringOrUndefined(value)
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  return trimmed.slice(0, maxLen)
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    const rl = await checkRateLimit(request, 'PATCH:/api/tickets/[id]', 30, 60_000)
    if (rl.allowed === false) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(rl.retryAfter) } }
      )
    }

    const supabase = createSupabase()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })

    const { id } = context.params
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const payload: Partial<Ticket> = {}

    if (body?.paciente_nome !== undefined) {
      const v = sanitizeText(body.paciente_nome, 200)
      if (!v) return NextResponse.json({ error: 'paciente_nome_required' }, { status: 400, headers: NO_STORE_HEADERS })
      payload.paciente_nome = v
    }

    if (body?.paciente_telefone !== undefined) {
      payload.paciente_telefone = sanitizeText(body.paciente_telefone, 30) || undefined
    }

    if (body?.paciente_email !== undefined) {
      payload.paciente_email = sanitizeText(body.paciente_email, 200) || undefined
    }

    if (body?.plataforma !== undefined) {
      const v = toStringOrUndefined(body.plataforma)
      if (!v || !PLATAFORMAS.includes(v as any))
        return NextResponse.json({ error: 'plataforma_invalid' }, { status: 400, headers: NO_STORE_HEADERS })
      payload.plataforma = v as any
    }

    if (body?.tipo !== undefined) {
      const v = toStringOrUndefined(body.tipo)
      if (!v || !TIPOS.includes(v as any))
        return NextResponse.json({ error: 'tipo_invalid' }, { status: 400, headers: NO_STORE_HEADERS })
      payload.tipo = v as any
    }

    if (body?.setor !== undefined) {
      const v = toStringOrUndefined(body.setor)
      if (v && !SETORES.includes(v as any)) return NextResponse.json({ error: 'setor_invalid' }, { status: 400, headers: NO_STORE_HEADERS })
      payload.setor = (v as any) || undefined
    }

    if (body?.descricao !== undefined) {
      payload.descricao = sanitizeText(body.descricao, 5000) || ''
    }

    if (body?.observacao !== undefined) {
      payload.observacao = sanitizeText(body.observacao, 2000) || undefined
    }

    if (body?.oculto_no_kanban !== undefined) {
      payload.oculto_no_kanban = Boolean(body.oculto_no_kanban)
    }

    if (body?.status !== undefined) {
      const v = toStringOrUndefined(body.status)
      if (!v || !STATUS.includes(v as any)) return NextResponse.json({ error: 'status_invalid' }, { status: 400, headers: NO_STORE_HEADERS })
      payload.status = v as any
      payload.data_finalizacao = v === 'finalizado' ? new Date().toISOString() : (null as any)
    }

    if (Object.keys(payload).length === 0)
      return NextResponse.json({ error: 'empty_patch' }, { status: 400, headers: NO_STORE_HEADERS })

    const { data, error } = await supabase.from('tickets').update(payload).eq('id', id).select('*').single()
    if (error) {
      console.error('[api:tickets][PATCH] db_error', { message: error.message })
      return NextResponse.json({ error: 'db_error' }, { status: 400, headers: NO_STORE_HEADERS })
    }

    return NextResponse.json({ ticket: data as Ticket }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[api:tickets][PATCH] internal_error', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500, headers: NO_STORE_HEADERS })
  }
}

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  try {
    const rl = await checkRateLimit(_request, 'GET:/api/tickets/[id]', 120, 60_000)
    if (rl.allowed === false) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(rl.retryAfter) } }
      )
    }

    const supabase = createSupabase()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })

    const { id } = context.params
    const { data, error } = await supabase.from('tickets').select('*').eq('id', id).single()
    if (error) {
      return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE_HEADERS })
    }

    return NextResponse.json({ ticket: data as Ticket }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[api:tickets][GET] internal_error', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500, headers: NO_STORE_HEADERS })
  }
}

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

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function getSaoPauloParts(date: Date) {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(date)

  const map = new Map(parts.map((p) => [p.type, p.value]))
  const dd = map.get('day') || '01'
  const mm = map.get('month') || '01'
  const yyyy = map.get('year') || '1970'
  return { dd, mm, yyyy }
}

function formatCodigo(date: Date, seq: number) {
  const { dd, mm, yyyy } = getSaoPauloParts(date)
  const nn = pad2(seq)
  return `${dd}-${mm}-${yyyy}-${nn}`
}

async function computeNextCodigo(supabase: ReturnType<typeof createSupabase>, dataCriacaoISO: string) {
  const d = new Date(dataCriacaoISO)
  if (Number.isNaN(d.getTime())) return formatCodigo(new Date(), 1)

  const { dd, mm, yyyy } = getSaoPauloParts(d)
  const dayStart = new Date(`${yyyy}-${mm}-${dd}T00:00:00-03:00`)
  const dayEnd = new Date(`${yyyy}-${mm}-${dd}T23:59:59.999-03:00`)

  const { data, error } = await supabase
    .from('tickets')
    .select('codigo')
    .gte('data_criacao', dayStart.toISOString())
    .lte('data_criacao', dayEnd.toISOString())
    .not('codigo', 'is', null)
    .order('codigo', { ascending: false })
    .limit(1)

  if (error) return formatCodigo(d, 1)
  const last = (data?.[0] as { codigo?: string } | undefined)?.codigo
  if (!last) return formatCodigo(d, 1)

  const parts = last.split('-')
  const suffix = parts.length >= 4 ? Number(parts[3]) : NaN
  const nextSeq = Number.isFinite(suffix) ? suffix + 1 : 1
  return formatCodigo(d, nextSeq)
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

function toISODateOrNow(value: unknown) {
  const raw = toStringOrUndefined(value)
  if (!raw) return new Date().toISOString()
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return new Date().toISOString()
  return d.toISOString()
}

export async function GET(request: NextRequest) {
  try {
    const rl = await checkRateLimit(request, 'GET:/api/tickets', 120, 60_000)
    if (rl.allowed === false) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(rl.retryAfter) } }
      )
    }

    const supabase = createSupabase()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const plataforma = searchParams.get('plataforma') || undefined
    const inicio = searchParams.get('inicio') || undefined
    const fim = searchParams.get('fim') || undefined

    let query = supabase.from('tickets').select('*').order('data_criacao', { ascending: false })

    if (status) query = query.eq('status', status)
    if (plataforma) query = query.eq('plataforma', plataforma)
    if (inicio) query = query.gte('data_criacao', inicio)
    if (fim) query = query.lte('data_criacao', fim)

    const { data, error } = await query
    if (error) {
      console.error('[api:tickets][GET] db_error', { message: error.message })
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE_HEADERS })
    }

    return NextResponse.json({ tickets: data as Ticket[] }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[api:tickets][GET] internal_error', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500, headers: NO_STORE_HEADERS })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimit(request, 'POST:/api/tickets', 20, 60_000)
    if (rl.allowed === false) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(rl.retryAfter) } }
      )
    }

    const supabase = createSupabase()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const paciente_nome = sanitizeText(body?.paciente_nome, 200)
    if (!paciente_nome)
      return NextResponse.json({ error: 'paciente_nome_required' }, { status: 400, headers: NO_STORE_HEADERS })

    const plataforma = toStringOrUndefined(body?.plataforma)
    if (!plataforma || !PLATAFORMAS.includes(plataforma as any)) {
      return NextResponse.json({ error: 'plataforma_invalid' }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const tipo = toStringOrUndefined(body?.tipo)
    if (!tipo || !TIPOS.includes(tipo as any))
      return NextResponse.json({ error: 'tipo_invalid' }, { status: 400, headers: NO_STORE_HEADERS })

    const status = toStringOrUndefined(body?.status) ?? 'a_responder'
    if (!STATUS.includes(status as any))
      return NextResponse.json({ error: 'status_invalid' }, { status: 400, headers: NO_STORE_HEADERS })

    const setorRaw = toStringOrUndefined(body?.setor)
    if (setorRaw && !SETORES.includes(setorRaw as any))
      return NextResponse.json({ error: 'setor_invalid' }, { status: 400, headers: NO_STORE_HEADERS })

    const data_criacao = toISODateOrNow(body?.data_criacao)
    const codigo = await computeNextCodigo(supabase, data_criacao)

    const payload: Partial<Ticket> & { codigo: string; criado_por: string; data_criacao: string } = {
      codigo,
      criado_por: auth.user.id,
      data_criacao,
      oculto_no_kanban: false,
      paciente_nome,
      paciente_telefone: sanitizeText(body?.paciente_telefone, 30) || undefined,
      paciente_email: sanitizeText(body?.paciente_email, 200) || undefined,
      plataforma: plataforma as any,
      tipo: tipo as any,
      setor: (setorRaw as any) || undefined,
      status: status as any,
      descricao: sanitizeText(body?.descricao, 5000) || ''
    }

    const observacao = sanitizeText(body?.observacao, 2000)
    if (observacao) payload.observacao = observacao

    if (status === 'finalizado') payload.data_finalizacao = new Date().toISOString()

    const { data, error } = await supabase.from('tickets').insert(payload).select('*').single()
    if (error) {
      console.error('[api:tickets][POST] db_error', { message: error.message })
      return NextResponse.json({ error: 'db_error' }, { status: 400, headers: NO_STORE_HEADERS })
    }

    return NextResponse.json({ ticket: data as Ticket }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[api:tickets][POST] internal_error', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500, headers: NO_STORE_HEADERS })
  }
}

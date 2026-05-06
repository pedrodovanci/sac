'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Plataforma, Setor, Status, Ticket, Tipo } from '@/src/types'
import { useDashboardState } from '../../DashboardState'

const PLATAFORMAS: Plataforma[] = ['Google', 'Reclame Aqui', 'Email', 'WhatsApp', 'Instagram', 'Outro']
const TIPOS: Tipo[] = ['Elogio', 'Reclamação', 'Dúvida', 'Suporte']
const SETORES: Setor[] = [
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
]
const STATUS: { value: Status; label: string }[] = [
  { value: 'a_responder', label: 'A Responder' },
  { value: 'em_atendimento', label: 'Em Atendimento' },
  { value: 'finalizado', label: 'Finalizado' }
]

async function getUserFacingError(res: Response) {
  const retryAfter = Number(res.headers.get('Retry-After') || '')
  let code: string | undefined
  try {
    const json = (await res.json()) as { error?: unknown }
    if (typeof json?.error === 'string') code = json.error
  } catch {
    code = undefined
  }

  if (res.status === 401 || code === 'unauthorized') {
    return { message: 'Sua sessão expirou. Faça login novamente.', redirectToLogin: true }
  }

  if (res.status === 429 || code === 'rate_limited') {
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined
    return { message: `Muitas tentativas. Aguarde${wait ? ` ${wait}s` : ''} e tente novamente.`, redirectToLogin: false }
  }

  if (res.status === 404 || code === 'not_found') {
    return { message: 'Ticket não encontrado.', redirectToLogin: false }
  }

  if (res.status >= 500 || code === 'internal_error' || code === 'db_error') {
    return { message: 'Erro interno ao processar sua solicitação. Tente novamente em instantes.', redirectToLogin: false }
  }

  return { message: 'Não foi possível concluir a operação. Verifique os dados e tente novamente.', redirectToLogin: false }
}

export default function TicketEditPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id
  const { setTickets } = useDashboardState()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticket, setTicket] = useState<Ticket | null>(null)

  const formatarDataHora = (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso))

  const title = useMemo(() => {
    if (!ticket) return 'Ticket'
    return `${ticket.codigo} — ${ticket.paciente_nome}`
  }, [ticket])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!id) return
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/tickets/${id}`, { credentials: 'include' })
      if (!res.ok) {
        if (!cancelled) {
          const { message, redirectToLogin } = await getUserFacingError(res)
          if (redirectToLogin) router.push('/login')
          setLoading(false)
          setError(message)
        }
        return
      }
      const json = (await res.json()) as { ticket: Ticket }
      if (!cancelled) {
        setTicket(json.ticket)
        setTickets((prev) => {
          const idx = prev.findIndex((t) => t.id === json.ticket.id)
          if (idx === -1) return [json.ticket, ...prev]
          return prev.map((t) => (t.id === json.ticket.id ? json.ticket : t))
        })
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function salvar() {
    if (!ticket) return
    setSaving(true)
    setError(null)

    const patch: Partial<Ticket> = {
      paciente_nome: ticket.paciente_nome,
      paciente_telefone: ticket.paciente_telefone,
      paciente_email: ticket.paciente_email,
      plataforma: ticket.plataforma,
      tipo: ticket.tipo,
      setor: ticket.setor,
      status: ticket.status,
      descricao: ticket.descricao,
      data_finalizacao:
        ticket.status === 'finalizado' ? (ticket.data_finalizacao ?? new Date().toISOString()) : undefined
    }

    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
      credentials: 'include'
    })

    setSaving(false)
    if (!res.ok) {
      const { message, redirectToLogin } = await getUserFacingError(res)
      if (redirectToLogin) router.push('/login')
      setError(message)
      return
    }

    const json = (await res.json()) as { ticket: Ticket }
    setTicket(json.ticket)
    setTickets((prev) => prev.map((t) => (t.id === json.ticket.id ? json.ticket : t)))
  }

  return (
    <div className="flex-1 flex flex-col max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">{title}</h1>
          {ticket && (
            <p className="text-sm text-on-surface-variant mt-1">
              Criado em {formatarDataHora(ticket.data_criacao)}
              {ticket.data_finalizacao ? ` • Finalizado em ${formatarDataHora(ticket.data_finalizacao)}` : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-surface-variant transition-colors"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={!ticket || saving}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-on-primary shadow-lg hover:bg-primary-container transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-6">
        {loading && <p className="text-sm text-on-surface-variant">Carregando...</p>}
        {error && <p className="text-sm text-error">{error}</p>}

        {ticket && (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <div className="col-span-1">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                Código
              </label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm outline-none"
                value={ticket.codigo}
                readOnly
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                ID (UUID)
              </label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm outline-none"
                value={ticket.id}
                readOnly
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                Nome do Paciente
              </label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                value={ticket.paciente_nome}
                onChange={(e) => setTicket({ ...ticket, paciente_nome: e.target.value })}
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                Telefone
              </label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                value={ticket.paciente_telefone || ''}
                onChange={(e) => setTicket({ ...ticket, paciente_telefone: e.target.value || undefined })}
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                E-mail
              </label>
              <input
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                value={ticket.paciente_email || ''}
                onChange={(e) => setTicket({ ...ticket, paciente_email: e.target.value || undefined })}
              />
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                Plataforma
              </label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                value={ticket.plataforma}
                onChange={(e) => setTicket({ ...ticket, plataforma: e.target.value as Plataforma })}
              >
                {PLATAFORMAS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">Tipo</label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                value={ticket.tipo}
                onChange={(e) => setTicket({ ...ticket, tipo: e.target.value as Tipo })}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                Setor
              </label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                value={ticket.setor || ''}
                onChange={(e) => setTicket({ ...ticket, setor: (e.target.value as Setor) || undefined })}
              >
                <option value="">Selecione o setor</option>
                {SETORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                Status
              </label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                value={ticket.status}
                onChange={(e) => {
                  const nextStatus = e.target.value as Status
                  setTicket({
                    ...ticket,
                    status: nextStatus,
                    data_finalizacao: nextStatus === 'finalizado' ? (ticket.data_finalizacao ?? new Date().toISOString()) : undefined
                  })
                }}
              >
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                Descrição
              </label>
              <textarea
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none min-h-[220px]"
                value={ticket.descricao}
                onChange={(e) => setTicket({ ...ticket, descricao: e.target.value })}
              />
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

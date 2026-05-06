'use client'

import Kanban from '@/src/components/Kanban'
import { useDashboardState } from '../DashboardState'
import type { Status } from '@/src/types'

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

  if (res.status >= 500 || code === 'internal_error' || code === 'db_error') {
    return { message: 'Erro interno ao processar sua solicitação. Tente novamente em instantes.', redirectToLogin: false }
  }

  return { message: 'Não foi possível concluir a operação. Tente novamente.', redirectToLogin: false }
}

export default function KanbanPage() {
  const { tickets, setTickets, dashboardSearch } = useDashboardState()

  const ORDEM_STATUS: Status[] = ['a_responder', 'em_atendimento', 'finalizado']
  const termo = dashboardSearch.trim().toLowerCase()
  const ticketsFiltrados = termo
    ? tickets.filter((t) => (t.paciente_nome || '').toLowerCase().includes(termo))
    : tickets

  async function moverTicket(id: string, direcao: 'avancar' | 'voltar') {
    const atual = tickets.find((t) => t.id === id)
    if (!atual) return

    const indexAtual = ORDEM_STATUS.indexOf(atual.status)
    const novoIndex = direcao === 'avancar' ? indexAtual + 1 : indexAtual - 1
    if (novoIndex < 0 || novoIndex >= ORDEM_STATUS.length) return

    const novoStatus = ORDEM_STATUS[novoIndex]
    const patch = {
      status: novoStatus,
      ...(novoStatus === 'finalizado' ? { data_finalizacao: new Date().toISOString() } : {})
    }

    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))

    const res = await fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
      credentials: 'include'
    })

    if (!res.ok) {
      setTickets((prev) => prev.map((t) => (t.id === id ? atual : t)))
      const { message, redirectToLogin } = await getUserFacingError(res)
      window.alert(message)
      if (redirectToLogin) window.location.href = '/login'
      return
    }

    const json = (await res.json()) as { ticket: typeof atual }
    if (json.ticket) setTickets((prev) => prev.map((t) => (t.id === id ? (json.ticket as any) : t)))
  }

  async function setOcultoNoKanban(id: string, oculto_no_kanban: boolean) {
    const atual = tickets.find((t) => t.id === id)
    if (!atual) return

    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, oculto_no_kanban } : t)))

    const res = await fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ oculto_no_kanban }),
      credentials: 'include'
    })

    if (!res.ok) {
      setTickets((prev) => prev.map((t) => (t.id === id ? atual : t)))
      const { message, redirectToLogin } = await getUserFacingError(res)
      window.alert(message)
      if (redirectToLogin) window.location.href = '/login'
      return
    }

    const json = (await res.json()) as { ticket?: typeof atual }
    if (json.ticket) setTickets((prev) => prev.map((t) => (t.id === id ? (json.ticket as any) : t)))
  }

  return (
    <Kanban
      tickets={ticketsFiltrados}
      onAvancar={(id) => moverTicket(id, 'avancar')}
      onVoltar={(id) => moverTicket(id, 'voltar')}
      onSetOcultoNoKanban={setOcultoNoKanban}
    />
  )
}

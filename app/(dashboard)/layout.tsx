'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  History,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Building2
} from 'lucide-react'
import { DashboardStateProvider, useDashboardState } from './DashboardState'
import NewTicketModal from '@/src/components/NewTicketModal'
import type { Ticket } from '@/src/types'
import { createClient } from '@/src/lib/supabase/client'
import logoCcc from '../../images/LOGO CCC.png'

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

  return { message: 'Não foi possível concluir a operação. Verifique os dados e tente novamente.', redirectToLogin: false }
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardStateProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardStateProvider>
  )
}

function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { tickets, setTickets, dashboardSearch, setDashboardSearch, isNewTicketModalOpen, setIsNewTicketModalOpen } =
    useDashboardState()
  const isKanban = pathname === '/kanban'
  const isHistorico = pathname === '/historico'
  const isTicketEdicao = pathname.startsWith('/tickets/')
  const isRelatorio = pathname === '/relatorio'
  const shouldShowNewTicketButton = !isKanban && !isHistorico && !isRelatorio && !isTicketEdicao

  const handleNewTicket = async (ticketData: Partial<Ticket>) => {
    const dataCriacao = ticketData.data_criacao || new Date().toISOString()

    const newTicket: Ticket = {
      id: Math.random().toString(36).substr(2, 9),
      codigo: 'Gerando...',
      paciente_nome: ticketData.paciente_nome || 'Novo Paciente',
      paciente_telefone: ticketData.paciente_telefone,
      paciente_email: ticketData.paciente_email,
      descricao: ticketData.descricao || '',
      observacao: ticketData.observacao,
      status: ticketData.status || 'a_responder',
      tipo: ticketData.tipo || 'Dúvida',
      plataforma: ticketData.plataforma || 'Outro',
      data_criacao: dataCriacao,
      data_finalizacao: ticketData.data_finalizacao,
      criado_por: ticketData.criado_por
    }

    setTickets((prev) => [newTicket, ...prev])
    setIsNewTicketModalOpen(false)

    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...ticketData, data_criacao: dataCriacao }),
      credentials: 'include'
    })

    if (!res.ok) {
      setTickets((prev) => prev.filter((t) => t.id !== newTicket.id))
      const { message, redirectToLogin } = await getUserFacingError(res)
      window.alert(message)
      if (redirectToLogin) router.push('/login')
      return
    }
    const json = (await res.json()) as { ticket: Ticket }
    if (!json.ticket) {
      setTickets((prev) => prev.filter((t) => t.id !== newTicket.id))
      window.alert('Não foi possível concluir a operação. Tente novamente.')
      return
    }
    setTickets((prev) => [json.ticket, ...prev.filter((t) => t.id !== newTicket.id)])
  }

  return (
    <>
      <div className="min-h-screen flex bg-surface">
        <aside className="fixed left-0 top-0 h-full w-64 border-r border-outline-variant bg-surface-container-low flex flex-col py-6 z-50">
          <div className="px-6 mb-8 flex flex-col gap-2">
            {isKanban || isHistorico || isRelatorio || isTicketEdicao ? (
              <div className="w-full flex items-center justify-center">
                <Image src={logoCcc} alt="Centro Cérebro Coluna" priority className="h-12 w-auto object-contain" />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-sm">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-primary font-bold text-lg tracking-tight leading-tight">SAC Enterprise</h1>
                  <p className="text-on-surface-variant text-xs font-medium">Gestão Interna</p>
                </div>
              </div>
            )}

            {shouldShowNewTicketButton && (
              <button
                onClick={() => setIsNewTicketModalOpen(true)}
                className="mt-6 w-full bg-primary hover:bg-primary-container text-on-primary font-semibold text-sm py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                <Plus className="h-5 w-5" />
                + Novo Ticket
              </button>
            )}
          </div>

          <nav className="flex-1 px-4 space-y-1">
            <NavItem icon={<LayoutDashboard className="h-5 w-5" />} label="Kanban" href="/kanban" active={pathname === '/kanban'} />
            <NavItem icon={<History className="h-5 w-5" />} label="Histórico" href="/historico" active={pathname === '/historico'} />
            <NavItem icon={<BarChart3 className="h-5 w-5" />} label="Relatórios" href="/relatorio" active={pathname === '/relatorio'} />

            <button
              type="button"
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all rounded-lg active:scale-95 mt-auto absolute bottom-6 w-[calc(100%-2rem)]"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-semibold">Sair</span>
            </button>
          </nav>
        </aside>

        <div className="flex-1 ml-64 flex flex-col min-h-screen">
          <header
            className={`fixed top-0 right-0 w-[calc(100%-16rem)] border-b border-outline-variant bg-surface-container-lowest/80 backdrop-blur-md z-40 h-16 px-8 flex items-center shadow-sm ${
              isKanban ? 'justify-between' : isHistorico || isTicketEdicao ? 'justify-center' : 'justify-between'
            }`}
          >
            {isKanban ? <div className="w-40" /> : !isHistorico && !isTicketEdicao && <div />}

            <div
              className={`flex items-center gap-6 ${
                isKanban ? 'flex-1 justify-center' : isHistorico || isTicketEdicao ? 'w-full justify-center' : ''
              }`}
            >
              {!isRelatorio && !isTicketEdicao && (
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Buscar por paciente..."
                    value={dashboardSearch}
                    onChange={(e) => setDashboardSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-outline-variant rounded-full bg-surface-container-low text-xs focus:border-primary focus:ring-2 focus:ring-primary-fixed outline-none w-64 transition-all"
                  />
                </div>
              )}
            </div>

            {isKanban && (
              <div className="w-40 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsNewTicketModalOpen(true)}
                  className="bg-primary hover:bg-primary-container text-on-primary font-semibold text-sm py-2 px-4 rounded-lg flex items-center gap-2 transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  <Plus className="h-5 w-5" />
                  Novo Ticket
                </button>
              </div>
            )}
          </header>

          <main className="mt-16 flex-1 flex flex-col p-8 overflow-hidden">{children}</main>
        </div>
      </div>

      <NewTicketModal
        isOpen={isNewTicketModalOpen}
        onClose={() => setIsNewTicketModalOpen(false)}
        onSubmit={handleNewTicket}
      />
    </>
  )
}

function NavItem({
  icon,
  label,
  href,
  active
}: {
  icon: ReactNode
  label: string
  href: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-all rounded-lg active:scale-95 ${
        active ? 'text-primary bg-primary/10 border-l-4 border-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container font-semibold'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </Link>
  )
}

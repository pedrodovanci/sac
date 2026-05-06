'use client'

import History from '@/src/components/History'
import { useDashboardState } from '../DashboardState'

export default function HistoricoPage() {
  const { tickets, dashboardSearch } = useDashboardState()
  const termo = dashboardSearch.trim().toLowerCase()
  const ticketsFiltrados = termo
    ? tickets.filter((t) => (t.paciente_nome || '').toLowerCase().includes(termo))
    : tickets

  return <History tickets={ticketsFiltrados} />
}

'use client'

import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { MOCK_TICKETS } from '@/src/constants'
import type { Ticket } from '@/src/types'

let didAlertRateLimit = false

type DashboardState = {
  tickets: Ticket[]
  setTickets: Dispatch<SetStateAction<Ticket[]>>
  dashboardSearch: string
  setDashboardSearch: Dispatch<SetStateAction<string>>
  isNewTicketModalOpen: boolean
  setIsNewTicketModalOpen: Dispatch<SetStateAction<boolean>>
}

const DashboardStateContext = createContext<DashboardState | null>(null)

export function DashboardStateProvider({ children }: { children: ReactNode }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [dashboardSearch, setDashboardSearch] = useState('')
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/tickets', { credentials: 'include' })
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = '/login'
            return
          }
          if (res.status === 429 && !didAlertRateLimit) {
            didAlertRateLimit = true
            const retryAfter = res.headers.get('Retry-After')
            window.alert(`Muitas tentativas. Aguarde${retryAfter ? ` ${retryAfter}s` : ''} e tente novamente.`)
          }
          return
        }
        const json = (await res.json()) as { tickets: Ticket[] }
        if (cancelled) return
        if (Array.isArray(json.tickets)) setTickets(json.tickets)
      } catch {
        if (cancelled) return
        setTickets(MOCK_TICKETS)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({
      tickets,
      setTickets,
      dashboardSearch,
      setDashboardSearch,
      isNewTicketModalOpen,
      setIsNewTicketModalOpen
    }),
    [tickets, dashboardSearch, isNewTicketModalOpen]
  )

  return <DashboardStateContext.Provider value={value}>{children}</DashboardStateContext.Provider>
}

export function useDashboardState() {
  const ctx = useContext(DashboardStateContext)
  if (!ctx) throw new Error('useDashboardState must be used within DashboardStateProvider')
  return ctx
}

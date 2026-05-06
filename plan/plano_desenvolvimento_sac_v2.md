# Plano de Desenvolvimento — Sistema de SAC

> **Stack:** Node.js + TypeScript · Supabase (Banco + Auth) · Next.js (Frontend) · Vercel (Deploy)

---

## Visão Geral do Projeto

Sistema interno de gestão de atendimentos ao cliente (SAC) no modelo Kanban, com criação de tickets, histórico filtrado e geração de relatórios em PDF para a diretoria.

---

## Estrutura do Projeto

```
sac-system/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── kanban/page.tsx
│   │   ├── historico/page.tsx
│   │   ├── relatorio/page.tsx
│   │   └── layout.tsx
│   └── api/
│       ├── tickets/route.ts
│       └── relatorio/route.ts
├── components/
│   ├── KanbanBoard.tsx
│   ├── TicketCard.tsx
│   ├── TicketModal.tsx
│   └── FiltroHistorico.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Client-side Supabase
│   │   └── server.ts           # Server-side Supabase
│   └── pdf/
│       └── gerarRelatorio.ts
├── types/
│   └── ticket.ts
└── middleware.ts                # Proteção de rotas
```

---

## Fase 1 — Setup do Ambiente

### 1.1 Criar o projeto Next.js

```bash
npx create-next-app@latest sac-system --typescript --tailwind --app
cd sac-system
```

### 1.2 Instalar dependências

```bash
# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Geração de PDF
npm install jspdf jspdf-autotable

# Utilitários de data
npm install date-fns

# Ícones
npm install lucide-react
```

### 1.3 Variáveis de ambiente

Crie o arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_KEY
```

> Esses valores você encontra no painel do Supabase em **Settings → API**.

---

## Fase 2 — Banco de Dados (Supabase)

### 2.1 Criar a tabela `tickets`

Execute no **SQL Editor** do Supabase:

```sql
-- Tipos customizados
CREATE TYPE plataforma_enum AS ENUM (
  'Google',
  'Reclame Aqui',
  'Email',
  'WhatsApp',
  'Instagram',
  'Outro'
);

CREATE TYPE tipo_enum AS ENUM ('Elogio', 'Reclamação', 'Dúvida');

CREATE TYPE status_enum AS ENUM (
  'a_responder',
  'em_atendimento',
  'finalizado'
);

-- Tabela principal
CREATE TABLE tickets (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_nome    TEXT NOT NULL,
  paciente_telefone TEXT,                         -- telefone de contato do paciente
  paciente_email   TEXT,                          -- email de contato do paciente
  plataforma       plataforma_enum NOT NULL,
  tipo             tipo_enum NOT NULL,
  status           status_enum NOT NULL DEFAULT 'a_responder',
  descricao        TEXT,
  observacao       TEXT,                          -- anotações internas da atendente
  data_criacao     TIMESTAMPTZ DEFAULT NOW(),
  data_finalizacao TIMESTAMPTZ,                   -- preenchida quando status = 'finalizado'
  criado_por       UUID REFERENCES auth.users(id) -- vincula ao usuário autenticado
);

-- Índices para performance nas consultas mais comuns
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_data_finalizacao ON tickets(data_finalizacao);
CREATE INDEX idx_tickets_plataforma ON tickets(plataforma);
```

### 2.2 Configurar Row Level Security (RLS)

O RLS garante que apenas usuários autenticados da empresa acessem os dados.

```sql
-- Habilitar RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Política: apenas usuários autenticados podem ver e editar
CREATE POLICY "Acesso apenas autenticados"
  ON tickets
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

---

## Fase 3 — Autenticação

A autenticação será feita pelo **Supabase Auth** com email e senha. O fluxo é simples: a atendente acessa `/login`, insere suas credenciais e é redirecionada para o Kanban.

### 3.1 Configurar clientes do Supabase

**`lib/supabase/client.ts`** — usado em componentes do lado do cliente:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`lib/supabase/server.ts`** — usado em Server Components e API Routes:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

### 3.2 Middleware de proteção de rotas

**`middleware.ts`** (raiz do projeto) — redireciona para `/login` se não autenticado:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Se não está logado e está tentando acessar área protegida
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Se já está logado e tenta acessar /login
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/kanban', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### 3.3 Página de Login

**`app/(auth)/login/page.tsx`:**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleLogin() {
    setCarregando(true)
    setErro('')

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

    if (error) {
      setErro('Email ou senha incorretos.')
      setCarregando(false)
      return
    }

    router.push('/kanban')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">SAC — Acesso</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg p-3 mb-3"
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full border rounded-lg p-3 mb-4"
        />

        {erro && <p className="text-red-500 text-sm mb-3">{erro}</p>}

        <button
          onClick={handleLogin}
          disabled={carregando}
          className="w-full bg-blue-600 text-white rounded-lg p-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}
```

> **Criação de usuários:** No Supabase, vá em **Authentication → Users → Invite user** para criar a conta da atendente. Não é necessário criar uma tela de cadastro público.

---

## Fase 4 — Tipos TypeScript

**`types/ticket.ts`:**

```typescript
export type Plataforma = 'Google' | 'Reclame Aqui' | 'Email' | 'WhatsApp' | 'Instagram' | 'Outro'
export type Tipo = 'Elogio' | 'Reclamação' | 'Dúvida'
export type Status = 'a_responder' | 'em_atendimento' | 'finalizado'

export interface Ticket {
  id: string
  paciente_nome: string
  paciente_telefone?: string
  paciente_email?: string
  plataforma: Plataforma
  tipo: Tipo
  status: Status
  descricao: string
  observacao?: string
  data_criacao: string
  data_finalizacao?: string
  criado_por?: string
}

export interface NovoTicket {
  paciente_nome: string
  paciente_telefone?: string
  paciente_email?: string
  plataforma: Plataforma
  tipo: Tipo
  status: Status
  descricao: string
  observacao?: string
}
```

---

## Fase 5 — Kanban (Tela Principal)

### 5.1 Lógica de busca dos tickets

No Kanban, os tickets **finalizados** só aparecem se foram finalizados nos últimos 5 dias. Isso evita acúmulo na tela principal sem precisar mover dados.

**`app/(dashboard)/kanban/page.tsx`:**

```typescript
import { createClient } from '@/lib/supabase/server'
import KanbanBoard from '@/components/KanbanBoard'
import { subDays } from 'date-fns'

export default async function KanbanPage() {
  const supabase = await createClient()
  const cincodiasAtras = subDays(new Date(), 5).toISOString()

  const { data: tickets } = await supabase
    .from('tickets')
    .select('*')
    .or(
      `status.neq.finalizado,and(status.eq.finalizado,data_finalizacao.gte.${cincodiasAtras})`
    )
    .order('data_criacao', { ascending: false })

  return <KanbanBoard ticketsIniciais={tickets ?? []} />
}
```

### 5.2 Componente do Board

**`components/KanbanBoard.tsx`** — estrutura das colunas:

```typescript
'use client'

import { useState } from 'react'
import { Ticket, Status } from '@/types/ticket'
import TicketCard from './TicketCard'
import TicketModal from './TicketModal'

const COLUNAS: { status: Status; label: string }[] = [
  { status: 'a_responder', label: 'A Responder' },
  { status: 'em_atendimento', label: 'Em Atendimento' },
  { status: 'finalizado', label: 'Finalizados (últimos 5 dias)' },
]

export default function KanbanBoard({ ticketsIniciais }: { ticketsIniciais: Ticket[] }) {
  const [tickets, setTickets] = useState(ticketsIniciais)
  const [modalAberto, setModalAberto] = useState(false)

  const ticketsPorStatus = (status: Status) =>
    tickets.filter((t) => t.status === status)

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Central de Atendimento</h1>
        <button
          onClick={() => setModalAberto(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Novo Ticket
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {COLUNAS.map(({ status, label }) => (
          <div key={status} className="bg-gray-100 rounded-xl p-4">
            <h2 className="font-semibold text-gray-700 mb-3">
              {label}
              <span className="ml-2 text-sm text-gray-400">
                ({ticketsPorStatus(status).length})
              </span>
            </h2>
            <div className="space-y-3">
              {ticketsPorStatus(status).map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onAtualizar={(atualizado) =>
                    setTickets((prev) =>
                      prev.map((t) => (t.id === atualizado.id ? atualizado : t))
                    )
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {modalAberto && (
        <TicketModal
          onFechar={() => setModalAberto(false)}
          onCriado={(novo) => {
            setTickets((prev) => [novo, ...prev])
            setModalAberto(false)
          }}
        />
      )}
    </div>
  )
}
```

### 5.3 Componente do Card

**`components/TicketCard.tsx`:**

```typescript
'use client'

import { Ticket, Status } from '@/types/ticket'
import { createClient } from '@/lib/supabase/client'

const PROXIMO_STATUS: Record<Status, Status | null> = {
  a_responder: 'em_atendimento',
  em_atendimento: 'finalizado',
  finalizado: null,
}

const LABEL_BOTAO: Record<Status, string> = {
  a_responder: 'Iniciar Atendimento',
  em_atendimento: 'Marcar como Resolvido',
  finalizado: '',
}

export default function TicketCard({
  ticket,
  onAtualizar,
}: {
  ticket: Ticket
  onAtualizar: (t: Ticket) => void
}) {
  const supabase = createClient()
  const corBorda = ticket.tipo === 'Reclamação' ? 'border-l-red-500' : 'border-l-green-500'

  async function avancarStatus() {
    const proximo = PROXIMO_STATUS[ticket.status]
    if (!proximo) return

    const updates: Partial<Ticket> = {
      status: proximo,
      ...(proximo === 'finalizado' && { data_finalizacao: new Date().toISOString() }),
    }

    const { data } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticket.id)
      .select()
      .single()

    if (data) onAtualizar(data)
  }

  return (
    <div className={`bg-white rounded-lg p-3 shadow-sm border-l-4 ${corBorda}`}>
      <div className="flex justify-between items-start">
        <p className="font-semibold text-sm">{ticket.paciente_nome}</p>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            ticket.tipo === 'Reclamação'
              ? 'bg-red-100 text-red-700'
              : 'bg-green-100 text-green-700'
          }`}
        >
          {ticket.tipo}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1">{ticket.plataforma}</p>

      {PROXIMO_STATUS[ticket.status] && (
        <button
          onClick={avancarStatus}
          className="mt-3 w-full text-xs bg-gray-100 hover:bg-gray-200 rounded py-1 px-2"
        >
          {LABEL_BOTAO[ticket.status]} →
        </button>
      )}
    </div>
  )
}
```

---

## Fase 6 — Tela de Histórico

**`app/(dashboard)/historico/page.tsx`:**

```typescript
import { createClient } from '@/lib/supabase/server'
import FiltroHistorico from '@/components/FiltroHistorico'

export default async function HistoricoPage() {
  const supabase = await createClient()

  const { data: tickets } = await supabase
    .from('tickets')
    .select('*')
    .eq('status', 'finalizado')
    .order('data_finalizacao', { ascending: false })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Histórico de Atendimentos</h1>
      <FiltroHistorico tickets={tickets ?? []} />
    </div>
  )
}
```

**`components/FiltroHistorico.tsx`** — filtro por plataforma e data no lado do cliente:

```typescript
'use client'

import { useState } from 'react'
import { Ticket, Plataforma } from '@/types/ticket'
import { format } from 'date-fns'

const PLATAFORMAS: Plataforma[] = ['Google', 'Reclame Aqui', 'Email', 'WhatsApp', 'Instagram', 'Outro']

export default function FiltroHistorico({ tickets }: { tickets: Ticket[] }) {
  const [plataforma, setPlataforma] = useState<Plataforma | 'Todas'>('Todas')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const ticketsFiltrados = tickets.filter((t) => {
    const passaPlataforma = plataforma === 'Todas' || t.plataforma === plataforma
    const passaInicio = !dataInicio || t.data_finalizacao! >= dataInicio
    const passaFim = !dataFim || t.data_finalizacao! <= dataFim + 'T23:59:59'
    return passaPlataforma && passaInicio && passaFim
  })

  return (
    <div>
      {/* Filtros */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <select
          value={plataforma}
          onChange={(e) => setPlataforma(e.target.value as Plataforma | 'Todas')}
          className="border rounded-lg p-2"
        >
          <option value="Todas">Todas as plataformas</option>
          {PLATAFORMAS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="border rounded-lg p-2"
        />
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="border rounded-lg p-2"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-3 text-left">Paciente</th>
              <th className="p-3 text-left">Plataforma</th>
              <th className="p-3 text-left">Tipo</th>
              <th className="p-3 text-left">Finalizado em</th>
            </tr>
          </thead>
          <tbody>
            {ticketsFiltrados.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-3">{t.paciente_nome}</td>
                <td className="p-3">{t.plataforma}</td>
                <td className="p-3">
                  <span className={t.tipo === 'Reclamação' ? 'text-red-600' : 'text-green-600'}>
                    {t.tipo}
                  </span>
                </td>
                <td className="p-3">
                  {t.data_finalizacao
                    ? format(new Date(t.data_finalizacao), 'dd/MM/yyyy HH:mm')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ticketsFiltrados.length === 0 && (
          <p className="text-center text-gray-400 py-8">Nenhum ticket encontrado.</p>
        )}
      </div>
    </div>
  )
}
```

---

## Fase 7 — Geração de Relatório PDF

### 7.1 API Route no Next.js

**`app/api/relatorio/route.ts`:**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { gerarPDF } from '@/lib/pdf/gerarRelatorio'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const inicio = searchParams.get('inicio')
  const fim = searchParams.get('fim')
  const plataforma = searchParams.get('plataforma')

  const supabase = await createClient()

  let query = supabase
    .from('tickets')
    .select('*')
    .eq('status', 'finalizado')
    .gte('data_finalizacao', `${inicio}T00:00:00`)
    .lte('data_finalizacao', `${fim}T23:59:59`)
    .order('data_finalizacao', { ascending: true })

  if (plataforma && plataforma !== 'Todas') {
    query = query.eq('plataforma', plataforma)
  }

  const { data: tickets, error } = await query

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  const pdfBuffer = gerarPDF(tickets ?? [], { inicio: inicio!, fim: fim!, plataforma })

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="relatorio-sac-${inicio}-${fim}.pdf"`,
    },
  })
}
```

### 7.2 Gerador de PDF

**`lib/pdf/gerarRelatorio.ts`:**

```typescript
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Ticket } from '@/types/ticket'
import { format, differenceInHours } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function gerarPDF(
  tickets: Ticket[],
  filtros: { inicio: string; fim: string; plataforma?: string | null }
): Buffer {
  const doc = new jsPDF()

  // Métricas do resumo
  const total = tickets.length
  const elogios = tickets.filter((t) => t.tipo === 'Elogio').length
  const reclamacoes = tickets.filter((t) => t.tipo === 'Reclamação').length
  const duvidas = tickets.filter((t) => t.tipo === 'Dúvida').length
  const tempoMedioHoras =
    tickets.reduce((acc, t) => {
      if (!t.data_finalizacao) return acc
      return acc + differenceInHours(new Date(t.data_finalizacao), new Date(t.data_criacao))
    }, 0) / (total || 1)

  // Cabeçalho
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Relatório de Atendimentos — SAC', 14, 20)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Período: ${format(new Date(filtros.inicio), 'dd/MM/yyyy', { locale: ptBR })} a ${format(new Date(filtros.fim), 'dd/MM/yyyy', { locale: ptBR })}`,
    14, 30
  )
  if (filtros.plataforma && filtros.plataforma !== 'Todas') {
    doc.text(`Plataforma: ${filtros.plataforma}`, 14, 36)
  }

  // Resumo executivo
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo Executivo', 14, 48)

  autoTable(doc, {
    startY: 52,
    head: [['Total', '% Elogios', '% Reclamações', '% Dúvidas', 'Tempo Médio de Resolução']],
    body: [[
      total.toString(),
      `${total ? Math.round((elogios / total) * 100) : 0}%`,
      `${total ? Math.round((reclamacoes / total) * 100) : 0}%`,
      `${total ? Math.round((duvidas / total) * 100) : 0}%`,
      `${Math.round(tempoMedioHoras)}h`,
    ]],
    styles: { fontSize: 10 },
    headStyles: { fillColor: [37, 99, 235] },
  })

  // Lista de tickets
  const afterSummary = (doc as any).lastAutoTable.finalY + 10
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Detalhamento dos Atendimentos', 14, afterSummary)

  autoTable(doc, {
    startY: afterSummary + 4,
    head: [['Paciente', 'Plataforma', 'Tipo', 'Descrição', 'Finalizado em']],
    body: tickets.map((t) => [
      t.paciente_nome,
      t.plataforma,
      t.tipo,
      t.descricao?.substring(0, 60) + (t.descricao?.length > 60 ? '...' : '') || '',
      t.data_finalizacao
        ? format(new Date(t.data_finalizacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })
        : '—',
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: {
      3: { cellWidth: 60 },
    },
  })

  return Buffer.from(doc.output('arraybuffer'))
}
```

---

## Fase 8 — Tela de Relatório

**`app/(dashboard)/relatorio/page.tsx`:**

```typescript
'use client'

import { useState } from 'react'

const PLATAFORMAS = ['Todas', 'Google', 'Reclame Aqui', 'Email', 'WhatsApp', 'Instagram', 'Outro']

export default function RelatorioPage() {
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [plataforma, setPlataforma] = useState('Todas')
  const [gerando, setGerando] = useState(false)

  async function gerarRelatorio() {
    if (!inicio || !fim) return alert('Preencha o período completo.')
    setGerando(true)

    const params = new URLSearchParams({ inicio, fim, plataforma })
    const response = await fetch(`/api/relatorio?${params}`)

    if (!response.ok) {
      alert('Erro ao gerar relatório.')
      setGerando(false)
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `relatorio-sac-${inicio}-${fim}.pdf`
    link.click()
    URL.revokeObjectURL(url)
    setGerando(false)
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Gerar Relatório para Diretoria</h1>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Data de Início</label>
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="w-full border rounded-lg p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Data de Fim</label>
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="w-full border rounded-lg p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Plataforma</label>
          <select
            value={plataforma}
            onChange={(e) => setPlataforma(e.target.value)}
            className="w-full border rounded-lg p-2"
          >
            {PLATAFORMAS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <button
          onClick={gerarRelatorio}
          disabled={gerando}
          className="w-full bg-blue-600 text-white rounded-lg p-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {gerando ? 'Gerando PDF...' : 'Exportar PDF'}
        </button>
      </div>
    </div>
  )
}
```

---

## Fase 9 — Deploy na Vercel

### 9.1 Preparar o repositório

```bash
git init
git add .
git commit -m "feat: sistema SAC inicial"
```

Crie um repositório no GitHub e faça o push:

```bash
git remote add origin https://github.com/SEU_USUARIO/sac-system.git
git push -u origin main
```

### 9.2 Configurar na Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório do GitHub
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Clique em **Deploy**

### 9.3 Configurar URL no Supabase

No painel do Supabase → **Authentication → URL Configuration**, adicione a URL da Vercel como **Site URL** e em **Redirect URLs**:

```
https://SEU-PROJETO.vercel.app/**
```

---

## Resumo das Fases

| Fase | O que fazer | Estimativa |
|------|-------------|-----------|
| 1 | Setup do ambiente e instalação | 1h |
| 2 | Banco de dados e RLS no Supabase | 1h |
| 3 | Autenticação com Supabase Auth | 2h |
| 4 | Tipos TypeScript | 30min |
| 5 | Kanban com cards e modal de criação | 4h |
| 6 | Tela de histórico com filtros | 2h |
| 7 | Geração de PDF | 3h |
| 8 | Tela de relatório | 1h |
| 9 | Deploy na Vercel | 1h |
| **Total** | | **~15h** |

---

## Próximos Passos após o MVP

Quando o MVP estiver rodando, as evoluções naturais são:

- **Integração com APIs** — Google Meu Negócio e Reclame Aqui para capturar mensagens automaticamente
- **Notificações** — Alerta por email ou WhatsApp quando um novo ticket for criado
- **Múltiplos usuários** — Painel de administração para gerenciar a equipe
- **Métricas avançadas** — Dashboard com gráficos de tendência por período

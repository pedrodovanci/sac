# Prompt de Correções — Sistema SAC Enterprise

## Contexto

O protótipo entregue está visualmente muito bom, mas existem **7 problemas que precisam ser corrigidos antes da integração com o backend**. Algumas são correções de código, outras são decisões de arquitetura. Siga a ordem de prioridade abaixo.

---

## 🔴 Prioridade Alta — Fazer Primeiro

---

### Correção 1 — Migrar de Vite para Next.js 14 (App Router)

**Problema:** O projeto foi entregue em React + Vite. O backend será construído em Next.js 14 com App Router, usando Server Components, API Routes nativas (`/api/relatorio/route.ts`) e middleware de autenticação do Supabase. Se o frontend permanecer em Vite, serão duas aplicações separadas, complicando o deploy na Vercel e dobrando a complexidade de manutenção.

**O que fazer:**

1. Criar um novo projeto Next.js e migrar os componentes:

```bash
npx create-next-app@latest sac-enterprise --typescript --tailwind --app
cd sac-enterprise
npm install lucide-react date-fns motion
```

2. Recriar a estrutura de pastas conforme o plano:

```
sac-enterprise/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx        ← componente Login.tsx migrado
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── kanban/page.tsx       ← componente Kanban.tsx migrado
│   │   ├── historico/page.tsx    ← componente History.tsx migrado
│   │   ├── relatorio/page.tsx    ← componente Reports.tsx migrado
│   │   └── layout.tsx            ← componente Layout.tsx migrado (sidebar)
├── components/
│   ├── KanbanBoard.tsx
│   ├── TicketCard.tsx
│   ├── TicketModal.tsx
│   └── FiltroHistorico.tsx
├── types/
│   └── ticket.ts
└── mocks/
    └── tickets.ts
```

3. Adaptar o roteamento: o `App.tsx` com `useState<View>` deve ser substituído pelas rotas nativas do Next.js. A navegação entre páginas usa `<Link href="/kanban">` do `next/link`, não troca de estado.

4. A rota `/` deve redirecionar para `/login`. Criar `app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
export default function RootPage() {
  redirect('/login')
}
```

5. O login mockado deve redirecionar via `useRouter` do `next/navigation`:

```typescript
'use client'
import { useRouter } from 'next/navigation'

// Dentro do handleSubmit:
const router = useRouter()
setTimeout(() => {
  router.push('/kanban')
}, 1500)
```

**Atenção:** Todo componente que usa `useState`, `useEffect` ou eventos do browser precisa ter `'use client'` na primeira linha. Componentes sem interatividade podem ser Server Components (sem essa diretiva).

---

### Correção 2 — Alinhar Plataformas com o Banco de Dados

**Problema:** O banco de dados foi definido com um `enum` específico. O frontend usa valores diferentes que vão causar erros de validação na integração.

**Banco de dados aceita exatamente:**
```
'Google' | 'Reclame Aqui' | 'Email' | 'WhatsApp' | 'Instagram' | 'Outro'
```

**Frontend está usando atualmente:**
```
'WhatsApp' | 'E-mail' | 'Telefone' | 'Web Portal' | 'Google'
```

**O que corrigir:**

Atualizar o type em `types/ticket.ts`:

```typescript
export type Plataforma =
  | 'Google'
  | 'Reclame Aqui'
  | 'Email'
  | 'WhatsApp'
  | 'Instagram'
  | 'Outro'
```

Atualizar o select no `TicketModal` para usar exatamente esses valores:

```tsx
<option value="">Selecione a origem</option>
<option value="Google">Google</option>
<option value="Reclame Aqui">Reclame Aqui</option>
<option value="Email">Email</option>
<option value="WhatsApp">WhatsApp</option>
<option value="Instagram">Instagram</option>
<option value="Outro">Outro</option>
```

Atualizar o select de filtro no `FiltroHistorico` com as mesmas opções.

Atualizar a função `PlatformIcon` no `Kanban.tsx` e `History.tsx` para refletir as novas plataformas:

```typescript
function PlatformIcon({ platform }: { platform: Plataforma }) {
  switch (platform) {
    case 'WhatsApp':    return <MessageSquare className="h-4 w-4 text-green-500" />
    case 'Google':      return <Globe className="h-4 w-4 text-red-500" />
    case 'Reclame Aqui': return <AlertCircle className="h-4 w-4 text-orange-500" />
    case 'Email':       return <Mail className="h-4 w-4 text-blue-500" />
    case 'Instagram':   return <Instagram className="h-4 w-4 text-pink-500" />
    case 'Outro':       return <HelpCircle className="h-4 w-4 text-slate-400" />
    default:            return null
  }
}
```

Atualizar os dados mockados em `mocks/tickets.ts` para usar apenas os valores válidos.

---

### Correção 3 — Implementar Movimentação de Cards no Kanban

**Problema:** Os botões `MoveLeft` e `MoveRight` nos cards existem visualmente mas não têm `onClick` — clicar neles não faz nada.

**O que implementar:**

O estado dos tickets deve ficar no componente pai (`KanbanBoard`). Cada card recebe uma função `onAvancar` e uma `onVoltar` como prop.

Em `KanbanBoard.tsx`, adicionar a função de atualização:

```typescript
const [tickets, setTickets] = useState<Ticket[]>(ticketsMock)

const ORDEM_STATUS: Status[] = ['a_responder', 'em_atendimento', 'finalizado']

function moverTicket(id: string, direcao: 'avancar' | 'voltar') {
  setTickets(prev => prev.map(t => {
    if (t.id !== id) return t
    const indexAtual = ORDEM_STATUS.indexOf(t.status)
    const novoIndex = direcao === 'avancar' ? indexAtual + 1 : indexAtual - 1
    if (novoIndex < 0 || novoIndex >= ORDEM_STATUS.length) return t
    return {
      ...t,
      status: ORDEM_STATUS[novoIndex],
      ...(ORDEM_STATUS[novoIndex] === 'finalizado' && {
        data_finalizacao: new Date().toISOString()
      })
    }
  }))
}
```

Em `TicketCard.tsx`, conectar os botões:

```tsx
{ticket.status !== 'finalizado' && (
  <button onClick={() => onAvancar(ticket.id)}>
    <MoveRight className="h-3.5 w-3.5" />
  </button>
)}
{ticket.status !== 'a_responder' && (
  <button onClick={() => onVoltar(ticket.id)}>
    <MoveLeft className="h-3.5 w-3.5" />
  </button>
)}
```

---

### Correção 4 — Conectar Filtros do Histórico ao Estado

**Problema:** Os selects e inputs de data no Histórico têm visual mas não estão ligados a nenhum `useState` — filtrar não produz nenhum efeito.

**O que implementar em `FiltroHistorico.tsx`:**

```typescript
'use client'

import { useState, useMemo } from 'react'
import { Ticket, Plataforma } from '@/types/ticket'

const PLATAFORMAS: Plataforma[] = ['Google', 'Reclame Aqui', 'Email', 'WhatsApp', 'Instagram', 'Outro']

export default function FiltroHistorico({ tickets }: { tickets: Ticket[] }) {
  const [plataforma, setPlataforma] = useState<Plataforma | 'Todas'>('Todas')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const ticketsFiltrados = useMemo(() => {
    return tickets.filter(t => {
      const passaPlataforma = plataforma === 'Todas' || t.plataforma === plataforma
      const passaInicio = !dataInicio || t.data_finalizacao! >= dataInicio
      const passaFim = !dataFim || t.data_finalizacao! <= dataFim + 'T23:59:59'
      return passaPlataforma && passaInicio && passaFim
    })
  }, [tickets, plataforma, dataInicio, dataFim])

  return (
    <div>
      {/* Filtros conectados ao estado */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={plataforma}
          onChange={e => setPlataforma(e.target.value as Plataforma | 'Todas')}
        >
          <option value="Todas">Todas as plataformas</option>
          {PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <input
          type="date"
          value={dataInicio}
          onChange={e => setDataInicio(e.target.value)}
        />
        <input
          type="date"
          value={dataFim}
          onChange={e => setDataFim(e.target.value)}
        />
      </div>

      {/* Tabela usando ticketsFiltrados */}
      {ticketsFiltrados.length === 0 && (
        <p className="text-center text-gray-400 py-8">
          Nenhum ticket encontrado para os filtros selecionados.
        </p>
      )}
      {/* ... resto da tabela usando ticketsFiltrados */}
    </div>
  )
}
```

---

### Correção 5 — Capturar Telefone e E-mail no Submit do Modal

**Problema:** Os campos de telefone e e-mail existem no formulário visualmente, mas o `handleSubmit` em `NewTicketModal.tsx` não lê esses valores — eles são silenciosamente descartados quando o ticket é criado.

**O que corrigir em `NewTicketModal.tsx`:**

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault()
  const formData = new FormData(e.target as HTMLFormElement)
  
  const ticket: Partial<Ticket> = {
    paciente_nome:     formData.get('patient-name') as string,
    paciente_telefone: formData.get('patient-phone') as string || undefined,  // ← adicionar
    paciente_email:    formData.get('patient-email') as string || undefined,  // ← adicionar
    descricao:         formData.get('description') as string,
    plataforma:        formData.get('platform') as Plataforma,
    tipo:              formData.get('ticket-type') as Tipo,
    status:            formData.get('status') as Status,
    data_criacao:      new Date().toISOString(),
  }
  
  onSubmit(ticket)
}
```

Garantir também que o type `Ticket` em `types/ticket.ts` tem esses campos:

```typescript
export interface Ticket {
  id: string
  paciente_nome: string
  paciente_telefone?: string   // ← campo opcional
  paciente_email?: string      // ← campo opcional
  plataforma: Plataforma
  tipo: Tipo
  status: Status
  descricao: string
  observacao?: string
  data_criacao: string
  data_finalizacao?: string
  criado_por?: string
}
```

---

## 🟡 Prioridade Média — Fazer em Seguida

---

### Correção 6 — Definir e Padronizar o Tipo "Suporte"

**Decisão tomada:** O tipo `Suporte` foi **mantido** no sistema.

**O que fazer:** Atualizar o type no `types/ticket.ts` para incluí-lo:

```typescript
export type Tipo = 'Elogio' | 'Reclamação' | 'Dúvida' | 'Suporte'
```

E garantir que o `getTypeStyle` em todos os componentes (`Kanban.tsx`, `History.tsx`) tem o estilo correto para `Suporte`:

```typescript
case 'Suporte': return 'bg-orange-500/10 text-orange-600'
```

O gerador de PDF e o resumo executivo no Relatório também precisarão contabilizar `Suporte` como categoria separada quando o backend for integrado. Deixar um comentário no código indicando isso:

```typescript
// TODO: incluir contagem de 'Suporte' no resumo quando backend for integrado
```

---

### Correção 7 — Traduzir Todos os Textos para Português

**Problema:** Vários textos estão em inglês sem consistência.

Substituir todos os textos abaixo:

| Onde | Texto atual (EN) | Texto correto (PT) |
|---|---|---|
| `Layout.tsx` — sidebar | `New Ticket` | `+ Novo Ticket` |
| `Layout.tsx` — header | `Service Desk` | `Central de Atendimento` |
| `Layout.tsx` — header | `Search tickets...` | `Buscar tickets...` |
| `Layout.tsx` — nav | `History` | `Histórico` |
| `Layout.tsx` — nav | `Reports` | `Relatórios` |
| `Layout.tsx` — nav | `Logout` | `Sair` |
| `History.tsx` — título | `Ticket History` | `Histórico de Atendimentos` |
| `History.tsx` — subtítulo | `Review finalized tickets and resolutions.` | `Consulte os tickets finalizados e suas resoluções.` |
| `History.tsx` — filtro | `Platform` | `Plataforma` |
| `History.tsx` — filtro | `All Platforms` | `Todas as plataformas` |
| `History.tsx` — filtro | `Start Date` | `Data Início` |
| `History.tsx` — filtro | `End Date` | `Data Fim` |
| `History.tsx` — filtro | `Apply Filters` | `Filtrar` |
| `History.tsx` — paginação | `Showing X to Y of Z entries` | `Exibindo X a Y de Z registros` |
| `Kanban.tsx` — subtítulo | `Manage and track customer interactions.` | `Gerencie e acompanhe os atendimentos.` |

---

## ✅ Checklist de Entrega das Correções

Antes de considerar a tarefa concluída, verificar:

- [ ] Projeto roda com `npm run dev` sem erros no terminal
- [ ] `npm run build` passa sem erros de TypeScript
- [ ] Estrutura de pastas segue o padrão Next.js App Router
- [ ] Rota `/` redireciona para `/login`
- [ ] Rota `/login` redireciona para `/kanban` após o mock de login
- [ ] Todas as plataformas no frontend batem exatamente com o enum do banco
- [ ] Clicar em `→` no card move-o para a próxima coluna
- [ ] Clicar em `←` no card move-o para a coluna anterior
- [ ] Ao mover para "Finalizados", `data_finalizacao` é preenchida
- [ ] Filtros de plataforma e data no Histórico funcionam em tempo real
- [ ] Mensagem de estado vazio aparece quando nenhum ticket corresponde ao filtro
- [ ] Campos telefone e e-mail são salvos ao criar ticket (verificar no estado local)
- [ ] Nenhum texto em inglês visível ao usuário
- [ ] Tipo `Suporte` tem estilo visual correto em todos os componentes

---

## Observação Final

O visual e a qualidade do código estão ótimos — não altere o design, as animações ou a estrutura dos componentes além do que está listado acima. O objetivo dessas correções é garantir que o contrato de dados entre frontend e backend seja respeitado e que as interações prometidas no escopo estejam funcionando antes da integração com o Supabase.

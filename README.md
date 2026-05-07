<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SGI (Frontend)

Frontend do sistema **SAC Enterprise** (Central de Atendimento) com Kanban, Histórico e Relatórios.

Status atual:
- Migrado para **Next.js 14 (App Router)**.
- Fluxo de autenticação é **mockado** (sem Supabase ainda).
- Dados são **mockados em memória** (sem persistência).

Este README foi escrito para o dev de backend entender como o frontend está hoje e o que falta para integrar com **Supabase**.

## Stack
- Next.js 14 (App Router)
- React
- Tailwind CSS
- motion (animações)
- lucide-react (ícones)

## Como rodar
Pré-requisitos: Node.js 18+

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Estrutura do projeto (rotas)
O projeto usa route groups do App Router:

- `app/(auth)/login/page.tsx`: página de login (mock)
- `app/(dashboard)/layout.tsx`: layout do dashboard (sidebar + header + modal)
- `app/(dashboard)/kanban/page.tsx`: Kanban
- `app/(dashboard)/historico/page.tsx`: Histórico
- `app/(dashboard)/relatorio/page.tsx`: Relatórios
- `app/page.tsx`: redirect `/` → `/login`

Rotas expostas:
- `/` → redireciona para `/login`
- `/login` → ao enviar o formulário, redireciona para `/kanban`
- `/kanban` → dashboard Kanban
- `/historico` → tabela de tickets finalizados
- `/relatorio` → UI de geração de relatório (ainda mock)

## Estado e dados (mock)
O “estado global” do dashboard fica em um provider client-side:

- `app/(dashboard)/DashboardState.tsx`: mantém `tickets` e `isNewTicketModalOpen`
- Inicializa com `src/constants.ts` (`MOCK_TICKETS`)
- Criação de ticket via modal: cria um `Ticket` local e adiciona no topo do array no provider (ver `app/(dashboard)/layout.tsx`)

## Modelo de dados atual (frontend)
O modelo do frontend hoje está em `src/types.ts`:

```ts
export type Status = 'a_responder' | 'em_atendimento' | 'finalizado'

export type Tipo = 'Elogio' | 'Reclamação' | 'Dúvida' | 'Suporte'

export type Plataforma =
  | 'Google'
  | 'Reclame Aqui'
  | 'Email'
  | 'WhatsApp'
  | 'Instagram'
  | 'Outro'

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
```

Observações importantes para integração:
- O modal captura e persiste `paciente_telefone` e `paciente_email` no `Ticket` (estado local).
- As datas (`data_criacao`, `data_finalizacao`) são ISO 8601 (string).

## Componentes principais
- Kanban: `src/components/Kanban.tsx`
  - Colunas: `a_responder`, `em_atendimento`, `finalizado` (labels em PT na UI)
  - Botões de mover (`MoveLeft`/`MoveRight`) atualizam `status` e preenchem `data_finalizacao` ao finalizar
- Histórico: `src/components/History.tsx`
  - Filtros de plataforma e data estão conectados ao estado
  - Mostra mensagem de estado vazio quando não há resultados
- Relatórios: `src/components/Reports.tsx`
  - Geração ainda é mock (spinner/timeout); não há PDF nem backend

## Integração com Supabase (o que falta / o que o backend precisa)
Hoje não há `@supabase/supabase-js` nem API routes no projeto. A integração esperada é:

### 1) Autenticação e proteção de rotas
Objetivo: `/kanban`, `/historico`, `/relatorio` exigirem sessão válida; `/login` para anônimos.

Sugestão de implementação:
- Adicionar Supabase Auth (session/cookies) e middleware de autenticação para o route group `(dashboard)`.
- Substituir o login mock por `supabase.auth.signInWithPassword` (ou SSO, se aplicável).
- Substituir o “logout” por `supabase.auth.signOut`.

### 2) Contrato de dados (frontend vs banco)
O arquivo de requisitos de correções aponta o contrato alvo para o banco:
- `plan/prompt_correcoes_frontend.md`

Pontos que impactam diretamente o backend:
- Enum de plataformas (banco aceita exatamente):
  - `Google | Reclame Aqui | Email | WhatsApp | Instagram | Outro`
- O frontend já está padronizado para `snake_case` e datas ISO.

O contrato esperado pelo backend hoje é o mesmo do frontend (`Ticket` em `src/types.ts`).

### 3) Endpoints esperados (sugestão)
Mesmo com Supabase, é útil ter API routes do Next para encapsular regras/validações:
- `GET /api/tickets?status=...&plataforma=...&inicio=...&fim=...`
- `POST /api/tickets` (criar ticket)
- `PATCH /api/tickets/:id` (atualizar status/observação, finalizar ticket)
- `GET /api/relatorio?inicio=...&fim=...` (resumo + dados para PDF)

### 4) Banco (sugestão de campos mínimos)
Tabela `tickets` (exemplo):
- `id` (uuid)
- `paciente_nome` (text)
- `paciente_telefone` (text, opcional)
- `paciente_email` (text, opcional)
- `plataforma` (enum)
- `tipo` (enum incluindo `Suporte`)
- `status` (enum)
- `descricao` (text)
- `observacao` (text, opcional)
- `data_criacao` (timestamptz)
- `data_finalizacao` (timestamptz, opcional)
- `criado_por` (uuid user)

## Variáveis de ambiente
Hoje existe apenas um exemplo antigo (Gemini/AI Studio) em `.env.example`.

Para Supabase, o esperado é criar um `.env.local` com:
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...` (somente server-side, se necessário)

## Observações de migração
- Existe um middleware temporário para responder `/@vite/client` (resquício de cache do Vite em alguns previews): `middleware.ts`. Pode ser removido quando não houver mais requests para esse path.

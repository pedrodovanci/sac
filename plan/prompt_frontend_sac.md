# Prompt para Desenvolvedor Frontend — Sistema SAC

## Contexto

Você irá construir as **telas (UI) de um sistema interno de SAC (Serviço de Atendimento ao Cliente)** no modelo Kanban. O sistema será usado por atendentes para registrar e acompanhar tickets de clientes vindos de diferentes plataformas (Google, Reclame Aqui, WhatsApp, etc.).

Sua tarefa neste momento é **construir apenas o frontend com dados mockados (estáticos)**. A integração com o backend e banco de dados será feita em um segundo momento pelo time de backend. O seu trabalho é entregar as telas com layout, componentes e interações visuais prontos.

---

## Stack Obrigatória

| Tecnologia | Uso |
|---|---|
| **Next.js 14+** com App Router | Framework principal |
| **TypeScript** | Tipagem em todos os arquivos |
| **Tailwind CSS** | Estilização (sem CSS externo, sem styled-components) |
| **lucide-react** | Ícones (`npm install lucide-react`) |
| **date-fns** | Formatação de datas (`npm install date-fns`) |

> Não instale bibliotecas de componentes externas (como shadcn, MUI, Chakra). O visual deve ser construído com Tailwind puro.

---

## Estrutura de Pastas Esperada

```
sac-system/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── kanban/
│   │   │   └── page.tsx
│   │   ├── historico/
│   │   │   └── page.tsx
│   │   ├── relatorio/
│   │   │   └── page.tsx
│   │   └── layout.tsx        ← sidebar/navbar compartilhada
├── components/
│   ├── KanbanBoard.tsx
│   ├── TicketCard.tsx
│   ├── TicketModal.tsx
│   └── FiltroHistorico.tsx
├── types/
│   └── ticket.ts             ← tipos TypeScript do domínio
└── mocks/
    └── tickets.ts            ← dados mockados para desenvolvimento
```

---

## Tipos TypeScript

Crie o arquivo `types/ticket.ts` com exatamente estes tipos. O backend seguirá esse mesmo contrato:

```typescript
export type Plataforma =
  | 'Google'
  | 'Reclame Aqui'
  | 'Email'
  | 'WhatsApp'
  | 'Instagram'
  | 'Outro'

export type Tipo = 'Elogio' | 'Reclamação'

export type Status = 'a_responder' | 'em_atendimento' | 'finalizado'

export interface Ticket {
  id: string
  paciente_nome: string
  plataforma: Plataforma
  tipo: Tipo
  status: Status
  descricao: string
  observacao?: string
  data_criacao: string        // ISO string
  data_finalizacao?: string   // ISO string, preenchido ao finalizar
  criado_por?: string
}

export interface NovoTicket {
  paciente_nome: string
  plataforma: Plataforma
  tipo: Tipo
  status: Status
  descricao: string
  observacao?: string
}
```

---

## Dados Mockados

Crie o arquivo `mocks/tickets.ts` com pelo menos **8 tickets variados** cobrindo todos os status, plataformas e tipos. Exemplo de estrutura:

```typescript
import { Ticket } from '@/types/ticket'

export const ticketsMock: Ticket[] = [
  {
    id: '1',
    paciente_nome: 'Maria Oliveira',
    plataforma: 'Google',
    tipo: 'Reclamação',
    status: 'a_responder',
    descricao: 'Aguardei 40 minutos sem ser atendida na recepção.',
    data_criacao: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30min atrás
  },
  {
    id: '2',
    paciente_nome: 'João Pereira',
    plataforma: 'WhatsApp',
    tipo: 'Elogio',
    status: 'em_atendimento',
    descricao: 'Atendimento excelente da Dra. Ana.',
    observacao: 'Paciente já foi contatado, aguardando confirmação.',
    data_criacao: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h atrás
  },
  // ... adicione mais 6 tickets variando status, plataforma e tipo
]
```

---

## Telas a Construir

---

### Tela 1 — Login (`app/(auth)/login/page.tsx`)

**Objetivo:** Página de acesso ao sistema. Visual simples e centralizado.

**Elementos obrigatórios:**
- Logo ou título da empresa (pode usar texto "SAC — Acesso" por enquanto)
- Campo de email
- Campo de senha
- Botão "Entrar"
- Mensagem de erro visível quando as credenciais forem inválidas (estado: `erro: string`)
- Estado de loading no botão enquanto processa (`carregando: boolean`)

**Comportamento mockado:** Ao clicar em "Entrar" com qualquer email/senha, simular um loading de 1 segundo e redirecionar para `/kanban`. Se o email não tiver `@`, exibir a mensagem de erro.

**Observações de layout:**
- Fundo cinza claro (`bg-gray-50`), card branco centralizado
- Largura máxima do card: `max-w-sm`
- Sem link de "esqueci a senha" ou "cadastro" — é sistema interno

---

### Tela 2 — Layout do Dashboard (`app/(dashboard)/layout.tsx`)

**Objetivo:** Wrapper com sidebar de navegação que envolve todas as telas do dashboard.

**Elementos obrigatórios na sidebar:**
- Nome/logo do sistema no topo
- Links de navegação:
  - 🗂 **Kanban** → `/kanban`
  - 📋 **Histórico** → `/historico`
  - 📄 **Relatório** → `/relatorio`
- Indicação visual do link ativo (destaque diferente)
- Botão de logout no rodapé da sidebar (apenas visual, sem funcionalidade real no mock)

**Observações de layout:**
- Sidebar fixa na lateral esquerda, largura de ~220px
- Conteúdo principal ocupa o restante da tela
- Use ícones do `lucide-react` nos links (ex: `LayoutDashboard`, `History`, `FileText`)

---

### Tela 3 — Kanban (`app/(dashboard)/kanban/page.tsx`)

**Objetivo:** Tela principal do sistema. Exibe os tickets em formato Kanban com 3 colunas.

**As 3 colunas (em ordem):**

| Coluna | Status | Cor de destaque |
|--------|--------|----------------|
| A Responder | `a_responder` | Vermelho/laranja |
| Em Atendimento | `em_atendimento` | Amarelo/azul |
| Finalizados | `finalizado` | Verde |

**Elementos obrigatórios:**
- Título da página "Central de Atendimento"
- Botão **"+ Novo Ticket"** no canto superior direito
- Cada coluna exibe seu label, contagem de tickets entre parênteses e os cards abaixo
- Ao clicar em **"+ Novo Ticket"**, abre o `TicketModal`

**Componente `TicketCard`** — cada card deve exibir:
- Nome do paciente (destaque em negrito)
- Badge colorida com o tipo: `Reclamação` (vermelho) ou `Elogio` (verde)
- Nome da plataforma (texto pequeno, cinza)
- Borda esquerda colorida de acordo com o tipo (vermelho = reclamação, verde = elogio)
- Botão de avançar status (exceto na coluna "Finalizados"):
  - Coluna "A Responder" → botão **"Iniciar Atendimento →"**
  - Coluna "Em Atendimento" → botão **"Marcar como Resolvido →"**
  - Ao clicar no botão, mover o card para a próxima coluna (atualizar estado local, sem backend)

**Componente `TicketModal`** — formulário de criação de ticket:
- Campo: Nome do paciente (texto)
- Campo: Plataforma (select com as opções: Google, Reclame Aqui, Email, WhatsApp, Instagram, Outro)
- Campo: Tipo (select: Elogio, Reclamação)
- Campo: Status inicial (select: A Responder, Em Atendimento — não permitir criar já como Finalizado)
- Campo: Descrição (textarea)
- Campo: Observação interna (textarea, opcional)
- Botão "Salvar" e botão "Cancelar"
- Ao salvar, adicionar o ticket ao estado local com um `id` aleatório (`crypto.randomUUID()`) e fechar o modal
- Modal com overlay escuro, centralizado, `max-w-lg`

---

### Tela 4 — Histórico (`app/(dashboard)/historico/page.tsx`)

**Objetivo:** Tabela com todos os tickets finalizados, com filtros.

**Componente `FiltroHistorico`:**

Filtros no topo (em linha, `flex gap-4`):
- Select de plataforma: "Todas as plataformas" + as 6 opções
- Input de data início (`type="date"`)
- Input de data fim (`type="date"`)

Os filtros devem funcionar no frontend, filtrando os dados mockados em tempo real (sem precisar de backend).

**Tabela de resultados:**

| Coluna | Campo |
|--------|-------|
| Paciente | `paciente_nome` |
| Plataforma | `plataforma` |
| Tipo | `tipo` (colorido: vermelho = reclamação, verde = elogio) |
| Descrição | `descricao` (truncar em 60 caracteres) |
| Finalizado em | `data_finalizacao` formatado como `dd/MM/yyyy HH:mm` |

**Estado vazio:** Quando nenhum ticket bater com os filtros, exibir mensagem centralizada: *"Nenhum ticket encontrado para os filtros selecionados."*

**Observações:**
- Use os tickets mockados com `status: 'finalizado'` para popular essa tela
- Tabela com cabeçalho cinza (`bg-gray-50`), linhas separadas por borda
- Container com `overflow-auto` para responsividade

---

### Tela 5 — Relatório (`app/(dashboard)/relatorio/page.tsx`)

**Objetivo:** Formulário para a atendente configurar e exportar o relatório em PDF.

**Elementos obrigatórios:**
- Título "Gerar Relatório para Diretoria"
- Card branco centralizado (`max-w-lg`) com os campos:
  - Data de Início (`type="date"`)
  - Data de Fim (`type="date"`)
  - Plataforma (select com as opções + "Todas")
  - Botão **"Exportar PDF"**
- Estado de loading no botão: **"Gerando PDF..."** enquanto processa
- Validação: se datas não estiverem preenchidas, exibir alerta

**Comportamento mockado:** Ao clicar em "Exportar PDF", simular loading de 2 segundos e exibir um `alert('Relatório gerado com sucesso! (mock)')`. A geração real do PDF será implementada pelo backend.

---

## Checklist de Entrega

Antes de considerar a tarefa concluída, verifique:

- [ ] Projeto roda com `npm run dev` sem erros no terminal
- [ ] Não há erros de TypeScript (`npm run build` passa limpo)
- [ ] Todas as 5 telas estão acessíveis via navegador
- [ ] Sidebar aparece em todas as telas do dashboard
- [ ] Rota `/` redireciona para `/login`
- [ ] Rota `/login` redireciona para `/kanban` ao "logar" com o mock
- [ ] Cards do Kanban avançam de coluna ao clicar no botão de status
- [ ] Modal de criação de ticket abre, salva e fecha corretamente
- [ ] Filtros do histórico funcionam em tempo real
- [ ] Nenhuma tela quebra em telas de 1280px de largura

---

## O que NÃO fazer

- Não integrar com Supabase ou qualquer banco de dados — isso é responsabilidade do backend
- Não criar rotas de API (`/api/...`) — serão criadas pelo backend
- Não implementar autenticação real — use apenas o mock de redirect
- Não instalar bibliotecas de componentes prontas (MUI, shadcn, Chakra, etc.)
- Não usar `localStorage` para persistência — apenas estado React (`useState`)

---

## Observações Finais

O código precisa estar **limpo, componentizado e tipado**. Cada componente em seu próprio arquivo dentro de `components/`. Nenhum componente deve ultrapassar ~150 linhas — se isso acontecer, quebre em sub-componentes.

Quando o backend estiver pronto, a integração será feita substituindo os dados de `mocks/tickets.ts` por chamadas reais ao Supabase. Por isso, **mantenha a lógica de dados separada da lógica de UI** desde o início.

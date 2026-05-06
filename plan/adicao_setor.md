# Prompt de Adição — Campo "Setor" no Sistema SAC Enterprise

## Contexto

Precisamos adicionar um novo campo ao sistema chamado **"Setor"**. Ele identifica qual área da clínica está envolvida no atendimento registrado (ex: reclamação sobre demora na consulta → Setor: Atendimento Consultas).

O campo é **opcional** — nem todo ticket terá setor (ex: elogios genéricos).

---

## 1 — Banco de Dados (Supabase)

Execute no **SQL Editor** do Supabase, nessa ordem:

```sql
-- 1. Criar o enum de setores
CREATE TYPE setor_enum AS ENUM (
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
);

-- 2. Adicionar a coluna na tabela tickets (nullable = opcional)
ALTER TABLE tickets ADD COLUMN setor setor_enum;
```

> A coluna é `nullable` por design — não use `NOT NULL`. Tickets sem setor são válidos.

---

## 2 — Tipos TypeScript (`types/ticket.ts`)

Adicionar o novo type `Setor` e incluir o campo nas interfaces `Ticket` e `NovoTicket`:

```typescript
export type Setor =
  | 'Atendimento Exames'
  | 'Atendimento Consultas'
  | 'Atendimento Médico'
  | 'Atendimento WhatsApp'
  | 'Atendimento Call Center'
  | 'Entrega de Exames'
  | 'Cantina'
  | 'Enfermagem'
  | 'Técnicos'
  | 'Outros'

export interface Ticket {
  id: string
  paciente_nome: string
  paciente_telefone?: string
  paciente_email?: string
  plataforma: Plataforma
  tipo: Tipo
  setor?: Setor              // ← novo campo, opcional
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
  setor?: Setor              // ← novo campo, opcional
  status: Status
  descricao: string
  observacao?: string
}
```

---

## 3 — Modal de Criação (`NewTicketModal.tsx`)

Adicionar o select de **Setor** no formulário, posicionado **entre os campos Tipo e Status**.

O campo deve ter a opção vazia como padrão ("Selecione o setor") e não ser obrigatório (`required` ausente).

```tsx
// Adicionar importação do type
import { Ticket, NovoTicket, Plataforma, Tipo, Status, Setor } from '@/types/ticket'

// Adicionar as opções do select de Setor
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
  'Outros',
]

// Select no JSX — inserir entre Tipo e Status
<div>
  <label className="block text-sm font-medium mb-1">
    Setor <span className="text-gray-400 font-normal">(opcional)</span>
  </label>
  <select name="setor" className="w-full border rounded-lg p-2">
    <option value="">Selecione o setor</option>
    {SETORES.map(s => (
      <option key={s} value={s}>{s}</option>
    ))}
  </select>
</div>
```

No `handleSubmit`, capturar o valor do campo:

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault()
  const formData = new FormData(e.target as HTMLFormElement)
  const setorValue = formData.get('setor') as string

  const ticket: Partial<Ticket> = {
    paciente_nome:     formData.get('patient-name') as string,
    paciente_telefone: formData.get('patient-phone') as string || undefined,
    paciente_email:    formData.get('patient-email') as string || undefined,
    descricao:         formData.get('description') as string,
    plataforma:        formData.get('platform') as Plataforma,
    tipo:              formData.get('ticket-type') as Tipo,
    setor:             setorValue ? (setorValue as Setor) : undefined, // ← novo
    status:            formData.get('status') as Status,
    data_criacao:      new Date().toISOString(),
  }

  onSubmit(ticket)
}
```

---

## 4 — Card do Kanban (`TicketCard.tsx` ou `Kanban.tsx`)

Exibir o setor no card quando preenchido, abaixo da plataforma, em texto pequeno e cinza:

```tsx
{ticket.setor && (
  <p className="text-xs text-gray-400 mt-0.5">
    Setor: {ticket.setor}
  </p>
)}
```

---

## 5 — Tabela do Histórico (`History.tsx`)

Adicionar **Setor** como coluna na tabela, entre **Tipo** e **Descrição**:

```tsx
// Cabeçalho
<th className="p-3 text-left">Setor</th> 

// Célula
<td className="p-3 text-sm text-gray-600">
  {t.setor ?? '—'}
</td>
```

Adicionar também o **filtro de Setor** no topo da tela, ao lado dos filtros existentes de plataforma e data:

```tsx
// Importar Setor nos types
import { Ticket, Plataforma, Setor } from '@/types/ticket'

// Estado do filtro
const [setor, setSetor] = useState<Setor | 'Todos'>('Todos')

// Select do filtro
<select
  value={setor}
  onChange={e => setSetor(e.target.value as Setor | 'Todos')}
  className="border rounded-lg p-2"
>
  <option value="Todos">Todos os setores</option>
  {SETORES.map(s => (
    <option key={s} value={s}>{s}</option>
  ))}
</select>

// Adicionar condição no filtro de tickets
const passaSetor = setor === 'Todos' || t.setor === setor
// incluir passaSetor no return do filter junto com passaPlataforma, passaInicio, passaFim
```

---

## 6 — Dados Mockados (`mocks/tickets.ts` ou `constants.ts`)

Atualizar alguns tickets do mock para incluir o campo `setor`, cobrindo variações:

```typescript
// Exemplos de tickets com setor preenchido
{ ...ticket1, setor: 'Atendimento Consultas' },
{ ...ticket2, setor: 'Enfermagem' },
{ ...ticket3, setor: 'Atendimento Exames' },
// Deixar alguns sem setor para validar o campo opcional
{ ...ticket4 }, // sem setor — deve funcionar normalmente
```

---

## Checklist de Entrega

- [ ] `npm run lint` passa sem erros
- [ ] `npm run build` passa sem erros de TypeScript
- [ ] SQL executado no Supabase (enum + coluna criados)
- [ ] Type `Setor` exportado em `types/ticket.ts`
- [ ] Campo `setor` presente em `Ticket` e `NovoTicket` como opcional
- [ ] Select de Setor aparece no modal entre Tipo e Status
- [ ] Select mostra opção vazia como padrão (campo não obrigatório)
- [ ] `handleSubmit` do modal captura e persiste o valor do setor
- [ ] Card do Kanban exibe o setor quando preenchido, oculta quando vazio
- [ ] Coluna Setor aparece na tabela do Histórico (exibe `—` quando vazio)
- [ ] Filtro de Setor funciona em tempo real no Histórico
- [ ] Dados mockados têm variação: alguns com setor, alguns sem

---

## Observação Final

Não altere o design, as animações ou outros componentes além dos listados acima. O campo `setor` é aditivo — nada do que já existe deve quebrar com essa mudança.
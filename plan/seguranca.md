# SAC Enterprise — Guia de Segurança para Produção

> JWT · Supabase RLS · API Routes · Proteção de Dados
>
> **Versão 1.0 · MVP 2025 · Interno**

---

## 1. Visão Geral da Segurança

A arquitetura adotada é baseada em três pilares:

| Pilar | Descrição |
|---|---|
| **Autenticação** | JWT via Supabase Auth com expiração de 7 dias e refresh automático |
| **Autorização** | Row Level Security (RLS) no banco — nenhuma query chega ao Supabase sem sessão válida |
| **Isolamento** | CRUD da tabela `tickets` passa por API Routes do Next.js. O frontend usa Supabase no browser apenas para autenticação (login/logout) |

> ⛔ **Regra de ouro:** O cliente (browser) nunca deve ter a `SERVICE_ROLE_KEY`. Essa chave bypassa o RLS e dá acesso total ao banco. Ela fica apenas no servidor.

---

## 2. Autenticação JWT — Supabase Auth

### 2.1 Como o JWT funciona no Supabase

O Supabase Auth emite dois tokens quando o usuário faz login:

| Token | Função |
|---|---|
| **access_token** | JWT com vida útil curta (padrão: 1 hora). Enviado em cada request à API |
| **refresh_token** | Token de renovação com vida útil longa. Armazenado em cookie httpOnly. Gera um novo access_token automaticamente quando ele expira |

A sessão completa expira após 7 dias de inatividade do `refresh_token`. Após esse período, o usuário precisa fazer login novamente.

### 2.2 Configurar expiração de 7 dias no Supabase

No painel do Supabase, acesse **Authentication → Configuration → JWT**:

```
JWT expiry limit:  604800  (7 dias em segundos)
```

Ou via SQL:

```sql
ALTER DATABASE postgres
  SET "app.settings.jwt_exp" = '604800';
```

> ⚠️ **Importante:** A expiração do JWT (`access_token`) e a expiração da sessão são coisas diferentes. Configure ambas no painel: JWT Expiry (1h) e Session Timeout (7 dias).

### 2.3 Cookies httpOnly — Por que são seguros

Quando a sessão é mantida em cookies `httpOnly`, isso significa:

- O JavaScript do browser **não consegue** ler o token (`document.cookie` não funciona)
- Protege contra ataques XSS (Cross-Site Scripting)
- O token só é enviado automaticamente em requests ao mesmo domínio
- Não fica exposto no `localStorage` (que é acessível por qualquer script)

> ⚠️ Observação importante (estado atual do projeto): o login/logout hoje é feito em Client Component com o `createBrowserClient` (Supabase no browser). Portanto, **não assuma** que os tokens estão em cookie `httpOnly` sem verificar no DevTools (Application → Storage/Cookies). Se a sessão estiver acessível ao JavaScript, a prioridade passa a ser endurecer CSP + mitigar XSS.

### 2.4 Configuração do Supabase no projeto (estado atual)

`src/lib/supabase/middleware.ts` — usado no middleware para atualizar/renovar sessão:

```typescript
// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options })
      },
      remove(name, options) {
        response.cookies.set({ name, value: '', ...options })
      }
    }
  })

  await supabase.auth.getUser()

  return response
}
```

`src/lib/supabase/client.ts` — usado em Client Components (UI), principalmente para login/logout:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ⚠️  Este client usa ANON KEY — o RLS deve estar ativo
// para impedir acesso não autorizado.
```

> ⛔ **Atenção — ANON KEY vs SERVICE_ROLE_KEY:** A `ANON_KEY` é segura para expor no browser porque o RLS bloqueia qualquer acesso sem sessão válida. A `SERVICE_ROLE_KEY` bypassa TUDO — nunca coloque no frontend.

---

## 3. Proteção de Rotas — Middleware

O middleware intercepta cada request antes de chegar à página, verificando se há sessão válida. Sem isso, um usuário não autenticado poderia acessar `/kanban` diretamente pela URL.

`middleware.ts` (raiz do projeto, estado atual):

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
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse = NextResponse.next({ request })
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Renovação automática do token
  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  const isPublicAsset = request.nextUrl.pathname.startsWith('/_next')
    || request.nextUrl.pathname === '/favicon.ico'

  if (!user && !isAuthRoute && !isPublicAsset) {
    // Não autenticado → redirecionar para login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    // Já logado tentando acessar /login → redirecionar
    return NextResponse.redirect(new URL('/kanban', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

> ✅ **Por que usar `getUser()` no middleware?** O `getUser()` valida a sessão com o Supabase e reduz risco de aceitar tokens manipulados.

---

## 4. API Routes — Frontend Nunca Acessa o Banco Diretamente

Esta é a arquitetura mais importante para segurança do CRUD de `tickets`. O browser chama o Next.js (`/api/tickets...`) e o servidor toca o banco com sessão validada.

> ⚠️ Estado atual: o browser ainda usa Supabase diretamente para autenticação (login/logout). Isso é aceitável, mas o texto acima se aplica ao CRUD da tabela `tickets`.

| Fluxo seguro | Descrição |
|---|---|
| **1. Browser** | Envia request para `/api/tickets` (Next.js server) |
| **2. API Route** | Valida sessão, valida dados de entrada, aplica regras de negócio |
| **3. Supabase** | Recebe apenas queries validadas, protegidas pelo RLS |
| **4. Resposta** | API Route formata e retorna dados limpos ao browser |

### 4.1 Estrutura das API Routes (estado atual)

```
app/
└── api/
    ├── tickets/
    │   ├── route.ts          ← GET (listar) e POST (criar)
    │   └── [id]/
    │       └── route.ts      ← PATCH (atualizar status) e DELETE
```

> ⚠️ Estado atual: o relatório/PDF não é uma API Route. A impressão é gerada no browser via `window.print()` (ex.: `src/components/Reports.tsx` e `src/components/History.tsx`).

### 4.2 GET /api/tickets — Listar tickets

```typescript
// app/api/tickets/route.ts (estado atual usa createServerClient + cookies)
import { NextResponse, NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // 1. Verificar autenticação
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // 2. Parâmetros de query opcionais
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  // 3. Query no banco — RLS garante que só vê dados da empresa
  let query = supabase.from('tickets').select('*')
  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('data_criacao', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

### 4.3 POST /api/tickets — Criar ticket

```typescript
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 1. Verificar autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // 2. Ler e validar body
  const body = await request.json()

  const PLATAFORMAS_VALIDAS = ['Google', 'Reclame Aqui', 'Email', 'WhatsApp', 'Instagram', 'Outro']
  const TIPOS_VALIDOS = ['Elogio', 'Reclamação', 'Dúvida', 'Suporte']
  const STATUS_VALIDOS = ['a_responder', 'em_atendimento']  // não cria já como finalizado

  if (!body.paciente_nome?.trim()) {
    return NextResponse.json({ error: 'Nome do paciente obrigatório' }, { status: 400 })
  }
  if (!PLATAFORMAS_VALIDAS.includes(body.plataforma)) {
    return NextResponse.json({ error: 'Plataforma inválida' }, { status: 400 })
  }
  if (!TIPOS_VALIDOS.includes(body.tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }
  if (!STATUS_VALIDOS.includes(body.status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  // 3. Montar objeto limpo (evitar injeção de campos extras)
  const novoTicket = {
    paciente_nome:     body.paciente_nome.trim().substring(0, 200),
    paciente_telefone: body.paciente_telefone?.trim() || null,
    paciente_email:    body.paciente_email?.trim() || null,
    plataforma:        body.plataforma,
    tipo:              body.tipo,
    setor:             body.setor || null,
    status:            body.status,
    descricao:         body.descricao?.trim().substring(0, 2000) || '',
    observacao:        body.observacao?.trim() || null,
    criado_por:        user.id,   // sempre do servidor, nunca do body
  }

  const { data, error } = await supabase
    .from('tickets')
    .insert(novoTicket)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

### 4.4 PATCH /api/tickets/[id] — Atualizar status

```typescript
// app/api/tickets/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const STATUS_VALIDOS = ['a_responder', 'em_atendimento', 'finalizado']

  if (!STATUS_VALIDOS.includes(body.status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  // Preencher data_finalizacao automaticamente no servidor
  const updates: Record<string, unknown> = { status: body.status }
  if (body.status === 'finalizado') {
    updates.data_finalizacao = new Date().toISOString()
  }

  // Atualizar observação se enviada
  if (body.observacao !== undefined) {
    updates.observacao = body.observacao?.trim() || null
  }

  const { data, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

> ✅ **Por que isso é importante?** Se o frontend chamasse o Supabase diretamente no `TicketCard`, qualquer pessoa inspecionando o network poderia alterar o body e definir `status = 'finalizado'` com uma `data_finalizacao` falsa. Com a API Route, a data é sempre definida pelo servidor.

---

## 5. Row Level Security (RLS) — Segurança no Banco

O RLS é a última linha de defesa. Mesmo que alguém consiga a `ANON_KEY`, sem uma sessão válida nenhum dado é retornado. Execute no SQL Editor do Supabase:

### 5.1 Habilitar RLS e criar políticas

```sql
-- Habilitar RLS na tabela tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Política: qualquer usuário autenticado pode VER tickets
CREATE POLICY "leitura_autenticados"
  ON tickets FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política: qualquer usuário autenticado pode CRIAR tickets
CREATE POLICY "criacao_autenticados"
  ON tickets FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Política: qualquer usuário autenticado pode ATUALIZAR
CREATE POLICY "atualizacao_autenticados"
  ON tickets FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Nenhuma política de DELETE é criada intencionalmente.
-- Tickets nunca são deletados — vão para histórico.
```

### 5.2 Verificar RLS ativo

```sql
-- Confirmar que o RLS está habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Listar políticas ativas
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'tickets';
```

> ⛔ **Teste essencial:** No painel do Supabase, vá em **Table Editor → tickets**. Se você conseguir ver os dados SEM estar logado usando a `ANON_KEY`, o RLS não está funcionando. Faça esse teste antes de ir a produção.

---

## 6. Variáveis de Ambiente

### 6.1 Configuração completa

```env
# .env.local (desenvolvimento)

# Supabase — obrigatórias
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# NUNCA colocar SERVICE_ROLE_KEY como NEXT_PUBLIC_
# Se precisar para tarefas administrativas do servidor:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

| Variável | Onde usar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser e Servidor — é o endereço do projeto, sem risco em expor |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser e Servidor — segura com RLS ativo |
| `SUPABASE_SERVICE_ROLE_KEY` | SOMENTE em scripts de servidor/admin. NUNCA em componentes React |

### 6.2 Configuração na Vercel

No painel da Vercel, vá em **Project → Settings → Environment Variables** e adicione:

- `NEXT_PUBLIC_SUPABASE_URL` → marcar como Production, Preview, Development
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → marcar como Production, Preview, Development
- `SUPABASE_SERVICE_ROLE_KEY` → marcar **APENAS** como Production (se necessário)

> ⛔ **Segredo crítico:** Nunca commite o arquivo `.env.local` no git.
> ```bash
> echo '.env.local' >> .gitignore
> ```

---

## 7. Headers HTTP de Segurança

Adicione esses headers no `next.config.mjs` para proteção adicional no browser:

```javascript
// next.config.mjs
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // Impede que a página seja carregada em iframes (clickjacking)
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            // Impede que o browser "adivinhe" o Content-Type
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // Não enviar o referrer para outros domínios
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // HSTS: forçar HTTPS por 1 ano
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

> Nota: `X-XSS-Protection` é um header legado e não é recomendado como controle moderno. Prefira CSP.

---

## 7.1 Content-Security-Policy (CSP) — recomendado

Se a sessão/token estiver acessível ao JavaScript no browser (ou mesmo por prevenção), use CSP para reduzir impacto de XSS. Um exemplo inicial (ajuste conforme uso real de scripts/fontes):

```js
// next.config.mjs (exemplo)
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self' https://*.supabase.co",
    ].join('; ')
  }
]
```

> ⚠️ CSP pode quebrar a aplicação se não for ajustada para suas dependências. Faça deploy em Preview/Stage antes.

---

## 8. Validação de Entrada — Zod

Instale o Zod para validar e tipar os dados que chegam nas API Routes:

```bash
npm install zod
```

`lib/validations/ticket.ts` — schemas de validação:

```typescript
import { z } from 'zod'

export const PlataformaSchema = z.enum([
  'Google', 'Reclame Aqui', 'Email', 'WhatsApp', 'Instagram', 'Outro'
])

export const TipoSchema = z.enum(['Elogio', 'Reclamação', 'Dúvida', 'Suporte'])

export const StatusSchema = z.enum(['a_responder', 'em_atendimento', 'finalizado'])

export const SetorSchema = z.enum([
  'Atendimento Exames', 'Atendimento Consultas', 'Atendimento Médico',
  'Atendimento WhatsApp', 'Atendimento Call Center', 'Entrega de Exames',
  'Cantina', 'Enfermagem', 'Técnicos', 'Outros'
]).optional()

export const NovoTicketSchema = z.object({
  paciente_nome:     z.string().min(2).max(200).trim(),
  paciente_telefone: z.string().max(20).optional().nullable(),
  paciente_email:    z.string().email().optional().nullable(),
  plataforma:        PlataformaSchema,
  tipo:              TipoSchema,
  setor:             SetorSchema,
  // Não aceita 'finalizado' na criação
  status:            z.enum(['a_responder', 'em_atendimento']),
  descricao:         z.string().max(2000).optional().default(''),
  observacao:        z.string().max(1000).optional().nullable(),
})

export const AtualizarStatusSchema = z.object({
  status:     StatusSchema,
  observacao: z.string().max(1000).optional().nullable(),
})
```

Uso na API Route (substitui a validação manual):

```typescript
const body = await request.json()
const result = NovoTicketSchema.safeParse(body)

if (!result.success) {
  return NextResponse.json(
    { error: 'Dados inválidos', details: result.error.flatten() },
    { status: 400 }
  )
}

// result.data agora é tipado e seguro
const novoTicket = { ...result.data, criado_por: user.id }
```

---

## 9. Rate Limiting — Proteção contra Abuso

Para o MVP, o Supabase já tem limites embutidos. Para produção mais robusta, adicione rate limiting nas API Routes críticas:

```bash
npm install @upstash/ratelimit @upstash/redis
# Ou use a opção gratuita com um Map em memória:
```

Rate limiting simples em memória (suficiente para o MVP):

```typescript
// lib/rateLimit.ts
const requests = new Map<string, { count: number; reset: number }>()

export function checkRateLimit(ip: string, limit = 20, windowMs = 60000) {
  const now = Date.now()
  const record = requests.get(ip)

  if (!record || now > record.reset) {
    requests.set(ip, { count: 1, reset: now + windowMs })
    return { allowed: true }
  }

  if (record.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((record.reset - now) / 1000) }
  }

  record.count++
  return { allowed: true }
}

// Uso na API Route:
const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
const { allowed, retryAfter } = checkRateLimit(ip)
if (!allowed) {
  return NextResponse.json(
    { error: 'Muitas requisições' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}
```

---

## 10. Checklist de Segurança — Pré-Deploy

| Item | Como verificar |
|---|---|
| ✅ RLS ativo | `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` |
| ✅ Políticas criadas | `SELECT * FROM pg_policies WHERE tablename = 'tickets'` |
| ✅ Sem `SERVICE_ROLE_KEY` no frontend | `grep -r 'SERVICE_ROLE' ./app ./components` — não deve retornar nada |
| ✅ Sem queries diretas ao Supabase (tabela tickets) no frontend | `grep -r "from('tickets')" ./app ./src --include='*.tsx'` — deve aparecer só em `/app/api` |
| ✅ Variáveis na Vercel | Vercel Dashboard → Settings → Environment Variables |
| ✅ Middleware ativo | Acessar `/kanban` sem estar logado deve redirecionar para `/login` |
| ✅ Token expira em 7 dias | Supabase → Authentication → Configuration → JWT expiry: `604800` |
| ✅ HTTPS forçado | Headers: `Strict-Transport-Security` presente no `next.config.js` |
| ✅ Cookies httpOnly | DevTools → Application → Cookies → `sb-auth-token` deve ter `HttpOnly` marcado |

---

> 💡 **Lembrete final:** Segurança é um processo contínuo. Faça revisões periódicas das políticas de RLS, monitore os logs do Supabase em **Authentication → Logs** e revogue sessões suspeitas em **Authentication → Users**.

---

*SAC Enterprise — Guia de Segurança v1.0*

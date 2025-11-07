# Migração de Middleware para Server Layout

## Data: 2025-01-27

### Resumo
Migração completa do sistema de autenticação de `middleware.ts` para Server Layouts usando Next.js App Router. Esta é a abordagem recomendada pelo Next.js 13+ e melhores práticas de mercado.

## ✅ Mudanças Implementadas

### 1. Estrutura de Pastas

Criada nova estrutura usando Route Groups do Next.js:

```
app/
  (protected)/          # Rotas que requerem auth + subscription
    layout.tsx          # Verifica autenticação e subscription
    page.tsx            # Dashboard (/)
    accounts/
    transactions/
    budgets/
    categories/
    debts/
    goals/
    investments/
    billing/
    profile/
    reports/
    members/
    dashboard/
  
  (auth-required)/      # Rotas que requerem apenas auth
    layout.tsx          # Verifica apenas autenticação
    select-plan/
    welcome/
  
  auth/                 # Rotas públicas
    login/
    signup/
  
  members/              # Rotas públicas
    accept/
  
  pricing/              # Rotas públicas
```

### 2. Layouts Criados

#### `app/(protected)/layout.tsx`
- Verifica autenticação usando `createServerClient`
- Verifica subscription usando `getCurrentUserSubscription`
- Redireciona para `/auth/login` se não autenticado
- Redireciona para `/select-plan` se não tiver subscription ativa

#### `app/(auth-required)/layout.tsx`
- Verifica apenas autenticação
- Redireciona para `/auth/login` se não autenticado
- Permite acesso mesmo sem subscription (verificação feita na página)

### 3. Rotas Movidas

**Rotas Protegidas (auth + subscription):**
- `/` (dashboard) → `app/(protected)/page.tsx`
- `/accounts` → `app/(protected)/accounts/`
- `/transactions` → `app/(protected)/transactions/`
- `/budgets` → `app/(protected)/budgets/`
- `/categories` → `app/(protected)/categories/`
- `/debts` → `app/(protected)/debts/`
- `/goals` → `app/(protected)/goals/`
- `/investments` → `app/(protected)/investments/`
- `/billing` → `app/(protected)/billing/`
- `/profile` → `app/(protected)/profile/`
- `/reports` → `app/(protected)/reports/`
- `/members` → `app/(protected)/members/`

**Rotas Auth-Required (apenas auth):**
- `/select-plan` → `app/(auth-required)/select-plan/`
- `/welcome` → `app/(auth-required)/welcome/`

**Rotas Públicas (mantidas na raiz):**
- `/auth/login`
- `/auth/signup`
- `/members/accept`
- `/pricing`

### 4. Middleware Removido

- ✅ `middleware.ts` removido completamente
- ✅ Sem avisos de depreciação
- ✅ Sem dependência de Edge Runtime

## 🎯 Benefícios

### 1. Melhor Performance
- Verificação no servidor (sem flash de conteúdo)
- Server Components são mais eficientes
- Sem execução em todas as rotas (incluindo prefetch)

### 2. Maior Segurança
- Verificação próxima aos dados
- Acesso a todas as APIs do Node.js
- Sem limitações do Edge Runtime

### 3. Melhor Manutenibilidade
- Lógica clara e organizada
- Fácil de testar
- Alinhado com Next.js 13+ App Router

### 4. Práticas de Mercado
- Abordagem recomendada pelo Next.js
- Segue melhores práticas de 2024
- Compatível com Supabase

## 📋 Como Funciona

### Fluxo de Autenticação

1. **Usuário acessa rota protegida** (ex: `/accounts`)
2. **Layout protegido verifica:**
   - Autenticação via `createServerClient().auth.getUser()`
   - Subscription via `getCurrentUserSubscription()`
3. **Se não autenticado:**
   - Redireciona para `/auth/login?redirect=/accounts`
4. **Se autenticado mas sem subscription:**
   - Redireciona para `/select-plan`
5. **Se tudo OK:**
   - Renderiza a página

### Fluxo de Rotas Auth-Required

1. **Usuário acessa rota auth-required** (ex: `/select-plan`)
2. **Layout auth-required verifica:**
   - Apenas autenticação
3. **Se não autenticado:**
   - Redireciona para `/auth/login?redirect=/select-plan`
4. **Se autenticado:**
   - Permite acesso (verificação de subscription feita na página)

## 🔍 Verificações

### Autenticação
- Usa `createServerClient()` do `@supabase/ssr`
- Verifica sessão via cookies automaticamente
- Redireciona com parâmetro `redirect` para voltar após login

### Subscription
- Usa `getCurrentUserSubscription()` que:
  - Retorna subscription ativa do usuário
  - Retorna `null` se não houver subscription
  - Verifica status `active`
- Redireciona para `/select-plan` se não houver subscription ativa

## ⚠️ Notas Importantes

1. **Route Groups**: As pastas `(protected)` e `(auth-required)` são Route Groups do Next.js. Elas não aparecem na URL, apenas organizam as rotas.

2. **Redirect Parameter**: Os layouts preservam o pathname original no parâmetro `redirect` para voltar após login.

3. **API Routes**: As rotas `/api/*` não são afetadas pelos layouts e continuam gerenciando sua própria autenticação.

4. **Static Files**: Arquivos estáticos (`/_next/*`, imagens, etc.) não são afetados pelos layouts.

## 🚀 Próximos Passos

1. Testar todas as rotas protegidas
2. Verificar redirecionamentos
3. Testar fluxo de autenticação completo
4. Verificar se subscription check funciona corretamente

## 📚 Referências

- [Next.js Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
- [Next.js Authentication](https://nextjs.org/docs/app/building-your-application/authentication)
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs)


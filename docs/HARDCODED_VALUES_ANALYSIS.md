# Análise de Valores Hardcoded - Spare Finance

**Data:** 20 de Janeiro de 2025  
**Objetivo:** Identificar e documentar valores hardcoded que deveriam ser dinâmicos/configuráveis

---

## 📋 Resumo Executivo

Este documento lista todos os valores hardcoded encontrados no projeto que deveriam ser convertidos em variáveis de ambiente ou configurações dinâmicas para melhorar a manutenibilidade, flexibilidade e permitir diferentes ambientes (dev, staging, production).

---

## 🔴 Valores Hardcoded Críticos

### 1. URLs e Domínios

#### 1.1 URL Base da Aplicação
**Status:** ⚠️ **CRÍTICO** - Usado em múltiplos lugares

**Locais encontrados:**
- `app/api/stripe/checkout/route.ts:18`
  ```typescript
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
  ```

- `lib/utils/email.ts:54, 272, 440`
  ```typescript
  const appUrl = data.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
  ```

- `lib/api/stripe.ts:127, 130, 336, 339, 461, 806`
  ```typescript
  process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/"
  ```

- `app/api/stripe/create-account-and-link/route.ts:60`
  ```typescript
  emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com"}/dashboard`
  ```

**Problema:** Fallback hardcoded pode causar problemas em ambientes diferentes (dev, staging).

**Solução:** Remover fallback hardcoded e exigir variável de ambiente, ou usar fallback baseado em `NODE_ENV`.

---

#### 1.2 URL Localhost (Desenvolvimento)
**Status:** ⚠️ **MÉDIO** - Usado como fallback

**Locais encontrados:**
- `app/api/stripe/cancel-and-checkout/route.ts:89`
  ```typescript
  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings?tab=billing&success=true`
  ```

- `docs/check-updates-optimized.ts:401`
  ```typescript
  const request = new Request('http://localhost:3000/api/dashboard/check-updates');
  ```

**Problema:** Fallback para localhost pode não funcionar em todos os ambientes.

**Solução:** Usar variável de ambiente obrigatória ou detectar automaticamente baseado em `NODE_ENV`.

---

### 2. Endereços de Email

#### 2.1 Email de Remetente (Noreply)
**Status:** ⚠️ **CRÍTICO** - Usado em emails transacionais

**Locais encontrados:**
- `lib/utils/email.ts:60, 63, 273, 274`
  ```typescript
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@sparefinance.com";
  const finalFromEmail = fromEmail === "onboarding@resend.dev" ? "noreply@sparefinance.com" : fromEmail;
  ```

**Problema:** Email hardcoded pode não funcionar em diferentes domínios ou ambientes.

**Solução:** Tornar obrigatório via variável de ambiente `RESEND_FROM_EMAIL`.

---

#### 2.2 Email de Boas-vindas
**Status:** ✅ **RESOLVIDO** - Todos os emails usam `noreply@sparefinance.com`

**Locais encontrados:**
- `lib/utils/email.ts:688-702`
  ```typescript
  // Always use noreply@sparefinance.com as the sender with "Spare Finance" as display name
  const finalFromEmail = "Spare Finance <noreply@sparefinance.com>";
  ```

**Solução implementada:** Todos os emails transacionais (invitation, checkout pending, password reset, welcome) agora usam `noreply@sparefinance.com` com o nome de exibição "Spare Finance".

---

#### 2.3 Emails de Suporte e Legal
**Status:** ⚠️ **MÉDIO** - Usado em páginas públicas

**Locais encontrados:**
- `app/faq/page.tsx:157, 287, 290`
  ```typescript
  "You can contact our support via email at support@sparefinance.com"
  href="mailto:support@sparefinance.com"
  ```

- `app/privacy-policy/page.tsx:307, 366, 367`
  ```typescript
  "contact us at legal@sparefinance.com"
  <p><strong>Email:</strong> legal@sparefinance.com</p>
  <p><strong>Support:</strong> support@sparefinance.com</p>
  ```

- `app/terms-of-service/page.tsx:401, 402`
  ```typescript
  <p><strong>Email:</strong> legal@sparefinance.com</p>
  <p><strong>Support:</strong> support@sparefinance.com</p>
  ```

**Problema:** Emails hardcoded em múltiplos arquivos dificultam manutenção.

**Solução:** Criar variáveis de ambiente e componente/config centralizado:
- `SUPPORT_EMAIL`
- `LEGAL_EMAIL`

---

### 3. URLs de Assets/Imagens

#### 3.1 URL do Supabase Storage
**Status:** ⚠️ **CRÍTICO** - URL do bucket hardcoded

**Locais encontrados:**
- `lib/utils/email.ts:503`
  ```typescript
  <img src="https://dvshwrtzazoetkbzxolv.supabase.co/storage/v1/object/public/images/spare-logo-purple.png" alt="Spare Finance" />
  ```

**Problema:** URL do Supabase Storage hardcoded não funciona em diferentes projetos/ambientes.

**Solução:** Usar variável de ambiente:
- `NEXT_PUBLIC_SUPABASE_STORAGE_URL` ou construir a partir de `NEXT_PUBLIC_SUPABASE_URL`

**Exemplo:**
```typescript
const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL || 
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;
const logoUrl = `${storageUrl}/images/spare-logo-purple.png`;
```

---

### 4. URLs de APIs Externas

#### 4.1 Questrade Token URL
**Status:** ⚠️ **BAIXO** - Geralmente não muda, mas pode ser útil para testes

**Locais encontrados:**
- `lib/api/questrade/index.ts:34`
  ```typescript
  const QUESTRADE_TOKEN_URL = 'https://login.questrade.com/oauth2/token';
  ```

**Problema:** Não crítico, mas pode ser útil ter como variável para ambientes de teste.

**Solução (Opcional):** Criar variável de ambiente `QUESTRADE_TOKEN_URL` com fallback.

---

### 5. Valores de Tempo/Período

#### 5.1 Período de Trial (30 dias)
**Status:** ⚠️ **MÉDIO** - Hardcoded em múltiplos lugares

**Locais encontrados:**
- `app/api/billing/start-trial/route.ts:99-102`
  ```typescript
  // Calculate trial dates (30 days from now)
  const trialStartDate = new Date();
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 30);
  ```

- `lib/utils/email.ts:291, 518`
  ```typescript
  trialInfo = `Your 30-day trial is active and will end on ${formattedDate}.`;
  "I hope you take full advantage of these 30 days to explore the platform"
  ```

- `app/faq/page.tsx:51`
  ```typescript
  "Yes! Both BASIC and PREMIUM plans include a 30-day free trial."
  ```

**Problema:** Período de trial hardcoded dificulta mudanças futuras ou diferentes períodos por plano.

**Solução:** 
1. Criar variável de ambiente `TRIAL_DAYS` (padrão: 30)
2. Ou armazenar no banco de dados na tabela `Plan` como `trialDays`

**Recomendação:** Armazenar no banco de dados para permitir diferentes períodos por plano.

---

#### 5.2 Período de Busca de Transações (30 dias)
**Status:** ⚠️ **BAIXO** - Pode ser configurável

**Locais encontrados:**
- `lib/api/portfolio.ts:310`
  ```typescript
  const transactionsStartDate = subDays(startDate, 30); // Only 30 days before
  ```

- `lib/api/questrade/sync.ts:523`
  ```typescript
  // Questrade has strict limits on date range (30 days max for activities)
  // Default to last 30 days if not provided
  ```

**Problema:** Período de busca hardcoded pode não ser ideal para todos os casos.

**Solução:** Tornar configurável via variável de ambiente ou parâmetro da função.

---

### 6. Valores de Cache TTL

#### 6.1 TTL de Cache (60 segundos)
**Status:** ⚠️ **BAIXO** - Pode ser otimizado por ambiente

**Locais encontrados:**
- `lib/api/financial-health.ts:437`
  ```typescript
  revalidate: 60, // 60 seconds
  ```

- `lib/api/portfolio.ts:494`
  ```typescript
  revalidate: 60, // 60 seconds
  ```

- `lib/api/market-prices.ts:87`
  ```typescript
  next: { revalidate: 60 }, // Cache for 60 seconds
  ```

- `lib/api/portfolio.ts:193`
  ```typescript
  revalidate: 30, // 30 seconds
  ```

**Problema:** TTL hardcoded pode não ser ideal para todos os ambientes (dev vs production).

**Solução:** Criar variável de ambiente `CACHE_TTL_SECONDS` com fallback.

---

### 7. Domínio em Mensagens de Erro

#### 7.1 Domínio em Mensagens de Ajuda
**Status:** ⚠️ **BAIXO** - Usado apenas em logs/mensagens

**Locais encontrados:**
- `lib/utils/email.ts:100, 133`
  ```typescript
  "2. Add and verify the domain: sparefinance.com"
  ```

**Problema:** Domínio hardcoded em mensagens pode não ser correto para todos os ambientes.

**Solução:** Extrair domínio de `NEXT_PUBLIC_APP_URL` ou criar variável `APP_DOMAIN`.

---

## 📝 Recomendações de Implementação

### Fase 1: Variáveis de Ambiente Críticas

Criar/atualizar `.env.example` com:

```env
# Application URLs
NEXT_PUBLIC_APP_URL=https://sparefinance.com
APP_DOMAIN=sparefinance.com

# Email Configuration
# All transactional emails use noreply@sparefinance.com
# RESEND_FROM_EMAIL is no longer used - all emails hardcoded to noreply@sparefinance.com
SUPPORT_EMAIL=support@sparefinance.com
LEGAL_EMAIL=legal@sparefinance.com
FOUNDER_NAME=Naor Tartarotti

# Supabase Storage
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://dvshwrtzazoetkbzxolv.supabase.co/storage/v1/object/public

# Trial Configuration
TRIAL_DAYS=30

# Cache Configuration
CACHE_TTL_SECONDS=60
CACHE_TTL_SHORT_SECONDS=30

# Questrade (Opcional)
QUESTRADE_TOKEN_URL=https://login.questrade.com/oauth2/token
```

### Fase 2: Arquivo de Configuração Centralizado

Criar `lib/config.ts`:

```typescript
export const config = {
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || (() => {
      if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3000';
      }
      throw new Error('NEXT_PUBLIC_APP_URL is required in production');
    })(),
    domain: process.env.APP_DOMAIN || new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://sparefinance.com').hostname,
  },
  email: {
    // All transactional emails use noreply@sparefinance.com (hardcoded)
    from: 'noreply@sparefinance.com',
    support: process.env.SUPPORT_EMAIL || 'support@sparefinance.com',
    legal: process.env.LEGAL_EMAIL || 'legal@sparefinance.com',
    founderName: process.env.FOUNDER_NAME || 'Naor Tartarotti',
  },
  storage: {
    baseUrl: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL || 
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`,
    logoUrl: (filename: string) => 
      `${config.storage.baseUrl}/images/${filename}`,
  },
  trial: {
    days: parseInt(process.env.TRIAL_DAYS || '30', 10),
  },
  cache: {
    default: parseInt(process.env.CACHE_TTL_SECONDS || '60', 10),
    short: parseInt(process.env.CACHE_TTL_SHORT_SECONDS || '30', 10),
  },
  questrade: {
    tokenUrl: process.env.QUESTRADE_TOKEN_URL || 'https://login.questrade.com/oauth2/token',
  },
} as const;
```

### Fase 3: Refatoração dos Arquivos

#### Prioridade Alta:
1. ✅ `lib/utils/email.ts` - Substituir todos os valores hardcoded
2. ✅ `app/api/stripe/checkout/route.ts` - Remover fallback hardcoded
3. ✅ `lib/api/stripe.ts` - Usar config centralizado
4. ✅ `app/api/billing/start-trial/route.ts` - Usar `config.trial.days`

#### Prioridade Média:
5. ✅ `app/faq/page.tsx` - Usar `config.email.support`
6. ✅ `app/privacy-policy/page.tsx` - Usar `config.email.legal` e `config.email.support`
7. ✅ `app/terms-of-service/page.tsx` - Usar `config.email.legal` e `config.email.support`
8. ✅ `lib/api/portfolio.ts` - Usar `config.cache` para TTL

#### Prioridade Baixa:
9. ✅ `lib/api/questrade/index.ts` - Usar `config.questrade.tokenUrl`
10. ✅ `lib/api/financial-health.ts` - Usar `config.cache`
11. ✅ `lib/api/market-prices.ts` - Usar `config.cache`

---

## ✅ Checklist de Implementação

- [ ] Criar arquivo `lib/config.ts` com configurações centralizadas
- [ ] Atualizar `.env.example` com todas as novas variáveis
- [ ] Refatorar `lib/utils/email.ts` para usar `config`
- [ ] Refatorar `app/api/stripe/checkout/route.ts`
- [ ] Refatorar `lib/api/stripe.ts`
- [ ] Refatorar `app/api/billing/start-trial/route.ts`
- [ ] Refatorar páginas públicas (FAQ, Privacy, Terms) para usar `config.email`
- [ ] Refatorar APIs de cache para usar `config.cache`
- [ ] Atualizar documentação com novas variáveis de ambiente
- [ ] Testar em ambiente de desenvolvimento
- [ ] Testar em ambiente de staging/produção
- [ ] Atualizar variáveis de ambiente em produção

---

## 🔍 Valores que NÃO Precisam ser Alterados

Estes valores são apropriados como hardcoded:

1. **URLs de APIs públicas estáveis** (ex: Questrade, Stripe, Plaid) - Geralmente não mudam
2. **Valores de constantes matemáticas** (ex: 100 para porcentagem)
3. **Valores de UI/UX padrão** (ex: tamanhos de ícones, cores padrão)
4. **Valores de validação** (ex: tamanho mínimo de senha)

---

## 📚 Referências

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [12-Factor App - Config](https://12factor.net/config)
- [Best Practices for Environment Variables](https://www.twilio.com/blog/environment-variables-python)

---

**Última atualização:** 20 de Janeiro de 2025


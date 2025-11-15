# 🏗️ Infrastructure Setup Guide

Este guia documenta a configuração completa da infraestrutura recomendada para o Spare Finance em produção.

## 📋 Índice

1. [Cache (Redis/Upstash)](#cache-redisupstash)
2. [Error Tracking (Sentry)](#error-tracking-sentry)
3. [Monitoring](#monitoring)
4. [CDN Configuration](#cdn-configuration)
5. [Database Optimization](#database-optimization)
6. [Environment Variables](#environment-variables)

---

## 🗄️ Cache (Redis/Upstash)

### Setup Upstash Redis

1. **Criar conta no Upstash**
   - Acesse: https://upstash.com
   - Crie uma conta (free tier disponível)
   - Crie um novo database Redis

2. **Configurar variáveis de ambiente**
   ```bash
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token-here
   ```

3. **Instalar dependência**
   ```bash
   npm install @upstash/redis
   ```

### Uso do Cache

O sistema usa Redis automaticamente quando configurado, com fallback para cache em memória.

**Exemplo de uso:**
```typescript
import { withRedisCache } from '@/lib/services/cache-manager';

// Cache de dados do dashboard
const dashboardData = await withRedisCache(
  async () => {
    // Fetch data from database
    return await getDashboardData(userId);
  },
  {
    key: `dashboard:${userId}:${month}`,
    ttlSeconds: 300, // 5 minutos
  }
);
```

### Cache de Dashboard

O cache é automaticamente invalidado quando:
- Transações são criadas/atualizadas/deletadas
- Contas são modificadas
- Orçamentos são alterados
- Metas são atualizadas

---

## 🐛 Error Tracking (Sentry)

### Setup Sentry

1. **Criar conta no Sentry**
   - Acesse: https://sentry.io
   - Crie um novo projeto (Next.js)
   - Copie o DSN

2. **Instalar dependências**
   ```bash
   npm install @sentry/nextjs
   npx @sentry/wizard@latest -i nextjs
   ```

3. **Configurar variáveis de ambiente**
   ```bash
   NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   SENTRY_ORG=your-org
   SENTRY_PROJECT=your-project
   SENTRY_AUTH_TOKEN=your-auth-token
   ```

4. **Configurar no Vercel**
   - Adicione as variáveis de ambiente no dashboard do Vercel
   - Configure source maps (já incluído no `next.config.ts`)

### Features Implementadas

- ✅ Error tracking (client + server)
- ✅ Performance monitoring
- ✅ Session replay
- ✅ Source maps
- ✅ Filtering de dados sensíveis
- ✅ Ignore de erros comuns

### Verificação

Após o setup, erros serão automaticamente enviados ao Sentry. Para testar:

```typescript
// Em qualquer API route
throw new Error('Test error');
```

---

## 📊 Monitoring

### Health Check Endpoint

Endpoint disponível em: `/api/health`

**Resposta:**
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "checks": {
    "database": true,
    "redis": true,
    "externalApis": {
      "plaid": true,
      "stripe": true
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Métricas Rastreadas

O sistema rastreia automaticamente:
- ⏱️ Performance de API requests
- 🗄️ Performance de queries de banco
- 💾 Operações de cache (hit/miss)
- 📈 Métricas de negócio

**Exemplo de uso:**
```typescript
import { trackApiRequest, startTimer } from '@/lib/services/monitoring';

const timer = startTimer('api.dashboard', { userId });
// ... código da API
timer.end(); // Automaticamente rastreia a métrica
```

### Integração com APM (Opcional)

Para Datadog/New Relic:

1. **Datadog**
   ```bash
   npm install dd-trace
   ```
   ```typescript
   // next.config.ts
   import './dd-trace';
   ```

2. **New Relic**
   ```bash
   npm install newrelic
   ```
   ```typescript
   // next.config.ts
   require('newrelic');
   ```

---

## 🌐 CDN Configuration

### Cloudflare CDN (Recomendado)

1. **Adicionar domínio no Cloudflare**
   - Crie uma conta: https://cloudflare.com
   - Adicione seu domínio
   - Atualize nameservers

2. **Configurar no Vercel**
   - No dashboard do Vercel, configure o domínio customizado
   - Cloudflare irá automaticamente fazer proxy do tráfego

3. **Otimizações recomendadas**
   - ✅ Enable Auto Minify (JS, CSS, HTML)
   - ✅ Enable Brotli compression
   - ✅ Cache Level: Standard
   - ✅ Browser Cache TTL: 4 hours
   - ✅ Always Use HTTPS

### Headers de Cache

O `next.config.ts` já inclui headers otimizados:
- Cache-Control para assets estáticos
- ETag support
- Compression habilitado

---

## 🗄️ Database Optimization

### Connection Pooling

O Supabase já fornece connection pooling automaticamente. Para otimizar:

1. **Usar connection pooler URL**
   ```
   Supabase Dashboard > Settings > Database > Connection Pooling
   ```

2. **Configurar no código**
   ```typescript
   // lib/supabase.ts
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
   // Use pooler URL: your-project.supabase.co (port 6543)
   ```

### Query Optimization

1. **Habilitar pg_stat_statements** (já configurado no Supabase)
   ```sql
   -- Ver queries lentas
   SELECT query, calls, total_time, mean_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   ```

2. **Índices já criados**
   - Verifique `supabase/migrations/20241116100000_add_performance_indexes.sql`
   - Todos os índices críticos já estão implementados

### Monitoring de Database

1. **Supabase Dashboard**
   - Acesse: Dashboard > Database > Performance
   - Monitore queries lentas
   - Configure alertas

2. **Queries de monitoramento**
   ```sql
   -- Ver conexões ativas
   SELECT count(*) FROM pg_stat_activity;
   
   -- Ver tamanho das tabelas
   SELECT 
     schemaname,
     tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

---

## 🔐 Environment Variables

### Variáveis Obrigatórias

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis/Upstash
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Sentry
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token

# Stripe
STRIPE_SECRET_KEY=your-stripe-secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=your-webhook-secret

# Plaid
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret
NEXT_PUBLIC_PLAID_ENV=sandbox

# Questrade
QUESTRADE_CLIENT_ID=your-questrade-client-id
QUESTRADE_CLIENT_SECRET=your-questrade-secret

# OpenAI
OPENAI_API_KEY=your-openai-key

# Resend
RESEND_API_KEY=your-resend-key
```

### Variáveis Opcionais

```bash
# Monitoring
LOG_LEVEL=info
NODE_ENV=production

# CDN
CDN_URL=your-cdn-url

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_SESSION_REPLAY=true
```

---

## 🚀 Deployment Checklist

Antes de fazer deploy em produção:

- [ ] ✅ Redis/Upstash configurado e testado
- [ ] ✅ Sentry configurado e testado
- [ ] ✅ Todas as variáveis de ambiente configuradas
- [ ] ✅ Health check endpoint funcionando
- [ ] ✅ CDN configurado (se aplicável)
- [ ] ✅ Database connection pooling configurado
- [ ] ✅ Source maps habilitados no Sentry
- [ ] ✅ Alertas configurados no Sentry
- [ ] ✅ Monitoring de performance ativo
- [ ] ✅ Cache testado e funcionando
- [ ] ✅ Rate limiting testado

---

## 📈 Performance Targets

### Metas de Performance

- **API Response Time**: < 200ms (p95)
- **Database Query Time**: < 100ms (p95)
- **Cache Hit Rate**: > 80%
- **Error Rate**: < 0.1%
- **Uptime**: > 99.9%

### Monitoring

Configure alertas para:
- ⚠️ Error rate > 1%
- ⚠️ Response time > 500ms (p95)
- ⚠️ Database connections > 80%
- ⚠️ Cache hit rate < 70%
- ⚠️ Health check failures

---

## 🔧 Troubleshooting

### Redis não está funcionando

1. Verifique variáveis de ambiente
2. Teste conexão:
   ```typescript
   import { getRedisClient } from '@/lib/services/redis';
   const client = getRedisClient();
   await client.ping();
   ```
3. O sistema usa fallback automático para cache em memória

### Sentry não está capturando erros

1. Verifique DSN configurado
2. Verifique source maps no build
3. Teste manualmente:
   ```typescript
   import * as Sentry from '@sentry/nextjs';
   Sentry.captureException(new Error('Test'));
   ```

### Performance degradada

1. Verifique índices do banco
2. Analise queries lentas no Supabase Dashboard
3. Verifique cache hit rate
4. Monitore connection pool usage

---

## 📚 Recursos Adicionais

- [Upstash Redis Docs](https://docs.upstash.com/redis)
- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Supabase Performance](https://supabase.com/docs/guides/database/performance)

---

**Última atualização**: 2024-11-16


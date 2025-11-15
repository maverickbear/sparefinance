# 🚀 Infrastructure Quick Start

Guia rápido para configurar a infraestrutura recomendada.

## ⚡ Setup Rápido (5 minutos)

### 1. Redis/Upstash (2 min)

```bash
# 1. Criar conta no Upstash: https://upstash.com
# 2. Criar database Redis
# 3. Copiar URL e Token
# 4. Adicionar ao .env:

UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

### 2. Sentry (2 min)

```bash
# 1. Instalar dependência (já instalado via package.json)
# Se houver conflitos de peer dependencies, use:
npm install @sentry/nextjs --legacy-peer-deps

# 2. Executar wizard
npx @sentry/wizard@latest -i nextjs

# 3. Adicionar ao .env (valores fornecidos pelo wizard):
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_DSN=https://...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-token
```

### 3. Instalar Dependências (1 min)

```bash
npm install @upstash/redis @sentry/nextjs
```

## ✅ Verificação

### Testar Redis

```typescript
// Em qualquer API route
import { getRedisClient } from '@/lib/services/redis';
const client = getRedisClient();
if (client) {
  await client.ping(); // Deve retornar 'PONG'
}
```

### Testar Sentry

```typescript
// Em qualquer API route
import * as Sentry from '@sentry/nextjs';
Sentry.captureException(new Error('Test error'));
// Verificar no dashboard do Sentry
```

### Testar Health Check

```bash
curl https://your-domain.com/api/health
# Deve retornar status: "healthy"
```

## 📝 Próximos Passos

1. Configurar alertas no Sentry
2. Configurar CDN (Cloudflare) - opcional
3. Revisar documentação completa: `docs/INFRASTRUCTURE_SETUP.md`

## 🆘 Problemas Comuns

**Redis não funciona?**
- Verifique variáveis de ambiente
- Sistema usa fallback automático (não quebra)

**Sentry não captura erros?**
- Verifique DSN configurado
- Verifique source maps no build

**Health check falha?**
- Verifique conexão com Supabase
- Verifique variáveis de ambiente

---

Para mais detalhes, veja: `docs/INFRASTRUCTURE_SETUP.md`


# Problema: Views Materializadas Não Atualizam Automaticamente

## Descrição do Problema

Quando um usuário deleta ou modifica transações de investimento (`InvestmentTransaction`), os dados **continuam aparecendo** nas views materializadas (`holdings_view`, `portfolio_summary_view`, etc.) até que sejam atualizadas manualmente.

## Por Que Isso Acontece?

### 1. Views Materializadas São "Snapshots"

Views materializadas no PostgreSQL são **cópias físicas** dos dados calculados em um momento específico. Elas não são atualizadas automaticamente quando os dados nas tabelas base mudam.

### 2. O Trigger Apenas Notifica

O sistema possui um trigger que dispara quando há mudanças:

```sql
CREATE TRIGGER trigger_notify_holdings_refresh
AFTER INSERT OR UPDATE OR DELETE ON "InvestmentTransaction"
FOR EACH ROW
EXECUTE FUNCTION notify_refresh_holdings();
```

Mas a função `notify_refresh_holdings()` **apenas envia uma notificação** (`pg_notify`), não atualiza as views:

```sql
CREATE OR REPLACE FUNCTION notify_refresh_holdings()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('refresh_holdings', 'refresh_needed');
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

### 3. A Atualização É Manual

A função `refresh_portfolio_views()` existe e atualiza as views, mas **não é chamada automaticamente**:

```sql
CREATE OR REPLACE FUNCTION refresh_portfolio_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY holdings_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY portfolio_summary_view;
  REFRESH MATERIALIZED VIEW asset_allocation_view;
  REFRESH MATERIALIZED VIEW sector_allocation_view;
END;
$$ LANGUAGE plpgsql;
```

## Impacto no Sistema

1. **Dados "fantasma"**: Transações deletadas continuam aparecendo nos cálculos de portfolio
2. **Inconsistência**: Os dados mostrados nas views não refletem o estado atual das transações
3. **Experiência do usuário**: Usuário deleta uma transação mas ela ainda aparece no portfolio

## Soluções Possíveis

### Solução 1: Chamar `refresh_portfolio_views()` Após Operações (RECOMENDADA)

**Implementação:** Chamar a função após DELETE/UPDATE de InvestmentTransaction na API.

**Vantagens:**
- ✅ Atualização imediata
- ✅ Dados sempre consistentes
- ✅ Simples de implementar

**Desvantagens:**
- ⚠️ Pode ser lento se houver muitas transações (mas CONCURRENTLY ajuda)
- ⚠️ Bloqueia a resposta da API durante o refresh

**Código exemplo:**

```typescript
// Em app/api/investments/transactions/[id]/route.ts
export async function DELETE(...) {
  // ... deletar transação ...
  
  // Atualizar views materializadas
  const supabase = createServerClient();
  await supabase.rpc('refresh_portfolio_views');
  
  // Invalidate cache
  await invalidatePortfolioCache();
  
  return NextResponse.json({ success: true });
}
```

### Solução 2: Background Worker com LISTEN/NOTIFY

**Implementação:** Criar um worker que escuta as notificações do trigger e atualiza as views.

**Vantagens:**
- ✅ Não bloqueia a API
- ✅ Pode fazer batch de atualizações
- ✅ Mais eficiente para múltiplas mudanças

**Desvantagens:**
- ⚠️ Complexidade adicional
- ⚠️ Requer infraestrutura de background worker
- ⚠️ Pode haver delay entre mudança e atualização

**Código exemplo (Node.js):**

```typescript
import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

await client.connect();
await client.query('LISTEN refresh_holdings');

client.on('notification', async (msg) => {
  if (msg.channel === 'refresh_holdings') {
    await client.query('SELECT refresh_portfolio_views()');
  }
});
```

### Solução 3: Cron Job Periódico

**Implementação:** Executar `refresh_portfolio_views()` periodicamente (ex: a cada 5 minutos).

**Vantagens:**
- ✅ Simples de configurar
- ✅ Não impacta performance de operações individuais

**Desvantagens:**
- ⚠️ Dados podem ficar desatualizados por alguns minutos
- ⚠️ Não resolve o problema de forma imediata

**Configuração (Supabase Edge Functions ou Vercel Cron):**

```typescript
// cron/refresh-portfolio.ts
export default async function handler() {
  const supabase = createServerClient();
  await supabase.rpc('refresh_portfolio_views');
}
```

### Solução 4: Atualizar Views Diretamente no Trigger (NÃO RECOMENDADA)

**Implementação:** Modificar o trigger para chamar `refresh_portfolio_views()` diretamente.

**Vantagens:**
- ✅ Atualização automática imediata

**Desvantagens:**
- ❌ **Muito lento** - bloqueia cada INSERT/UPDATE/DELETE
- ❌ Pode causar timeouts em operações
- ❌ Impacta performance geral do sistema
- ❌ Não pode usar CONCURRENTLY dentro de trigger

**Por que não fazer:**

```sql
-- ❌ NÃO FAÇA ISSO
CREATE OR REPLACE FUNCTION notify_refresh_holdings()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW holdings_view; -- MUITO LENTO!
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

## Recomendação

**Implementar Solução 1 (chamada direta após operações)** como solução imediata, e considerar Solução 2 (background worker) para otimização futura se necessário.

### Implementação Recomendada

1. **Imediato:** Adicionar chamada a `refresh_portfolio_views()` após DELETE/UPDATE em InvestmentTransaction
2. **Otimização futura:** Implementar background worker se houver problemas de performance

### Código de Implementação

```typescript
// lib/api/investments.ts
export async function deleteInvestmentTransaction(id: string) {
  const supabase = createServerClient();
  
  // Deletar transação
  const { error } = await supabase
    .from('InvestmentTransaction')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  
  // Atualizar views materializadas
  const { error: refreshError } = await supabase.rpc('refresh_portfolio_views');
  if (refreshError) {
    console.error('Error refreshing portfolio views:', refreshError);
    // Não falhar a operação se refresh falhar
  }
  
  return { success: true };
}
```

## Verificação

Para verificar se as views estão atualizadas:

```sql
-- Ver última atualização
SELECT last_updated FROM holdings_view LIMIT 1;

-- Ver dados atuais
SELECT * FROM holdings_view WHERE user_id = 'seu-user-id';

-- Forçar atualização manual
SELECT refresh_portfolio_views();
```

---

**Data:** Janeiro 2025
**Status:** Problema identificado, solução recomendada documentada


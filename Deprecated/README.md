# Pasta Deprecated

Esta pasta contém arquivos que foram deprecados ou não são mais utilizados no código.

## ⚠️ Atenção

**NÃO DELETE ESTES ARQUIVOS IMEDIATAMENTE!**

Eles podem ainda estar sendo referenciados em algum lugar do código. Esta pasta serve como:
- Documentação de arquivos que devem ser removidos no futuro
- Local temporário durante a migração
- Referência histórica

## 📁 Arquivos Atuais

### API Antiga (Migração Subscription/Plans/Limits)
- `lib-api-plans.ts` - API antiga de plans, substituída por `lib/api/subscription.ts`
  - **Status:** ✅ Migração completa - não usar mais
  - **Substituir por:** `lib/api/subscription.ts`
  - **Última verificação:** 2025-02-01 - Não está sendo importado em nenhum lugar

## ✅ Arquivos Removidos (Migração Completa)

Estes arquivos foram removidos durante a migração para a API unificada:

- ❌ `lib/api/limits.ts` - Removido (wrapper deprecated)
- ❌ `contexts/plan-limits-context.tsx` - Removido (wrapper deprecated)
- ❌ `hooks/use-plan-limits.ts` - Removido (wrapper deprecated)
- ❌ `lib/api/plans-client.ts` - Removido (não estava sendo usado)

**Todos foram substituídos por:**
- ✅ `lib/api/subscription.ts` - API unificada
- ✅ `contexts/subscription-context.tsx` - Contexto unificado
- ✅ `hooks/use-subscription.ts` - Hook unificado

## 🔍 Verificação de Uso

Para verificar se um arquivo deprecated ainda é usado:

```bash
# Verificar referências no código
grep -r "nome-do-arquivo" . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=Deprecated

# Verificar imports
grep -r "from.*nome-do-arquivo" . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=Deprecated
```

## 📚 Documentação

Para mais informações sobre a migração:
- `docs/SUBSCRIPTION_UNIFICATION.md` - Arquitetura unificada
- `docs/MIGRATION_COMPLETE.md` - Status da migração (100% completo)
- `docs/SCHEMA_CLEANUP_ANALYSIS.md` - Limpeza do schema

---

**Última atualização:** 2025-02-01

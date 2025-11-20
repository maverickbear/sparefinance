# 🎯 Tarefas Restantes para 100%

## Status Atual: 98% ✅

A migração está quase completa! Restam apenas algumas tarefas opcionais de limpeza.

## 📋 O que falta para 100%

### 1. Remover Wrappers Deprecated (Opcional - Baixo Risco)

Estes arquivos ainda existem mas **delegam para a API unificada**. Eles podem ser removidos se confirmarmos que nada mais os usa:

#### `lib/api/limits.ts`
- **Status:** ✅ Wrapper que delega para `@/lib/api/subscription`
- **Ação:** Verificar se ainda é usado, se não, pode ser removido
- **Risco:** Baixo - já é um wrapper

#### `contexts/plan-limits-context.tsx`
- **Status:** ✅ Wrapper que delega para `SubscriptionContext`
- **Ação:** Verificar se ainda é usado, se não, pode ser removido
- **Risco:** Baixo - já é um wrapper

#### `hooks/use-plan-limits.ts`
- **Status:** ✅ Wrapper que delega para `useSubscription()`
- **Ação:** Verificar se ainda é usado, se não, pode ser removido
- **Risco:** Baixo - já é um wrapper

**Como verificar:**
```bash
# Verificar se ainda há uso direto
grep -r "from.*@/lib/api/limits" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=Deprecated .
grep -r "from.*@/hooks/use-plan-limits" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=Deprecated .
grep -r "from.*@/contexts/plan-limits-context" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=Deprecated .
```

### 2. Mover `lib/api/plans.ts` para Deprecated (Opcional)

- **Status:** ⚠️ Marcado como deprecated, mas ainda existe
- **Ação:** Mover para pasta `Deprecated/` quando não for mais necessário
- **Risco:** Médio - pode ser usado internamente pela API unificada
- **Nota:** A API unificada (`lib/api/subscription.ts`) tem sua própria implementação, então `lib/api/plans.ts` pode não ser mais necessário

**Como verificar:**
```bash
# Verificar se lib/api/subscription.ts usa lib/api/plans.ts
grep -r "from.*lib/api/plans" lib/api/subscription.ts
```

### 3. Remover `lib/api/plans-client.ts` (Opcional)

- **Status:** ❓ Não está sendo usado (verificado)
- **Ação:** Pode ser removido ou movido para Deprecated
- **Risco:** Baixo - não está sendo usado

**Como verificar:**
```bash
# Verificar se ainda é usado
grep -r "from.*plans-client" --exclude-dir=node_modules --exclude-dir=.next .
```

### 4. Atualizar Documentação (Opcional)

- **Status:** ⚠️ Alguns docs ainda mencionam API antiga
- **Ação:** Atualizar referências em:
  - `docs/NOVA_IMPLEMENTACAO_SUBSCRIPTION.md`
  - `docs/FLUXO_CADASTRO_TRANSACOES.md`
  - `docs/subscription_refactor_prompt.md`
- **Risco:** Nenhum - apenas documentação

## ✅ Checklist para 100%

- [ ] Verificar se `lib/api/limits.ts` ainda é usado
- [ ] Verificar se `contexts/plan-limits-context.tsx` ainda é usado
- [ ] Verificar se `hooks/use-plan-limits.ts` ainda é usado
- [ ] Verificar se `lib/api/plans.ts` é usado pela API unificada
- [ ] Remover ou mover wrappers não usados para Deprecated
- [ ] Mover `lib/api/plans.ts` para Deprecated (se não for mais necessário)
- [ ] Remover `lib/api/plans-client.ts` (se não for usado)
- [ ] Atualizar documentação antiga

## 🚀 Plano de Ação Recomendado

### Fase 1: Verificação (5 minutos)
1. Executar comandos de verificação acima
2. Confirmar quais arquivos ainda são usados

### Fase 2: Remoção Segura (10 minutos)
1. Remover arquivos não usados
2. Mover arquivos deprecated para pasta Deprecated
3. Atualizar imports se necessário

### Fase 3: Testes (15 minutos)
1. Executar testes
2. Verificar se aplicação funciona
3. Verificar se não há erros de import

### Fase 4: Documentação (5 minutos)
1. Atualizar docs antigas
2. Marcar como 100% completo

## ⚠️ Importante

**Não remova os wrappers deprecated sem verificar primeiro!** Eles podem estar sendo usados em algum lugar que não foi detectado. Sempre execute os comandos de verificação antes de remover.

## 📊 Impacto

- **Remover wrappers:** Baixo risco (já são wrappers)
- **Mover lib/api/plans.ts:** Médio risco (verificar uso interno)
- **Remover plans-client.ts:** Baixo risco (não está sendo usado)
- **Atualizar docs:** Nenhum risco

---

**Total estimado:** ~35 minutos para chegar a 100% 🎯


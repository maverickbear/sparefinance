# 🎯 O que falta para 100%

## Status Atual: 98% ✅

A migração está **quase completa**! Restam apenas tarefas de limpeza opcionais.

## ✅ Verificação Completa

Verificamos que **NENHUM arquivo está usando os wrappers deprecated**:
- ❌ Nenhum arquivo usa `@/lib/api/limits`
- ❌ Nenhum arquivo usa `@/hooks/use-plan-limits`
- ❌ Nenhum arquivo usa `@/contexts/plan-limits-context`
- ❌ Nenhum arquivo usa `plans-client`

**Isso significa que podemos remover esses arquivos com segurança!** 🎉

## 📋 Tarefas para 100%

### 1. Remover Wrappers Deprecated (Seguro ✅)

Estes arquivos não estão sendo usados e podem ser removidos:

#### `lib/api/limits.ts`
- **Status:** ✅ Não está sendo usado
- **Ação:** **PODE SER REMOVIDO**
- **Risco:** Nenhum - verificado que não é usado

#### `contexts/plan-limits-context.tsx`
- **Status:** ✅ Não está sendo usado
- **Ação:** **PODE SER REMOVIDO**
- **Risco:** Nenhum - verificado que não é usado

#### `hooks/use-plan-limits.ts`
- **Status:** ✅ Não está sendo usado
- **Ação:** **PODE SER REMOVIDO**
- **Risco:** Nenhum - verificado que não é usado

### 2. Remover `lib/api/plans-client.ts` (Seguro ✅)

- **Status:** ✅ Não está sendo usado
- **Ação:** **PODE SER REMOVIDO**
- **Risco:** Nenhum - verificado que não é usado

### 3. Mover `lib/api/plans.ts` para Deprecated (Opcional)

- **Status:** ⚠️ Marcado como deprecated, mas ainda existe
- **Ação:** Mover para `Deprecated/` ou verificar se é usado internamente
- **Risco:** Baixo - API unificada tem sua própria implementação
- **Nota:** A API unificada (`lib/api/subscription.ts`) não importa `lib/api/plans.ts`, então pode ser movido

### 4. Atualizar Documentação (Opcional)

- **Status:** ⚠️ Alguns docs ainda mencionam API antiga
- **Ação:** Atualizar referências em docs antigas
- **Risco:** Nenhum - apenas documentação

## 🚀 Plano de Ação para 100%

### Passo 1: Remover Wrappers (5 minutos)
```bash
# Remover arquivos não usados
rm lib/api/limits.ts
rm contexts/plan-limits-context.tsx
rm hooks/use-plan-limits.ts
rm lib/api/plans-client.ts
```

### Passo 2: Mover lib/api/plans.ts (2 minutos)
```bash
# Mover para Deprecated
mv lib/api/plans.ts Deprecated/lib-api-plans.ts
```

### Passo 3: Verificar Imports (3 minutos)
```bash
# Verificar se há imports quebrados
npm run build
# ou
npx tsc --noEmit
```

### Passo 4: Atualizar Docs (5 minutos)
- Atualizar referências em docs antigas
- Marcar como 100% completo

## ✅ Checklist Final

- [ ] Remover `lib/api/limits.ts`
- [ ] Remover `contexts/plan-limits-context.tsx`
- [ ] Remover `hooks/use-plan-limits.ts`
- [ ] Remover `lib/api/plans-client.ts`
- [ ] Mover `lib/api/plans.ts` para `Deprecated/`
- [ ] Verificar se build funciona
- [ ] Atualizar documentação
- [ ] Marcar como 100% completo

## 📊 Impacto

- **Remover wrappers:** ✅ Seguro - não estão sendo usados
- **Remover plans-client.ts:** ✅ Seguro - não está sendo usado
- **Mover plans.ts:** ✅ Seguro - API unificada não depende dele
- **Total estimado:** ~15 minutos para 100%

## 🎉 Resultado Esperado

Após completar essas tarefas:
- ✅ 100% da migração completa
- ✅ Código mais limpo (sem wrappers desnecessários)
- ✅ Menos confusão (apenas API unificada)
- ✅ Manutenção mais fácil

---

**Pronto para chegar a 100%!** 🚀


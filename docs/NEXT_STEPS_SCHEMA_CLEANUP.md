# 🎯 Próximos Passos - Limpeza do Schema

**Data:** 2025-02-01  
**Status:** Migrations executadas com sucesso ✅

---

## ✅ O QUE FOI FEITO

### Migrations Executadas:
1. ✅ **20250201000018** - Atualização de funções SQL para usar `HouseholdMemberNew` e `householdId`
2. ✅ **20250201000019** - Remoção da tabela legada `HouseholdMember`

### Resultados:
- ✅ Tabela `HouseholdMember` removida
- ✅ Funções SQL atualizadas (`update_household_members_subscription_cache`, `trigger_update_subscription_cache`)
- ✅ Função obsoleta removida (`trigger_update_member_subscription_cache`)
- ✅ Triggers obsoletos removidos
- ✅ Políticas RLS obsoletas removidas
- ✅ Índices e constraints removidos

---

## 🧪 VALIDAÇÃO FUNCIONAL (Recomendado)

Antes de prosseguir para produção, execute os seguintes testes:

### 1. Testes de Household
- [ ] Criar novo household
- [ ] Adicionar membro ao household
- [ ] Remover membro do household
- [ ] Verificar que membros podem ver informações uns dos outros (nome, avatar, etc.)

### 2. Testes de Subscription
- [ ] Criar subscription para um household
- [ ] Atualizar subscription (mudar plano)
- [ ] Cancelar subscription
- [ ] Verificar que cache de subscription é atualizado corretamente
- [ ] Verificar que todos os membros do household recebem o cache atualizado

### 3. Testes de Integração
- [ ] Verificar que não há erros no console
- [ ] Verificar que não há queries falhando
- [ ] Testar fluxo completo de convite de membro
- [ ] Testar aceitação de convite

---

## 📝 ATUALIZAÇÃO DO SCHEMA REFERENCE

O arquivo `supabase/schema_reference.sql` ainda mostra a tabela `HouseholdMember` porque é um snapshot do schema anterior. Para atualizar:

```bash
# Gerar novo snapshot do schema
supabase db dump --schema public > supabase/schema_reference.sql
```

**Nota:** Isso deve ser feito após validar que tudo está funcionando corretamente.

---

## 🚀 PREPARAÇÃO PARA PRODUÇÃO

### Checklist Antes de Executar em Produção:

1. **Backup:**
   - [ ] Fazer backup completo do banco de produção
   - [ ] Verificar que o backup foi criado com sucesso

2. **Validação em Staging (se disponível):**
   - [ ] Executar migrations em staging
   - [ ] Validar todos os testes funcionais em staging
   - [ ] Aguardar pelo menos 24h de monitoramento

3. **Janela de Manutenção:**
   - [ ] Agendar janela de manutenção
   - [ ] Notificar usuários se necessário
   - [ ] Preparar plano de rollback

4. **Execução:**
   - [ ] Executar migration `20250201000018`
   - [ ] Verificar logs de erro
   - [ ] Executar migration `20250201000019`
   - [ ] Verificar logs de erro
   - [ ] Executar testes básicos em produção

5. **Monitoramento Pós-Deploy:**
   - [ ] Monitorar logs por pelo menos 1h
   - [ ] Verificar métricas de erro
   - [ ] Verificar que subscriptions estão funcionando
   - [ ] Verificar que households estão funcionando

---

## 🔍 VERIFICAÇÕES ADICIONAIS

### Verificar Dados Migrados (Opcional)

Se quiser verificar que todos os dados foram migrados corretamente antes de remover a tabela, você pode executar:

```sql
-- Verificar contagem de registros
SELECT 
  (SELECT COUNT(*) FROM "HouseholdMember") as old_count,
  (SELECT COUNT(*) FROM "HouseholdMemberNew") as new_count;

-- Verificar se há registros órfãos
SELECT COUNT(*) 
FROM "HouseholdMember" hm
WHERE NOT EXISTS (
  SELECT 1 
  FROM "HouseholdMemberNew" hmn 
  WHERE hmn."userId" = hm."memberId" 
    OR hmn."householdId" IN (
      SELECT "householdId" 
      FROM "HouseholdMemberNew" 
      WHERE "userId" = hm."ownerId"
    )
);
```

**Nota:** Como as migrations já foram executadas, essas queries podem falhar se a tabela já foi removida. Isso é esperado.

---

## 📊 IMPACTO ESPERADO

### Positivo:
- ✅ Schema mais limpo e organizado
- ✅ Menos confusão entre tabelas antigas e novas
- ✅ Funções SQL alinhadas com a nova arquitetura
- ✅ Melhor performance (menos índices e triggers desnecessários)

### Riscos:
- ⚠️ Se houver código legado ainda usando `HouseholdMember`, vai falhar
- ⚠️ Se houver dados não migrados, podem ser perdidos (mas a migration verifica isso)

---

## 🆘 PLANO DE ROLLBACK

Se algo der errado, você pode:

1. **Reverter as migrations:**
   - As migrations não são reversíveis automaticamente
   - Seria necessário recriar a tabela `HouseholdMember` manualmente
   - **Recomendação:** Fazer backup antes de executar em produção

2. **Restaurar do backup:**
   - Se houver problemas críticos, restaurar o backup completo

---

## 📚 DOCUMENTAÇÃO RELACIONADA

- `docs/SCHEMA_CLEANUP_ANALYSIS.md` - Análise detalhada completa
- `docs/SCHEMA_CLEANUP_SUMMARY.md` - Resumo executivo
- `supabase/migrations/20250201000018_update_subscription_cache_functions_household.sql` - Migration de funções
- `supabase/migrations/20250201000019_remove_legacy_householdmember_table.sql` - Migration de remoção

---

## ✅ CONCLUSÃO

As migrations foram executadas com sucesso em desenvolvimento. O próximo passo é validar funcionalmente que tudo está funcionando corretamente antes de prosseguir para produção.

**Status Atual:** ✅ Pronto para validação funcional


# Resumo de Políticas RLS (Row Level Security)

**Data de Análise:** 2025-02-02  
**Fonte:** `supabase/schema_reference.sql`

---

## Estatísticas Gerais

- **Total de Políticas RLS:** 160
- **Tabelas com RLS Habilitado:** 38
- **Cobertura:** Todas as tabelas que contêm dados sensíveis do usuário

---

## Distribuição de Políticas por Tipo de Operação

### SELECT (Leitura)
- Políticas que permitem visualização de dados
- Baseadas em:
  - Household membership (`get_user_accessible_households()`)
  - User ownership (`userId = auth.uid()`)
  - Account ownership (`AccountOwner` relationship)
  - Role-based access (admin, super_admin)

### INSERT (Inserção)
- Políticas que permitem criação de novos registros
- Validações incluem:
  - Verificação de household membership
  - Verificação de ownership
  - Permissões baseadas em role

### UPDATE (Atualização)
- Políticas que permitem modificação de registros existentes
- Geralmente requerem:
  - Write access ao household (`can_access_household_data(householdId, 'write')`)
  - Ownership direto ou via AccountOwner
  - Role de admin/owner para operações administrativas

### DELETE (Exclusão)
- Políticas que permitem remoção de registros
- Geralmente requerem:
  - Delete access ao household (`can_access_household_data(householdId, 'delete')`)
  - Ownership direto
  - Role de admin/owner

---

## Tabelas Protegidas por RLS

1. **Account** - Contas bancárias e de investimento
2. **AccountInvestmentValue** - Valores de investimento
3. **AccountOwner** - Relacionamento de ownership de contas
4. **Budget** - Orçamentos
5. **BudgetCategory** - Categorias de orçamento
6. **Candle** - Dados de preços históricos (Questrade)
7. **Category** - Categorias de transações
8. **ContactForm** - Formulários de contato
9. **Debt** - Dívidas e empréstimos
10. **Execution** - Execuções de ordens (Questrade)
11. **Feedback** - Feedback dos usuários
12. **Goal** - Metas financeiras
13. **Group** - Grupos de categorias
14. **Household** - Households (contas pessoais e compartilhadas)
15. **HouseholdMemberNew** - Membros de households
16. **InvestmentAccount** - Contas de investimento
17. **InvestmentTransaction** - Transações de investimento
18. **Order** - Ordens de investimento (Questrade)
19. **PlaidConnection** - Conexões Plaid
20. **PlaidLiability** - Passivos do Plaid
21. **Plan** - Planos de assinatura (público para leitura)
22. **PlannedPayment** - Pagamentos planejados
23. **Position** - Posições de investimento
24. **PromoCode** - Códigos promocionais
25. **QuestradeConnection** - Conexões Questrade
26. **Security** - Títulos/securities (público para leitura)
27. **SecurityPrice** - Preços de securities (público para leitura)
28. **SimpleInvestmentEntry** - Entradas simples de investimento
29. **Subcategory** - Subcategorias
30. **Subscription** - Assinaturas
31. **SystemSettings** - Configurações do sistema (apenas super_admin)
32. **Transaction** - Transações financeiras
33. **TransactionSync** - Sincronização de transações
34. **User** - Dados de usuários
35. **UserActiveHousehold** - Household ativo do usuário
36. **UserBlockHistory** - Histórico de bloqueios
37. **UserServiceSubscription** - Assinaturas de serviços
38. **category_learning** - Aprendizado de categorias
39. **user_monthly_usage** - Uso mensal do usuário

---

## Padrões de Acesso Implementados

### 1. Household-Based Access Control
- **Função:** `can_access_household_data(householdId, operation)`
- **Operações:** 'read', 'write', 'delete'
- **Roles:** owner, admin (write/delete), member (read)
- **Aplicado em:** Transaction, Account, Budget, Debt, Goal, PlannedPayment, etc.

### 2. User Ownership
- **Padrão:** `userId = auth.uid()`
- **Aplicado em:** Tabelas que ainda usam userId diretamente (backward compatibility)

### 3. Account Ownership
- **Função:** `can_access_account_via_accountowner(accountId)`
- **Aplicado em:** Account, AccountOwner
- **Permite:** Múltiplos owners por conta

### 4. Role-Based Access
- **Roles:** super_admin, admin, owner, member
- **Funções:** `is_current_user_admin()`, `get_user_admin_household_ids()`
- **Aplicado em:** SystemSettings, PromoCode, Category (system), Group (system)

### 5. Public Read Access
- **Tabelas:** Plan, Security, SecurityPrice, PromoCode (ativos)
- **Política:** `USING (true)` ou condições específicas para acesso público

### 6. Service Role Access
- **Aplicado em:** Plan, Subscription (operações administrativas)
- **Permite:** Operações do backend sem restrições RLS

---

## Funções Helper para RLS

### Verificação de Household
- `get_user_accessible_households()` - Retorna households acessíveis
- `get_user_household_ids()` - Retorna IDs de households do usuário
- `get_user_admin_household_ids()` - Retorna households onde usuário é admin/owner
- `can_access_household_data(householdId, operation)` - Verifica acesso a household
- `is_household_member(householdId)` - Verifica se é membro
- `get_user_household_role(householdId)` - Retorna role no household

### Verificação de Account
- `get_account_user_id(accountId)` - Retorna userId do account
- `can_access_account_via_accountowner(accountId)` - Verifica acesso via AccountOwner
- `is_account_owner_by_userid(accountId)` - Verifica ownership direto
- `is_account_owner_via_accountowner(accountId)` - Verifica ownership via AccountOwner

### Verificação de User
- `are_users_in_same_household(user1, user2)` - Verifica se dois usuários estão no mesmo household
- `is_current_user_admin()` - Verifica se usuário é admin

---

## Políticas Especiais

### SystemSettings
- **Acesso:** Apenas super_admin
- **Políticas:** SELECT, INSERT, UPDATE (todas restritas a super_admin)

### User Block History
- **Visualização:** Usuários podem ver seu próprio histórico
- **Inserção:** Apenas admins podem inserir registros de bloqueio

### ContactForm e Feedback
- **Inserção:** Usuários podem inserir seus próprios
- **Visualização:** Usuários veem apenas os seus
- **Admin:** Super admins podem ver todos

### Security e SecurityPrice
- **Leitura:** Público (qualquer usuário autenticado)
- **Inserção/Atualização:** Apenas para securities que o usuário possui ou super_admin

### Plan e PromoCode
- **Leitura:** Público (Plan) ou ativos (PromoCode)
- **Modificação:** Apenas service_role ou super_admin

---

## Segurança Adicional

### SECURITY DEFINER Functions
Funções marcadas com `SECURITY DEFINER` são usadas para:
- Evitar recursão infinita em políticas RLS
- Bypass RLS quando necessário para verificações de acesso
- Garantir que verificações de household/account funcionem corretamente

**Exemplos:**
- `can_access_household_data()`
- `get_user_accessible_households()`
- `get_account_user_id()`
- `are_users_in_same_household()`

---

## Cobertura de Segurança

✅ **100% das tabelas com dados sensíveis** têm RLS habilitado  
✅ **Todas as operações CRUD** são protegidas por políticas  
✅ **Household-based access control** implementado para dados compartilhados  
✅ **Backward compatibility** mantida com userId-based access  
✅ **Role-based access** para operações administrativas  
✅ **Account ownership** suporta múltiplos owners  

---

## Notas Importantes

1. **Migrations vs Schema Reference:**
   - O `schema_reference.sql` representa o estado atual do banco
   - Novas migrations podem adicionar mais políticas
   - O número de 160 políticas é baseado no schema atual

2. **Household Architecture:**
   - A maioria das políticas suporta tanto householdId quanto userId
   - Isso garante backward compatibility
   - Novas implementações devem usar householdId

3. **Performance:**
   - Funções helper são otimizadas com índices
   - Políticas usam funções STABLE quando possível
   - SECURITY DEFINER evita recursão mas mantém segurança

---

## Manutenção

Para atualizar este documento:
1. Execute: `grep -c "CREATE POLICY" supabase/schema_reference.sql`
2. Execute: `grep -c "ENABLE ROW LEVEL SECURITY" supabase/schema_reference.sql`
3. Atualize os números neste documento
4. Revise novas políticas adicionadas em migrations recentes


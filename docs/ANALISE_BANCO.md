# Análise Completa do Banco de Dados - Spare Finance

**Data da Análise**: 2024  
**Versão do Schema**: full_backup.sql  
**Status**: Análise Completa - Pronta para Correções

---

## Sumário Executivo

Esta análise identifica problemas de integridade, performance, segurança e consistência no schema do banco de dados Spare Finance. Foram identificados **8 categorias principais de problemas** com **15+ itens específicos** que requerem correção.

### Estatísticas do Schema
- **Tabelas**: 30+
- **Foreign Keys**: 51
- **Índices**: 81
- **RLS Policies**: 129
- **Funções**: 5

---

## Problemas Identificados por Severidade

### 🔴 CRÍTICO - Integridade de Dados

#### 1. Campos `userId` NULLABLE quando deveriam ser NOT NULL

**Problema**: Várias tabelas permitem `userId` NULL, mas o código da aplicação sempre requer um usuário autenticado.

**Tabelas Afetadas**:
- `InvestmentAccount.userId` (linha 454)
- `Budget.userId` (linha 206)
- `Debt.userId` (linha 317)
- `Goal.userId` (linha 402)

**Evidência do Código**:
- `lib/api/budgets.ts:278` - `userId: user.id` sempre definido
- `lib/api/debts.ts:236` - `userId: user.id` sempre definido
- `lib/api/goals.ts:306` - `userId: user.id` sempre definido
- `lib/api/investments.ts:531` - InvestmentAccount criado via Account com userId

**Impacto**:
- Permite criação de registros órfãos sem usuário
- Quebra RLS policies que dependem de `userId = auth.uid()`
- Dados inconsistentes e possíveis erros de segurança
- Queries podem retornar dados sem owner

**Severidade**: 🔴 CRÍTICO

**Correção Necessária**:
```sql
ALTER TABLE "InvestmentAccount" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Budget" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Debt" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Goal" ALTER COLUMN "userId" SET NOT NULL;
```

**Nota**: Antes de aplicar, verificar se existem registros com userId NULL e migrá-los ou removê-los.

---

### 🟠 ALTO - Nomenclatura e Consistência

#### 2. Foreign Key com Nome Incorreto

**Problema**: Foreign key nomeada como `Macro_userId_fkey` quando a tabela é `Group`.

**Localização**: Linha 1601
```sql
ADD CONSTRAINT "Macro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
```

**Impacto**:
- Confusão na manutenção
- Inconsistência com nomenclatura da tabela
- Possíveis erros em migrações futuras
- Dificulta debugging

**Severidade**: 🟠 ALTO

**Correção Necessária**:
```sql
ALTER TABLE "Group" RENAME CONSTRAINT "Macro_userId_fkey" TO "Group_userId_fkey";
```

---

#### 3. Foreign Key com Nome Inconsistente

**Problema**: Foreign key `Budget_groupId_fkey` referencia coluna `macroId` (não `groupId`).

**Localização**: Linha 1501
```sql
ADD CONSTRAINT "Budget_groupId_fkey" FOREIGN KEY ("macroId") REFERENCES "public"."Group"("id")
```

**Impacto**:
- Nome não reflete a coluna real
- Pode causar confusão
- Inconsistência com outras foreign keys

**Severidade**: 🟡 MÉDIO

**Correção Sugerida**:
```sql
ALTER TABLE "Budget" RENAME CONSTRAINT "Budget_groupId_fkey" TO "Budget_macroId_fkey";
```

---

### 🟡 MÉDIO - Performance e Otimização

#### 4. Índices Faltantes em Foreign Keys

**Problema**: Algumas foreign keys não têm índices correspondentes, impactando performance de JOINs.

**Análise**:
- ✅ `InvestmentTransaction.accountId` - TEM índice (linha 1287)
- ✅ `SimpleInvestmentEntry.accountId` - TEM índice (linha 1343)
- ✅ `Transaction.accountId` - TEM índice (linha 1383)
- ✅ `Account.userId` - TEM índice (linha 1135)
- ⚠️ Verificar outras relações

**Impacto**:
- JOINs mais lentos
- Queries de RLS podem ser ineficientes
- Performance degradada em tabelas grandes

**Severidade**: 🟡 MÉDIO

**Ação**: Revisar todas as foreign keys e garantir índices correspondentes.

---

#### 5. RLS Policies Complexas e Potencialmente Ineficientes

**Problema**: Algumas RLS policies fazem múltiplas subqueries aninhadas.

**Exemplo**: `InvestmentTransaction` RLS verifica via `Account`:
```sql
EXISTS ( SELECT 1 FROM "public"."Account"
  WHERE (("Account"."id" = "InvestmentTransaction"."accountId") 
    AND ("Account"."userId" = "auth"."uid"()) 
    AND ("Account"."type" = 'investment'::"text"))))
```

**Impacto**:
- Performance degradada em queries complexas
- Múltiplas verificações de RLS por query
- Possível timeout em grandes volumes de dados

**Severidade**: 🟡 MÉDIO

**Ação**: Considerar otimizar policies ou adicionar índices compostos.

---

### 🟢 BAIXO - Consistência e Documentação

#### 6. Inconsistência em Tipos de Dados Numéricos

**Problema**: Mistura de `double precision` e `numeric` sem padrão claro.

**Exemplos**:
- `Account.creditLimit`: `double precision`
- `AccountInvestmentValue.totalValue`: `double precision`
- `InvestmentAccount.cash`: `numeric(15,2)`
- `Candle.low`: `numeric(15,4)`

**Impacto**:
- Inconsistência na precisão
- Possíveis problemas de arredondamento
- Dificulta comparações

**Severidade**: 🟢 BAIXO

**Recomendação**: Padronizar:
- Valores monetários: `numeric(15,2)`
- Percentuais/taxas: `numeric(10,4)`
- Valores gerais: `double precision` (se não crítico)

---

#### 7. Campos `updatedAt` sem DEFAULT

**Problema**: `InvestmentAccount.updatedAt` não tem DEFAULT, mas outras tabelas têm.

**Localização**: Linha 453
```sql
"updatedAt" timestamp(3) without time zone NOT NULL,
```

**Comparação**:
- `AccountOwner.updatedAt`: `DEFAULT "now"() NOT NULL` ✅
- `HouseholdMember.updatedAt`: `DEFAULT "now"() NOT NULL` ✅
- `InvestmentAccount.updatedAt`: `NOT NULL` (sem DEFAULT) ❌

**Impacto**:
- Requer sempre definir `updatedAt` manualmente
- Inconsistência com outras tabelas
- Possível erro se esquecer de definir

**Severidade**: 🟢 BAIXO

**Correção**:
```sql
ALTER TABLE "InvestmentAccount" 
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
```

---

#### 8. Falta de Constraints Únicas Adicionais

**Problema**: Algumas combinações que deveriam ser únicas não têm constraint.

**Exemplos Potenciais**:
- `InvestmentAccount`: `(questradeAccountNumber, userId)` - pode haver duplicatas?
- `PlaidConnection`: `(itemId)` - já tem UNIQUE ✅
- `QuestradeConnection`: `(userId)` - pode ter múltiplas conexões? ✅

**Impacto**:
- Possíveis duplicatas de dados
- Inconsistência de dados

**Severidade**: 🟢 BAIXO

**Ação**: Analisar regras de negócio e adicionar constraints únicas onde apropriado.

---

## Análise de RLS Policies

### Tabelas com RLS Habilitado
✅ Todas as tabelas principais têm RLS habilitado.

### Políticas Críticas Verificadas

1. **Transaction** - ✅ Políticas corretas baseadas em `userId`
2. **Account** - ✅ Políticas corretas, suporta AccountOwner
3. **InvestmentTransaction** - ⚠️ Verifica via Account, pode ser otimizado
4. **Budget** - ✅ Políticas corretas baseadas em `userId`
5. **Debt** - ✅ Políticas corretas baseadas em `userId`
6. **Goal** - ✅ Políticas corretas baseadas em `userId`

### Gaps Identificados
- Nenhum gap crítico encontrado
- Algumas policies podem ser otimizadas para melhor performance

---

## Análise de Foreign Keys

### Foreign Keys Verificadas (51 total)

**Status Geral**: ✅ Todas as foreign keys estão corretamente definidas

**Observações**:
- Cascades estão apropriados (CASCADE para dependências, SET NULL para opcionais)
- Nomenclatura geralmente consistente (exceto itens 2 e 3)
- Todas referenciam tabelas existentes

### Foreign Keys por Tipo de Cascade

**ON DELETE CASCADE** (dados dependentes):
- Account → AccountOwner, Transaction, etc.
- User → Account, Budget, Debt, Goal, etc.
- InvestmentAccount → Position, Order, Execution

**ON DELETE SET NULL** (opcionais):
- Account → Debt.accountId, Goal.accountId
- User → ContactForm.userId, Subscription.userId (pending)

**ON DELETE RESTRICT** (proteção):
- Plan → Subscription.planId

---

## Análise de Índices

### Índices Existentes (81 total)

**Status Geral**: ✅ Boa cobertura de índices

**Índices Críticos Verificados**:
- ✅ `Transaction_userId_date_desc_idx` - Para queries de dashboard
- ✅ `Transaction_accountId_idx` - Para cálculos de saldo
- ✅ `Account_userId_idx` - Para RLS e queries
- ✅ `Budget_userId_idx` - Para RLS e queries
- ✅ `InvestmentAccount_userId_idx` - Para RLS e queries

**Índices Compostos Importantes**:
- ✅ `Budget_period_categoryId_subcategoryId_key` - Unique constraint
- ✅ `Transaction_userId_type_categoryId_date_idx` - Para relatórios

---

## Análise de Constraints

### CHECK Constraints

**Verificadas**:
- ✅ `Debt` - Múltiplos checks (valores >= 0, tipos válidos)
- ✅ `Goal` - Checks para valores >= 0
- ✅ `ContactForm` - Status válido
- ✅ `PromoCode` - Tipos e durações válidas

**Status**: ✅ Constraints adequadas

---

## Campos Especiais Analisados

### 1. `Transaction.amount` como TEXT
**Status**: ✅ CORRETO - Usado para criptografia
**Evidência**: `lib/utils/transaction-encryption.ts` usa encryptAmount/decryptAmount

### 2. `Subscription.userId` NULLABLE
**Status**: ✅ CORRETO - Permite subscriptions pendentes (pendingEmail)
**Evidência**: Comentário no schema confirma intenção

### 3. `InvestmentTransaction.accountId` → Account
**Status**: ✅ CORRETO - Referencia Account onde type='investment'
**Evidência**: RLS policy verifica `Account.type = 'investment'`

---

## Recomendações por Prioridade

### Prioridade 1 - CRÍTICO (Fazer Imediatamente)
1. ✅ Adicionar NOT NULL em `InvestmentAccount.userId`
2. ✅ Adicionar NOT NULL em `Budget.userId`
3. ✅ Adicionar NOT NULL em `Debt.userId`
4. ✅ Adicionar NOT NULL em `Goal.userId`
5. ✅ Renomear `Macro_userId_fkey` → `Group_userId_fkey`

### Prioridade 2 - ALTO (Fazer em Breve)
1. Renomear `Budget_groupId_fkey` → `Budget_macroId_fkey`
2. Verificar e adicionar índices faltantes
3. Otimizar RLS policies complexas

### Prioridade 3 - MÉDIO (Planejar)
1. Padronizar tipos numéricos
2. Adicionar DEFAULT em `InvestmentAccount.updatedAt`
3. Revisar constraints únicas necessárias

### Prioridade 4 - BAIXO (Melhorias Futuras)
1. Adicionar comentários em campos críticos
2. Documentar decisões de design
3. Criar scripts de validação contínua

---

## Checklist de Validação Pós-Correção

Após aplicar as correções, validar:

- [ ] Nenhum registro com userId NULL nas tabelas corrigidas
- [ ] Foreign keys renomeadas corretamente
- [ ] RLS policies funcionando corretamente
- [ ] Queries de performance mantidas ou melhoradas
- [ ] Tipos TypeScript atualizados se necessário
- [ ] Testes passando
- [ ] Backup realizado antes das mudanças

---

## Notas Finais

### Decisões de Design Confirmadas
- ✅ `Transaction.amount` como TEXT (criptografia) - CORRETO
- ✅ `Subscription.userId` NULLABLE (pending subscriptions) - CORRETO
- ✅ `InvestmentTransaction.accountId` → Account - CORRETO
- ✅ RLS habilitado em todas as tabelas - CORRETO

### Próximos Passos
1. Criar script de migração com todas as correções
2. Testar em ambiente de desenvolvimento
3. Aplicar em produção após validação
4. Atualizar documentação

---

**Documento gerado automaticamente pela análise do schema**  
**Última atualização**: 2024


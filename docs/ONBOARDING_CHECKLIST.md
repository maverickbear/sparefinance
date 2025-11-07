# 📋 Checklist de Configuração Inicial

Este documento lista todos os itens que precisam ser configurados quando um usuário acessa a conta pela primeira vez, para que possa usar o sistema sem precisar configurar posteriormente.

---

## 🎯 Ordem de Prioridade

### ⚠️ **OBRIGATÓRIO - Deve ser feito primeiro**

#### 1. **Criar Contas (Accounts)** ✅ OBRIGATÓRIO
**Por que é necessário:**
- **Transações**: Todas as transações precisam de uma conta (`accountId` é obrigatório)
- **Investimentos**: Contas de investimento podem ser vinculadas a contas bancárias
- **Dívidas**: Dívidas podem ser vinculadas a contas (recomendado)
- **Transferências**: Requer pelo menos 2 contas

**O que criar:**
- Pelo menos **1 conta** para começar a criar transações
- Tipos disponíveis:
  - `checking` - Conta corrente
  - `savings` - Poupança
  - `credit` - Cartão de crédito (requer `creditLimit`)
  - `cash` - Dinheiro em espécie
  - `investment` - Conta de investimento
  - `other` - Outros

**Configurações adicionais:**
- Para contas `checking` ou `savings`: definir `initialBalance` (saldo inicial)
- Para contas `credit`: definir `creditLimit` (limite de crédito)
- Definir `ownerIds` (proprietários) se usar sistema de membros/households

**Dependências:**
- Nenhuma (pode ser criado imediatamente)

---

#### 2. **Categorias e Grupos (Macros/Categories)** ✅ OBRIGATÓRIO
**Por que é necessário:**
- **Transações**: Para categorizar despesas e receitas (opcional, mas essencial para organização)
- **Budgets**: Categorias são obrigatórias para criar orçamentos
- **Relatórios**: Necessário para gerar relatórios por categoria

**Estrutura hierárquica:**
```
Macro (Grupo)
  └── Category (Categoria)
      └── Subcategory (Subcategoria) [opcional]
```

**O que criar:**
1. **Macros (Grupos)** - Exemplos:
   - "Essenciais"
   - "Lazer"
   - "Investimentos"
   - "Saúde"
   - "Transporte"

2. **Categories (Categorias)** - Exemplos:
   - Dentro de "Essenciais": "Alimentação", "Moradia", "Utilidades"
   - Dentro de "Lazer": "Entretenimento", "Viagens", "Hobbies"

3. **Subcategories (Subcategorias)** - Opcional:
   - Dentro de "Alimentação": "Supermercado", "Restaurantes", "Delivery"

**Nota:** O sistema já vem com algumas categorias padrão (sistema), mas você pode criar suas próprias.

**Dependências:**
- Nenhuma (pode ser criado imediatamente)

---

### 📊 **RECOMENDADO - Para funcionalidades específicas**

#### 3. **Contas de Investimento (Investment Accounts)** 📈
**Por que é necessário:**
- **Investment Transactions**: Todas as transações de investimento precisam de uma conta de investimento (`accountId` é obrigatório)

**O que criar:**
- Pelo menos **1 conta de investimento** para começar a registrar investimentos
- Tipos disponíveis:
  - `Wealthsimple`
  - `TFSA` (Tax-Free Savings Account)
  - `RRSP` (Registered Retirement Savings Plan)
  - `Crypto Wallet`
  - Outros tipos personalizados

**Configurações adicionais:**
- Opcionalmente vincular a uma `Account` bancária através de `accountId`

**Dependências:**
- Nenhuma (pode ser criado imediatamente)
- Opcional: ter uma `Account` criada para vincular

---

#### 4. **Securities (Ativos)** 📊
**Por que é necessário:**
- **Investment Transactions**: Para registrar compras/vendas de ativos específicos (opcional, mas recomendado)

**O que criar:**
- Ativos que você possui ou deseja rastrear
- Tipos disponíveis:
  - `stock` - Ações
  - `etf` - ETFs
  - `crypto` - Criptomoedas
  - `bond` - Títulos
  - `reit` - REITs

**Informações necessárias:**
- `symbol` - Símbolo único (ex: "AAPL", "BTC")
- `name` - Nome do ativo
- `class` - Classe do ativo

**Dependências:**
- Nenhuma (pode ser criado imediatamente)

---

### 🎯 **OPCIONAL - Para funcionalidades avançadas**

#### 5. **Transações de Receita (Income Transactions)** 💰
**Por que é necessário:**
- **Goals**: O sistema calcula o "income basis" (base de receita) a partir das últimas 3 transações de receita
- Sem transações de receita, os cálculos de metas podem não funcionar corretamente

**O que criar:**
- Pelo menos **1 transação de receita** para que o sistema possa calcular:
  - Income basis para Goals
  - Relatórios de receita vs despesa
  - Dashboard financeiro

**Dependências:**
- ✅ **Account** (obrigatório)
- ✅ **Category** (recomendado para organização)

---

#### 6. **Budgets (Orçamentos)** 📅
**Por que é necessário:**
- Para acompanhar gastos mensais por categoria
- Para receber alertas quando ultrapassar o orçamento

**O que criar:**
- Orçamentos mensais por categoria ou grupo de categorias
- Definir período (mês) e valor limite

**Dependências:**
- ✅ **Category** ou **Macro** (obrigatório)
- ✅ **Transações** (para acompanhar execução do orçamento)

---

#### 7. **Debts (Dívidas)** 💳
**Por que é necessário:**
- Para rastrear e planejar pagamento de dívidas
- Para calcular juros e tempo restante

**O que criar:**
- Dívidas como empréstimos, cartões de crédito, hipotecas, etc.

**Dependências:**
- ✅ **Account** (recomendado, mas opcional)

---

#### 8. **Goals (Metas)** 🎯
**Por que é necessário:**
- Para definir e acompanhar metas de economia
- Para calcular contribuições mensais baseadas em % da receita

**O que criar:**
- Metas de economia com valor alvo e prazo

**Dependências:**
- ✅ **Transações de Receita** (recomendado para cálculos precisos)

---

## 📝 Resumo Rápido

### Para criar **Transações**:
1. ✅ **Account** (obrigatório)
2. ✅ **Category** (opcional, mas recomendado)

### Para criar **Investimentos**:
1. ✅ **Investment Account** (obrigatório)
2. ✅ **Security** (opcional, mas recomendado)
3. ✅ **Account** (opcional, para vincular)

### Para criar **Budgets**:
1. ✅ **Category** ou **Macro** (obrigatório)

### Para criar **Dívidas**:
1. ✅ **Account** (recomendado, mas opcional)

### Para criar **Goals**:
1. ✅ **Transações de Receita** (recomendado para cálculos)

---

## 🚀 Fluxo Recomendado de Onboarding

### Passo 1: Configuração Básica (5 minutos)
1. Criar **pelo menos 1 Account** (ex: "Conta Corrente Principal")
2. Verificar se existem **Categories** padrão do sistema
3. Se necessário, criar **Macros e Categories** personalizadas

### Passo 2: Primeira Transação (2 minutos)
1. Criar uma **transação de receita** (ex: salário)
2. Criar uma **transação de despesa** (ex: compra no supermercado)

### Passo 3: Funcionalidades Avançadas (conforme necessário)
1. Se usar investimentos: criar **Investment Account** e **Securities**
2. Se quiser orçamentos: criar **Budgets** para categorias principais
3. Se tiver dívidas: criar **Debts**
4. Se tiver metas: criar **Goals**

---

## ⚠️ Problemas Comuns

### "Não consigo criar uma transação"
- **Causa**: Não há contas criadas
- **Solução**: Criar pelo menos 1 Account primeiro

### "Não consigo criar um budget"
- **Causa**: Não há categorias criadas
- **Solução**: Criar Categories (e seus Macros) primeiro

### "Não consigo criar uma transação de investimento"
- **Causa**: Não há Investment Account criada
- **Solução**: Criar uma Investment Account primeiro

### "Meus Goals não calculam corretamente"
- **Causa**: Não há transações de receita registradas
- **Solução**: Criar pelo menos 1 transação de receita (income)

---

## 📚 Referências

- [Documentação de Transações](./PRODUCT_DOCUMENTATION.md#transactions)
- [Documentação de Investimentos](./PRODUCT_DOCUMENTATION.md#investments)
- [Documentação de Goals](./GOALS.md)
- [Documentação de Budgets](./PRODUCT_DOCUMENTATION.md#budgets)

---

**Última atualização:** 2024-11-09


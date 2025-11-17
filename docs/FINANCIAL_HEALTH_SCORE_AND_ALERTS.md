# Spare Score e Alerts & Insights

Este documento explica como funcionam o **Spare Score** e o sistema de **Alerts & Insights** no Spare Finance.

## 📊 Spare Score

O Spare Score é uma métrica de 0 a 100 que avalia a saúde financeira do usuário com base em sua relação entre receitas e despesas mensais.

### Como é Calculado

O cálculo é baseado no **Expense Ratio** (Razão de Despesas), que é a porcentagem das despesas em relação à receita:

```
Expense Ratio = (Despesas Mensais / Receita Mensal) × 100
```

#### Casos Especiais:
- Se não há receita mas há despesas: `Expense Ratio = 100%`
- Se não há receita nem despesas: `Expense Ratio = 0%`

### Fórmula do Score

O score é calculado em faixas baseadas no Expense Ratio:

| Expense Ratio | Score | Classificação |
|---------------|-------|---------------|
| 0-60% | 91-100 | Excellent |
| 61-70% | 81-90 | Good |
| 71-80% | 71-80 | Fair |
| 81-90% | 61-70 | Poor |
| 91-100%+ | 0-60 | Critical |

#### Fórmulas Detalhadas:

**Excellent (0-60%):**
```
Score = max(91, 100 - (ExpenseRatio / 60) × 9)
```

**Good (61-70%):**
```
Score = max(81, 90 - ((ExpenseRatio - 60) / 10) × 9)
```

**Fair (71-80%):**
```
Score = max(71, 80 - ((ExpenseRatio - 70) / 10) × 9)
```

**Poor (81-90%):**
```
Score = max(61, 70 - ((ExpenseRatio - 80) / 10) × 9)
```

**Critical (91-100%+):**
```
Score = max(0, 60 - ((ExpenseRatio - 90) / 10) × 60)
```
*Nota: Para ratios acima de 100%, o cálculo é limitado a 200% para evitar scores negativos.*

### Métricas Adicionais

O Spare Score também calcula e exibe as seguintes métricas:

#### 1. Savings Rate (Taxa de Poupança)
```
Savings Rate = ((Receita - Despesas) / Receita) × 100
```

#### 2. Spending Discipline (Disciplina de Gastos)
Baseada na Savings Rate:

| Savings Rate | Classificação |
|--------------|---------------|
| ≥ 30% | Excellent |
| 20-29% | Good |
| 10-19% | Fair |
| 0-9% | Poor |
| < 0% | Critical |

#### 3. Debt Exposure (Exposição a Dívidas)
Calculada como a razão entre dívidas totais e receita anual:

```
Debt-to-Income Ratio = (Dívidas Totais / Receita Anual) × 100
```

| Ratio | Classificação |
|-------|---------------|
| < 20% | Low |
| 20-40% | Moderate |
| ≥ 40% | High |

**Fontes de Dívidas:**
- Tabela `debts` (dívidas não pagas)
- Tabela `plaid_liabilities` (dívidas do Plaid)

#### 4. Emergency Fund Months (Meses de Fundo de Emergência)
```
Emergency Fund Months = Saldo Total das Contas / Despesas Mensais
```

### Comparação com o Mês Anterior

O sistema também calcula o score do mês anterior para comparação:

- Busca transações do mês anterior
- Calcula o score usando a mesma lógica
- Exibe a diferença: `Score Atual - Score Mês Anterior`
- Mostra indicador visual de melhora (+) ou piora (-)

### Mensagens Personalizadas

Baseadas na classificação:

- **Excellent**: "You're living below your means — great job!"
- **Good/Fair**: "Your expenses are balanced but close to your limit."
- **Poor/Critical**: "Warning: you're spending more than you earn!"

### Cache e Performance

- Cache de 60 segundos para reduzir carga no servidor
- Chave de cache inclui `userId` e mês/ano para isolamento
- Tags: `['financial-health', 'transactions', 'dashboard']`

---

## 🔔 Alerts & Insights

O widget de **Alerts & Insights** gera alertas contextuais baseados na situação financeira atual do usuário.

### Tipos de Alertas

Os alertas são categorizados em três tipos:

1. **Success** (Verde) - Informações positivas ou oportunidades de melhoria
2. **Warning** (Amarelo) - Atenção necessária, mas não crítico
3. **Danger** (Vermelho) - Situação crítica que requer ação imediata

### Alertas Implementados

#### 1. Savings Rate Alert (Success)
**Condição:** Taxa de poupança entre 15% e 22%

**Mensagem:**
```
"You're saving {taxa}% of your income. Increasing this to 22% would help you reach your goals faster."
```

#### 2. Emergency Fund Alert (Warning)
**Condição:** Fundo de emergência cobre menos de 6 meses

**Cálculo:**
- Meses necessários: `6 - emergencyFundMonths`
- Poupança mensal: `Receita - Despesas`
- Meses para atingir: `ceil((mesesNecessários × Despesas) / PoupançaMensal)`
- Transferência sugerida: `10% da poupança mensal` (mínimo $250)

**Mensagem:**
```
"Your emergency fund covers {meses} months. Setting an automatic transfer of ${valor}/month would get you to 6 months in about {mesesParaAtingir} months."
```

#### 3. Overspending Alert (Danger)
**Condição:** Despesas do mês atual são mais de 20% maiores que o mês anterior

**Cálculo:**
```
Variação = ((Despesas Atuais - Despesas Mês Anterior) / Despesas Mês Anterior) × 100
```

**Mensagem:**
```
"Your spending is {variação}% higher than last month. Consider reviewing your budget categories."
```

### Interface do Widget

- **Expansível**: Cada alerta pode ser expandido/recolhido para ver texto completo
- **Badges**: Cada alerta tem um badge colorido indicando o tipo
- **Ícones**: Ícones visuais para cada tipo de alerta
  - ✅ CheckCircle2 (Success)
  - ⚠️ AlertCircle (Warning)
  - 🔺 AlertTriangle (Danger)

### Alertas do Backend (Spare Score API)

Além dos alertas do widget, a API de Spare Score também gera alertas:

#### 1. Expenses Exceeding Income (Critical)
**Condição:** `Despesas > Receita`

**Mensagem:**
```
"Your monthly expenses ({valor}) are {porcentagem}% higher than your monthly income ({valor})."
```

**Ação sugerida:**
```
"Review your expenses and identify where you can reduce costs."
```

#### 2. Negative Savings Rate (Critical)
**Condição:** `Savings Rate < 0`

**Mensagem:**
```
"You are spending {valor} more than you earn per month."
```

**Ação sugerida:**
```
"Create a strict budget and increase your income or reduce expenses."
```

#### 3. Low Savings Rate (Warning)
**Condição:** `0 < Savings Rate < 10%`

**Mensagem:**
```
"You are saving only {taxa}% of your income ({valor}/month)."
```

**Ação sugerida:**
```
"Try to increase your savings rate to at least 20%."
```

#### 4. Very Low Savings Rate (Info)
**Condição:** `0 < Savings Rate < 5%`

**Mensagem:**
```
"Your savings rate of {taxa}% is below recommended."
```

**Ação sugerida:**
```
"Consider reviewing your expenses to increase your savings capacity."
```

### Sugestões (Suggestions)

A API também gera sugestões baseadas no score e situação financeira:

#### Alto Impacto (High Impact)
- Reduzir despesas urgentemente (quando despesas > receita)
- Aumentar receita ou reduzir despesas (quando savings rate < 0)
- Aumentar taxa de poupança (quando 0 ≤ savings rate < 10%)

#### Médio Impacto (Medium Impact)
- Revisar gastos (quando 10% ≤ savings rate < 20%)
- Criar orçamento (quando despesas > 90% da receita)

#### Baixo Impacto (Low Impact)
- Otimizar poupança (quando 20% ≤ savings rate < 30%)
- Manter boas práticas (quando savings rate ≥ 30%)

---

## 🔄 Fluxo de Dados

### 1. Cálculo do Spare Score

```
Dashboard Page
    ↓
calculateFinancialHealth()
    ↓
calculateFinancialHealthInternal()
    ↓
├─ getTransactionsInternal() → Transações do mês
├─ getDebts() → Dívidas do usuário
├─ getUserLiabilities() → Dívidas do Plaid
├─ getAccounts() → Contas e saldos
└─ Cálculo do score do mês anterior
    ↓
Retorna FinancialHealthData
```

### 2. Geração de Alertas

```
AlertsInsightsWidget
    ↓
useMemo() → Calcula alertas baseado em:
├─ currentIncome
├─ currentExpenses
├─ emergencyFundMonths
├─ selectedMonthTransactions
└─ lastMonthTransactions
    ↓
Gera lista de alertas
    ↓
Renderiza no widget
```

---

## 📝 Notas Técnicas

### Validações

- Score sempre entre 0 e 100
- Validação de `NaN` e valores infinitos
- Tratamento de casos sem transações
- Fallback para valores padrão em caso de erro

### Tratamento de Erros

- Se o cálculo falhar, retorna score 0 com classificação "Critical"
- Mensagem de erro amigável ao usuário
- Logs de erro para debugging
- Sistema continua funcionando mesmo com dados parciais

### Performance

- Cache de 60 segundos
- Cálculos otimizados
- Uso de `unstable_cache` do Next.js
- Isolamento por usuário no cache

---

## 🎯 Exemplos Práticos

### Exemplo 1: Score Excellent
- **Receita Mensal**: $5,000
- **Despesas Mensais**: $2,500
- **Expense Ratio**: 50%
- **Score**: ~96
- **Classificação**: Excellent
- **Savings Rate**: 50%
- **Spending Discipline**: Excellent

### Exemplo 2: Score Good
- **Receita Mensal**: $4,000
- **Despesas Mensais**: $2,800
- **Expense Ratio**: 70%
- **Score**: ~81
- **Classificação**: Good
- **Savings Rate**: 30%
- **Spending Discipline**: Excellent

### Exemplo 3: Score Critical
- **Receita Mensal**: $3,000
- **Despesas Mensais**: $3,500
- **Expense Ratio**: 116.7%
- **Score**: ~0
- **Classificação**: Critical
- **Savings Rate**: -16.7%
- **Spending Discipline**: Critical
- **Alerta**: "Expenses Exceeding Income" (Critical)

---

## 📚 Referências

- Arquivo principal: `lib/api/financial-health.ts`
- Widget do Score: `app/(protected)/dashboard/widgets/financial-health-score-widget.tsx`
- Widget de Alertas: `app/(protected)/dashboard/widgets/alerts-insights-widget.tsx`
- Interface: `FinancialHealthData` em `lib/api/financial-health.ts`


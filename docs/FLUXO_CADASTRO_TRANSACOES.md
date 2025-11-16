# Fluxo de Cadastro de Transações - Documentação Completa

Este documento descreve o fluxo completo de cadastro de uma nova transação, desde a interface do usuário até o armazenamento no banco de dados, incluindo todas as validações, segurança e processamentos envolvidos.

## Índice

1. [Visão Geral](#visão-geral)
2. [Fluxo Frontend](#fluxo-frontend)
3. [Fluxo Backend](#fluxo-backend)
4. [Validações](#validações)
5. [Segurança e Criptografia](#segurança-e-criptografia)
6. [Limites de Plano](#limites-de-plano)
7. [Sugestão de Categorias](#sugestão-de-categorias)
8. [Transferências](#transferências)
9. [Leitura de Transações](#leitura-de-transações)
10. [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)
11. [Tratamento de Erros](#tratamento-de-erros)

---

## Visão Geral

O sistema de cadastro de transações é composto por:

- **Frontend**: Componente React (`TransactionForm`) que coleta dados do usuário
- **API Route**: Endpoint Next.js (`/api/transactions`) que recebe requisições HTTP
- **Server Action**: Função server-side (`createTransaction`) que processa e salva no banco
- **Banco de Dados**: Tabela `Transaction` no Supabase (PostgreSQL)

O fluxo completo envolve validações, verificação de limites, criptografia de dados sensíveis, sugestão inteligente de categorias e tratamento especial para transferências.

---

## Fluxo Frontend

### 1. Componente TransactionForm

**Localização**: `components/forms/transaction-form.tsx`

#### 1.1 Inicialização do Formulário

Quando o formulário é aberto:

1. **Verificação de Contas**: O sistema verifica se o usuário possui contas cadastradas
   - Se não houver contas, exibe `AccountRequiredDialog`
   - Se houver contas, carrega os dados necessários

2. **Carregamento de Dados**:
   - Lista de contas (`/api/accounts`)
   - Lista de categorias (`/api/categories?all=true`)
   - Limite de transações do plano atual

3. **Inicialização do Form**:
   ```typescript
   const form = useForm<TransactionFormData>({
     resolver: zodResolver(transactionSchema),
     defaultValues: {
       date: new Date(),
       type: "expense",
       amount: 0,
       recurring: false,
     },
   });
   ```

#### 1.2 Campos do Formulário

O formulário coleta os seguintes dados:

- **date**: Data da transação (Date)
- **type**: Tipo (`"expense" | "income" | "transfer"`)
- **amount**: Valor (number, positivo)
- **accountId**: ID da conta (obrigatório)
- **toAccountId**: ID da conta de destino (obrigatório apenas para transferências)
- **categoryId**: ID da categoria (opcional, não usado em transferências)
- **subcategoryId**: ID da subcategoria (opcional)
- **description**: Descrição (opcional)
- **recurring**: Se é recorrente (boolean, default: false)
- **expenseType**: Tipo de despesa (`"fixed" | "variable"`, apenas para expenses)

#### 1.3 Validação no Frontend

A validação é feita usando **Zod** através do schema `transactionSchema`:

```typescript
// Validações principais:
- date: deve ser uma Date válida
- type: deve ser "expense", "income" ou "transfer"
- amount: deve ser positivo
- accountId: obrigatório (string não vazia)
- toAccountId: obrigatório se type === "transfer" e deve ser diferente de accountId
- expenseType: só pode ser definido se type === "expense"
```

#### 1.4 Verificação de Limite

Antes de enviar a requisição, o frontend verifica o limite de transações:

```typescript
if (!transaction && transactionLimit) {
  if (transactionLimit.limit !== -1 && transactionLimit.current >= transactionLimit.limit) {
    // Exibe toast de erro e impede o envio
    return;
  }
}
```

#### 1.5 Envio da Requisição

Quando o usuário submete o formulário:

```typescript
// Helper function to convert Date to YYYY-MM-DD string (avoids timezone issues)
function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const url = transaction ? `/api/transactions/${transaction.id}` : "/api/transactions";
const method = transaction ? "PATCH" : "POST";

const payload = {
  ...data,
  // Send date as YYYY-MM-DD string, NOT ISO timestamp (toISOString())
  // This avoids timezone bugs since Transaction.date is now a 'date' type in PostgreSQL
  date: data.date instanceof Date ? toDateOnlyString(data.date) : data.date,
};

// Remove expenseType se não for expense
if (data.type !== "expense") {
  delete payload.expenseType;
}

const res = await fetch(url, {
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```

**Importante**: A data é enviada como string `YYYY-MM-DD` (não `toISOString()`), evitando problemas de timezone. O backend recebe essa string e a converte para Date apenas para validação, mas `formatDateOnly()` converte de volta para `YYYY-MM-DD` antes de salvar no banco.

---

## Fluxo Backend

### 2. API Route (`/api/transactions`)

**Localização**: `app/api/transactions/route.ts`

#### 2.1 Endpoint POST

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Date is now sent as YYYY-MM-DD string from frontend to avoid timezone issues
    // Convert to Date object for validation (formatDateOnly will convert back to YYYY-MM-DD)
    const data: TransactionFormData = {
      ...body,
      // Parse YYYY-MM-DD string to Date (add T00:00:00 to avoid timezone conversion)
      date: body.date instanceof Date ? body.date : new Date(body.date + 'T00:00:00'),
    };
    
    // Valida com schema Zod
    const validatedData = transactionSchema.parse(data);
    
    // Chama função server-side para criar transação
    // createTransaction() usa formatDateOnly() que converte Date para YYYY-MM-DD
    const transaction = await createTransaction(validatedData);
    
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    // Tratamento de erros...
  }
}
```

**Nota**: O frontend envia `YYYY-MM-DD` (não `toISOString()`), e o backend converte para Date apenas para validação. O `createTransaction()` usa `formatDateOnly()` que retorna `YYYY-MM-DD` novamente, garantindo que a data seja salva exatamente como o usuário selecionou, sem problemas de timezone.

**Fluxo**:
1. Recebe o body da requisição
2. Converte a data para objeto Date
3. Valida com `transactionSchema.parse()`
4. Chama `createTransaction()` (server action)
5. Retorna a transação criada ou erro

---

### 3. Server Action (`createTransaction`)

**Localização**: `lib/api/transactions.ts`

#### 3.1 Autenticação e Validação Inicial

```typescript
export async function createTransaction(data: TransactionFormData) {
  const supabase = await createServerClient();
  
  // 1. Verifica autenticação
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }
  
  const userId = user.id;
  
  // 2. Verifica limite de transações do plano
  const limitGuard = await guardTransactionLimit(userId, data.date);
  await throwIfNotAllowed(limitGuard);
}
```

#### 3.2 Formatação de Data

```typescript
// Formata data para PostgreSQL date type (YYYY-MM-DD)
// Mudança: date agora é do tipo 'date' (não timestamp) para evitar bugs de timezone
// Usa formatDateOnly para salvar apenas a data no formato YYYY-MM-DD
const date = data.date instanceof Date ? data.date : new Date(data.date);
const transactionDate = formatDateOnly(date); // Retorna "YYYY-MM-DD"
```

**Nota**: O campo `date` na tabela `Transaction` foi alterado de `timestamp(3) without time zone` para `date` para evitar problemas de timezone e simplificar comparações de datas.

#### 3.2.1 Preparação de Campos Auxiliares

O sistema agora preenche campos auxiliares para melhorar performance e permitir operações sem descriptografar:

```typescript
// Criptografa dados sensíveis
const encryptedDescription = encryptDescription(data.description || null);
const encryptedAmount = encryptAmount(data.amount);

// Prepara campos auxiliares (não criptografados, para performance)
const descriptionSearch = normalizeDescription(data.description); // Normalizado para busca
const amountNumeric = data.amount; // Valor numérico para SUM/AVG/ORDER BY
```

**Campos auxiliares**:
- `amount_numeric`: Valor numérico não criptografado para relatórios e agregações
- `description_search`: Descrição normalizada (lowercase, sem caracteres especiais) para busca rápida

#### 3.3 Sugestão de Categoria (IA)

Se não houver `categoryId` fornecido e houver `description`, o sistema tenta sugerir uma categoria:

```typescript
let categorySuggestion = null;
if (!data.categoryId && data.description) {
  try {
    categorySuggestion = await suggestCategory(
      userId,
      data.description,
      data.amount,
      data.type
    );
  } catch (error) {
    // Continua sem sugestão se houver erro
  }
}
```

**Como funciona a sugestão** (otimizado):
- **Primário**: Consulta tabela `category_learning` (muito mais rápido)
- **Fallback**: Se tabela não existir, busca transações dos últimos 12 meses (método legado)
- Normaliza descrições usando função centralizada `normalizeDescription()`
- Procura por matches na tabela agregada:
  - **Alta confiança**: Mesma descrição + mesmo valor (3+ ocorrências) OU mesma descrição (5+ ocorrências)
  - **Média confiança**: Mesma descrição + mesmo valor (2 ocorrências) OU mesma descrição (3-4 ocorrências)
  - **Baixa confiança**: Mesma descrição + mesmo valor (1 ocorrência) OU mesma descrição (1 ocorrência)

#### 3.4 Tratamento de Transferências

Transferências são tratadas de forma especial usando uma **função SQL atômica** que garante:
- Criação de duas transações vinculadas em uma única transação
- Verificação e incremento de limite atomicamente
- Contagem como 1 transação (não 2) para limites mensais

```typescript
if (data.type === "transfer" && data.toAccountId) {
  // Usa função SQL para criação atômica
  const { data: transferResult, error: transferError } = await supabase.rpc(
    'create_transfer_with_limit',
    {
      p_user_id: userId,
      p_from_account_id: data.accountId,
      p_to_account_id: data.toAccountId,
      p_amount: encryptedAmount,
      p_amount_numeric: amountNumeric,
      p_date: transactionDate,
      p_description: encryptedDescription,
      p_description_search: descriptionSearch,
      p_recurring: data.recurring ?? false,
      p_max_transactions: limits.maxTransactions,
    }
  );
  
  // Busca a transação de saída para retornar
  const outgoingId = transferResult?.outgoing_id;
  const { data: outgoingTransaction } = await supabase
    .from("Transaction")
    .select("*")
    .eq("id", outgoingId)
    .single();
  
  return outgoingTransaction;
}
```

**Função SQL `create_transfer_with_limit`**:
- Verifica limite de transações do mês
- Incrementa contador em `user_monthly_usage` (conta como 1, não 2)
- Cria ambas as transações (outgoing e incoming) atomicamente
- Se qualquer operação falhar, tudo é revertido (rollback)

**Características**:
- **Atomicidade**: Tudo acontece em uma única transação SQL
- **Limite correto**: Transferência conta como 1 transação no limite mensal
- **Campos auxiliares**: Preenche `amount_numeric` e `description_search` em ambas
- **Vinculação**: Campos `transferToId` e `transferFromId` vinculam as transações
- **Sem categoria**: Transferências não têm categoria (não são despesas/receitas)

#### 3.5 Criação de Transação Regular

Para transações normais (expense ou income), o sistema usa uma **função SQL atômica** que garante:
- Verificação e incremento de limite em uma única transação
- Preenchimento automático de campos auxiliares
- Atomicidade total (se limite falhar, transação não é criada)

```typescript
// Determina categoria final
const finalCategoryId = data.type === "transfer" ? null : (data.categoryId || null);
const finalSubcategoryId = data.type === "transfer" ? null : (data.subcategoryId || null);

// Gera UUID para a transação
const id = crypto.randomUUID();

// Usa função SQL para criação atômica com verificação de limite
const { data: transactionResult, error: transactionError } = await supabase.rpc(
  'create_transaction_with_limit',
  {
    p_id: id,
    p_date: transactionDate,
    p_type: data.type,
    p_amount: encryptedAmount,
    p_amount_numeric: amountNumeric,
    p_account_id: data.accountId,
    p_user_id: userId,
    p_category_id: finalCategoryId,
    p_subcategory_id: finalSubcategoryId,
    p_description: encryptedDescription,
    p_description_search: descriptionSearch,
    p_recurring: data.recurring ?? false,
    p_expense_type: data.type === "expense" ? (data.expenseType || null) : null,
    p_created_at: now,
    p_updated_at: now,
    p_max_transactions: limits.maxTransactions,
  }
);

// Busca a transação criada
// Nota: Atualmente fazemos 2 round-trips (RPC + SELECT)
// Futura otimização: função SQL pode retornar a linha diretamente via RETURN QUERY
const { data: transaction } = await supabase
  .from("Transaction")
  .select("*")
  .eq("id", id)
  .single();
```

**Função SQL `create_transaction_with_limit`**:
- Verifica limite de transações do mês
- Incrementa contador em `user_monthly_usage`
- Insere transação com todos os campos (incluindo auxiliares)
- Tudo em uma única transação SQL (atomicidade garantida)
- Retorna JSON com `transaction_id` e `new_count`

**Nota sobre Performance**: Atualmente fazemos RPC + SELECT separado (2 round-trips). Isso é aceitável para a maioria dos casos. Uma otimização futura seria fazer a função SQL retornar a linha completa via `RETURN QUERY SELECT * FROM "Transaction" WHERE id = p_id;`, eliminando o segundo SELECT.

#### 3.6 Salvamento de Sugestão de Categoria

Se houver sugestão de categoria (qualquer nível de confiança), ela é salva para aprovação do usuário:

```typescript
if (categorySuggestion) {
  await supabase
    .from('Transaction')
    .update({
      suggestedCategoryId: categorySuggestion.categoryId,
      suggestedSubcategoryId: categorySuggestion.subcategoryId || null,
      updatedAt: formatTimestamp(new Date()),
    })
    .eq('id', id);
}
```

**Nota**: A sugestão é salva, mas **não aplicada automaticamente**. O usuário pode aprovar ou rejeitar posteriormente.

#### 3.6.1 Atualização de Category Learning

Quando o usuário confirma uma categoria (fornecendo `categoryId`), o sistema atualiza a tabela `category_learning` para melhorar futuras sugestões:

```typescript
// Atualiza category_learning quando categoria é confirmada
if (finalCategoryId) {
  await updateCategoryLearning(
    userId,
    descriptionSearch,
    data.type,
    finalCategoryId,
    finalSubcategoryId,
    data.amount
  );
}
```

Esta atualização permite que futuras sugestões sejam muito mais rápidas, consultando apenas a tabela agregada em vez de escanear 12 meses de transações.

#### 3.7 Invalidação de Cache

Após criar a transação, o cache é invalidado:

```typescript
const { invalidateTransactionCaches } = await import('@/lib/services/cache-manager');
invalidateTransactionCaches();
```

Isso garante que o dashboard e outras visualizações mostrem dados atualizados.

---

## Validações

### 4.1 Validação no Frontend (Zod)

**Schema**: `lib/validations/transaction.ts`

```typescript
const transactionSchemaBase = z.object({
  date: z.date(),
  type: z.enum(["expense", "income", "transfer"]),
  amount: z.number().positive("Amount must be positive"),
  accountId: z.string().min(1, "Account is required"),
  toAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  description: z.string().optional(),
  recurring: z.boolean().default(false),
  expenseType: z.union([z.enum(["fixed", "variable"]), z.null()]).optional(),
});

export const transactionSchema = transactionSchemaBase
  .refine((data) => {
    // Transfer requer toAccountId diferente de accountId
    if (data.type === "transfer") {
      return !!data.toAccountId && data.toAccountId !== data.accountId;
    }
    return true;
  }, {
    message: "Transfer requires a different destination account",
    path: ["toAccountId"],
  })
  .refine((data) => {
    // expenseType só pode ser definido se type é expense
    if (data.type !== "expense" && data.expenseType !== undefined && data.expenseType !== null) {
      return false;
    }
    return true;
  }, {
    message: "expenseType can only be set for expense transactions",
    path: ["expenseType"],
  });
```

### 4.2 Validação no Backend

- **Autenticação**: Verifica se o usuário está autenticado
- **Limite de Plano**: Verifica se o usuário pode criar mais transações no mês
- **Schema Zod**: Valida novamente os dados recebidos
- **Constraints do Banco**: O banco valida foreign keys, tipos, etc.

---

## Segurança e Criptografia

### 5.1 Criptografia de Dados Sensíveis

**Localização**: `lib/utils/transaction-encryption.ts`

O sistema criptografa dados sensíveis antes de salvar no banco:

#### 5.1.1 Descrição

```typescript
export function encryptDescription(description: string | null): string | null {
  if (!description) return null;
  return encrypt(description);
}
```

#### 5.1.2 Valor (Amount)

```typescript
export function encryptAmount(amount: number | null): string | null {
  if (amount === null || amount === undefined) return null;
  // Converte número para string e criptografa
  const amountString = amount.toString();
  return encrypt(amountString);
}
```

**Nota**: O campo `amount` na tabela é do tipo `text` para armazenar dados criptografados.

### 5.2 Descriptografia

Ao ler transações do banco, os dados são descriptografados:

```typescript
export function decryptAmount(encryptedAmount: string | number | null): number | null {
  // Tenta descriptografar, com fallback para dados não criptografados (backward compatibility)
  // ...
}

export function decryptDescription(encryptedDescription: string | null): string | null {
  // Tenta descriptografar, com fallback para texto plano (backward compatibility)
  // ...
}
```

### 5.3 Row Level Security (RLS)

O Supabase implementa RLS na tabela `Transaction`:

- Usuários só podem ver/editar/deletar suas próprias transações
- Políticas RLS garantem isolamento de dados entre usuários

---

## Limites de Plano

### 6.1 Verificação de Limite

**Localização**: `lib/api/feature-guard.ts`

O sistema agora usa a tabela `user_monthly_usage` para verificação de limites, eliminando queries `COUNT(*)` lentas:

```typescript
export async function guardTransactionLimit(
  userId: string,
  month?: Date
): Promise<GuardResult> {
  // 1. Obtém limites do plano do usuário
  const { limits, plan } = await checkPlanLimits(userId);
  
  // 2. Se plano ilimitado (-1), permite
  if (limits.maxTransactions === -1) {
    return { allowed: true };
  }
  
  // 3. Calcula month_date (primeiro dia do mês) - formato date, não timestamp
  const checkMonth = month || new Date();
  const monthDate = new Date(checkMonth.getFullYear(), checkMonth.getMonth(), 1);
  const monthDateStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(monthDate.getDate()).padStart(2, '0')}`;
  
  // 4. Lê de user_monthly_usage (lookup rápido, sem COUNT)
  const { data: usage, error } = await supabase
    .from("user_monthly_usage")
    .select("transactions_count")
    .eq("user_id", userId)
    .eq("month_date", monthDateStr)
    .single();
  
  // 5. Verifica se está dentro do limite
  const current = usage?.transactions_count || 0;
  const allowed = current < limits.maxTransactions;
  
  if (!allowed) {
    return {
      allowed: false,
      error: createPlanError(PlanErrorCode.TRANSACTION_LIMIT_REACHED, {
        limit: limits.maxTransactions,
        current,
        currentPlan: plan?.name,
      }),
    };
  }
  
  return { allowed: true };
}
```

**Melhorias**:
- **Performance**: Lookup direto em vez de `COUNT(*)` em toda a tabela
- **Escalabilidade**: Performance constante independente do número de transações
- **Atomicidade**: Incremento de contador acontece dentro das funções SQL junto com criação de transação

### 6.2 Onde é Verificado

1. **Frontend**: Antes de enviar a requisição (mostra aviso se próximo do limite)
   - Usa `guardTransactionLimit()` como **soft check** para UX (bloquear botão, mostrar mensagem)
   
2. **Backend**: No `createTransaction()` antes de inserir no banco
   - `guardTransactionLimit()` é chamado como **pré-check** (validação rápida)
   - **Enforcement real** acontece nas funções SQL (`create_transaction_with_limit` / `create_transfer_with_limit`)
   - As funções SQL fazem verificação e incremento de limite **atomicamente** dentro da transação
   - Se o limite for excedido, a função SQL lança exceção e nada é criado (rollback automático)

**Arquitetura de Verificação**:
- **Soft Check** (`guardTransactionLimit`): Leitura rápida de `user_monthly_usage` para UX
- **Hard Check** (funções SQL): Verificação atômica dentro da transação SQL (fonte da verdade)

---

## Sugestão de Categorias

### 7.1 Algoritmo de Sugestão

**Localização**: `lib/api/category-learning.ts`

O sistema usa aprendizado baseado em histórico do usuário, otimizado com a tabela `category_learning`:

1. **Normalização de Descrição** (função centralizada):
   ```typescript
   export function normalizeDescription(description: string | null | undefined): string {
     if (!description) return "";
     return description
       .toLowerCase()
       .replace(/[^a-z0-9\s]/g, "")
       .trim()
       .replace(/\s+/g, " ");
   }
   ```
   **Localização**: `lib/utils/transaction-encryption.ts` (centralizada para consistência)

2. **Busca Otimizada**: 
   - **Primário**: Consulta tabela `category_learning` (muito mais rápido)
   - **Fallback**: Se tabela não existir, busca transações dos últimos 12 meses (método legado)

3. **Matching na Tabela category_learning**:
   ```typescript
   const { data: learningData } = await supabase
     .from("category_learning")
     .select("category_id, subcategory_id, description_and_amount_count, description_only_count, last_used_at")
     .eq("user_id", userId)
     .eq("normalized_description", normalizedDesc)
     .eq("type", type)
     .order("last_used_at", { ascending: false });
   ```

4. **Níveis de Confiança** (mesmos critérios, dados da tabela agregada):
   - **Alta**: 3+ matches (descrição+valor) OU 5+ matches (descrição)
   - **Média**: 2 matches (descrição+valor) OU 3-4 matches (descrição)
   - **Baixa**: 1 match (descrição+valor) OU 1 match (descrição)

5. **Atualização de Learning**: Quando usuário confirma categoria, `updateCategoryLearning()` atualiza a tabela agregada

6. **Salvamento**: A sugestão é salva em `suggestedCategoryId` e `suggestedSubcategoryId`, mas **não aplicada automaticamente**.

**Benefícios da otimização**:
- **Performance**: Consulta única em tabela pequena vs. scan de 12 meses de transações
- **Escalabilidade**: Performance constante mesmo com milhares de transações
- **Atualização incremental**: Tabela é atualizada a cada confirmação de categoria

---

## Transferências

### 8.1 Como Funcionam

Transferências são criadas como **duas transações vinculadas**:

1. **Transação de Saída** (conta origem):
   - `type`: `"expense"`
   - `accountId`: conta de origem
   - `transferToId`: ID da transação de entrada

2. **Transação de Entrada** (conta destino):
   - `type`: `"income"`
   - `accountId`: conta de destino
   - `transferFromId`: ID da transação de saída

### 8.2 Características

- **Atomicidade**: Se uma falhar, a outra é revertida
- **Sem Categoria**: Transferências não têm categoria (não são despesas/receitas)
- **Mesmo Valor**: Ambas têm o mesmo valor (criptografado)
- **Vinculação**: Campos `transferToId` e `transferFromId` criam a relação

### 8.3 Validação

- `toAccountId` é obrigatório e deve ser diferente de `accountId`
- Validação feita no schema Zod e no backend

---

## Leitura de Transações

### 9.1 Função getTransactions

**Localização**: `lib/api/transactions.ts`

A função `getTransactions()` foi otimizada para usar os campos auxiliares `amount_numeric` e `description_search`:

#### 9.1.1 Busca Otimizada com description_search

A busca de descrições agora acontece **no banco de dados** usando `description_search`, eliminando a necessidade de descriptografar todas as transações:

```typescript
// Use description_search for search (much faster than decrypting everything)
if (filters?.search) {
  const normalizedSearch = normalizeDescription(filters.search);
  // Use ILIKE for case-insensitive search on normalized description_search
  filteredQuery = filteredQuery.ilike("description_search", `%${normalizedSearch}%`);
}
```

**Benefícios**:
- **Performance**: Busca no banco com índice GIN (muito mais rápido)
- **Pagination**: Pode paginar no banco mesmo com busca ativa
- **Escalabilidade**: Performance constante independente do número de transações

#### 9.1.2 Uso de amount_numeric

Ao retornar transações, o sistema prefere `amount_numeric` quando disponível:

```typescript
let transactions = (data || []).map((tx: any) => {
  // Use amount_numeric if available, otherwise decrypt amount
  const amount = tx.amount_numeric !== null && tx.amount_numeric !== undefined
    ? tx.amount_numeric
    : decryptAmount(tx.amount);
  
  return {
    ...tx,
    amount: amount,
    description: decryptDescription(tx.description), // Sempre descriptografa para exibição
    // ... outros campos
  };
});
```

**Benefícios**:
- **Performance**: Evita descriptografar quando `amount_numeric` está disponível
- **Backward Compatibility**: Ainda descriptografa `amount` se `amount_numeric` não existir
- **Consistência**: Sempre retorna valor numérico para o frontend

#### 9.1.3 Paginação Otimizada

Com `description_search`, a paginação pode acontecer no banco mesmo com busca ativa:

```typescript
// Now that we use description_search, we can paginate in the database even with search
if (filters?.page !== undefined && filters?.limit !== undefined) {
  const page = Math.max(1, filters.page);
  const limit = Math.max(1, Math.min(100, filters.limit));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);
}
```

**Antes**: Com busca, precisava carregar todas as transações, descriptografar, filtrar em memória e depois paginar.

**Agora**: Busca e paginação acontecem no banco, retornando apenas os resultados necessários.

---

## Estrutura do Banco de Dados

### 10.1 Tabela Transaction

```sql
CREATE TABLE "Transaction" (
  "id" text NOT NULL PRIMARY KEY,
  "date" date NOT NULL, -- Mudança: agora é 'date' (não timestamp) para evitar bugs de timezone
  "type" text NOT NULL, -- "expense", "income", ou "transfer"
  "amount" text NOT NULL, -- Criptografado
  "amount_numeric" numeric(15,2), -- NOVO: Valor numérico não criptografado para relatórios
  "accountId" text NOT NULL,
  "categoryId" text,
  "subcategoryId" text,
  "description" text, -- Criptografado
  "description_search" text, -- NOVO: Descrição normalizada para busca rápida
  "tags" text DEFAULT '' NOT NULL,
  "transferToId" text, -- ID da transação de entrada (se transfer)
  "transferFromId" text, -- ID da transação de saída (se transfer)
  "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  "recurring" boolean DEFAULT false NOT NULL,
  "userId" uuid NOT NULL,
  "suggestedCategoryId" text, -- Sugestão de categoria (IA)
  "suggestedSubcategoryId" text, -- Sugestão de subcategoria (IA)
  "plaidMetadata" jsonb, -- Metadados de integração Plaid
  "expenseType" text -- "fixed" ou "variable" (apenas expenses)
);
```

**Campos novos**:
- `amount_numeric`: Valor numérico não criptografado para operações SQL (SUM, AVG, ORDER BY) sem descriptografar
- `description_search`: Descrição normalizada (lowercase, sem caracteres especiais) para busca rápida com ILIKE

**Mudança importante**:
- `date`: Alterado de `timestamp(3) without time zone` para `date` para evitar problemas de timezone e simplificar comparações

### 10.2 Foreign Keys

- `accountId` → `Account.id`
- `categoryId` → `Category.id`
- `subcategoryId` → `Subcategory.id`
- `userId` → `User.id`
- `suggestedCategoryId` → `Category.id`
- `suggestedSubcategoryId` → `Subcategory.id`

### 10.3 Índices

Principais índices para performance:

- `Transaction_userId_date_desc_idx`: Busca por usuário e data
- `Transaction_accountId_idx`: Busca por conta
- `Transaction_categoryId_date_idx`: Busca por categoria e data
- `Transaction_date_desc_idx`: Ordenação por data
- `Transaction_type_idx`: Filtro por tipo
- `Transaction_recurring_idx`: Filtro por recorrente
- `Transaction_amount_numeric_idx`: Índice em amount_numeric para relatórios (SUM, AVG, ORDER BY)
- `transaction_description_search_trgm_idx`: Índice GIN com pg_trgm em description_search para busca fuzzy (ILIKE)

### 10.4 Tabela user_monthly_usage

Tabela agregada para verificação rápida de limites de transações:

```sql
CREATE TABLE "user_monthly_usage" (
  "user_id" uuid NOT NULL,
  "month_date" date NOT NULL, -- Primeiro dia do mês (ex: 2025-11-01)
  "transactions_count" integer NOT NULL DEFAULT 0,
  CONSTRAINT "user_monthly_usage_pkey" PRIMARY KEY ("user_id", "month_date"),
  CONSTRAINT "user_monthly_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE
);
```

**Propósito**: Elimina queries `COUNT(*)` lentas. Lookup direto por `user_id` + `month_date`.

**Nota**: Transferências contam como 1 (não 2) para limites mensais.

### 10.5 Tabela category_learning

Tabela agregada para sugestões rápidas de categorias:

```sql
CREATE TABLE "category_learning" (
  "user_id" uuid NOT NULL,
  "normalized_description" text NOT NULL,
  "type" text NOT NULL,
  "category_id" text NOT NULL,
  "subcategory_id" text,
  "description_and_amount_count" integer NOT NULL DEFAULT 0,
  "description_only_count" integer NOT NULL DEFAULT 0,
  "last_used_at" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "category_learning_pkey" PRIMARY KEY ("user_id", "normalized_description", "type")
);
```

**Propósito**: Elimina necessidade de escanear 12 meses de transações para sugestões. Consulta direta em tabela pequena.

### 10.6 View vw_transactions_for_reports

View que exclui transferências para relatórios:

```sql
CREATE VIEW "vw_transactions_for_reports" AS
SELECT *
FROM "Transaction"
WHERE "transferFromId" IS NULL
  AND "transferToId" IS NULL
  AND "type" IN ('expense', 'income');
```

**Propósito**: Previne que transferências inflam totais de income/expense em relatórios. Use esta view para cálculos de receitas e despesas.

### 10.7 Funções SQL

Funções SQL para criação atômica de transações:

#### 10.7.1 increment_transaction_count

Incrementa contador de transações mensais atomicamente:

```sql
CREATE FUNCTION "increment_transaction_count"(
  p_user_id uuid,
  p_month_date date
) RETURNS integer
```

#### 10.7.2 create_transaction_with_limit

Cria transação regular com verificação de limite atômica:

```sql
CREATE FUNCTION "create_transaction_with_limit"(
  p_id text,
  p_date date,
  p_type text,
  p_amount text,
  p_amount_numeric numeric(15,2),
  -- ... outros parâmetros
  p_max_transactions integer DEFAULT -1
) RETURNS jsonb
```

**Características**:
- Verifica limite antes de criar
- Incrementa contador atomicamente
- Cria transação com todos os campos
- Tudo em uma única transação SQL

#### 10.7.3 create_transfer_with_limit

Cria transferência (2 transações) com verificação de limite atômica:

```sql
CREATE FUNCTION "create_transfer_with_limit"(
  p_user_id uuid,
  p_from_account_id text,
  p_to_account_id text,
  -- ... outros parâmetros
  p_max_transactions integer DEFAULT -1
) RETURNS jsonb
```

**Características**:
- Verifica limite antes de criar
- Incrementa contador **uma vez** (transfer = 1 ação)
- Cria ambas as transações atomicamente
- Tudo em uma única transação SQL

### 10.8 Row Level Security (RLS)

Políticas RLS garantem que usuários só acessem suas próprias transações:

#### 10.8.1 Tabela Transaction

```sql
-- Usuários podem ver apenas suas transações
CREATE POLICY "Users can view own transactions" 
ON "Transaction" FOR SELECT 
USING ("userId" = auth.uid());

-- Usuários podem inserir apenas suas transações
CREATE POLICY "Users can insert own transactions" 
ON "Transaction" FOR INSERT 
WITH CHECK ("userId" = auth.uid());

-- Usuários podem atualizar apenas suas transações
CREATE POLICY "Users can update own transactions" 
ON "Transaction" FOR UPDATE 
USING ("userId" = auth.uid());

-- Usuários podem deletar apenas suas transações
CREATE POLICY "Users can delete own transactions" 
ON "Transaction" FOR DELETE 
USING ("userId" = auth.uid());
```

#### 10.8.2 Tabela user_monthly_usage

```sql
-- Usuários podem ver apenas seu próprio uso mensal
CREATE POLICY "Users can view own monthly usage"
ON "user_monthly_usage" FOR SELECT
USING ("user_id" = auth.uid());
```

**Nota**: Apenas SELECT é permitido. INSERT/UPDATE são feitos pelas funções SQL `SECURITY DEFINER` que garantem atomicidade.

#### 10.8.3 Tabela category_learning

```sql
-- Usuários podem ver apenas seu próprio aprendizado
CREATE POLICY "Users can view own category learning"
ON "category_learning" FOR SELECT
USING ("user_id" = auth.uid());

-- Usuários podem inserir seu próprio aprendizado
CREATE POLICY "Users can insert own category learning"
ON "category_learning" FOR INSERT
WITH CHECK ("user_id" = auth.uid());

-- Usuários podem atualizar seu próprio aprendizado
CREATE POLICY "Users can update own category learning"
ON "category_learning" FOR UPDATE
USING ("user_id" = auth.uid());
```

**Resumo**: Todas as tabelas relacionadas a transações (`Transaction`, `user_monthly_usage`, `category_learning`) têm RLS aplicado com políticas baseadas em `user_id = auth.uid()`, garantindo isolamento completo de dados entre usuários.

---

## Tratamento de Erros

### 11.1 Erros no Frontend

```typescript
try {
  const res = await fetch(url, { method, body: JSON.stringify(payload) });
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to save transaction");
  }
  
  // Sucesso
  toast({ title: "Transaction created", variant: "success" });
} catch (error) {
  toast({
    title: "Error",
    description: error instanceof Error ? error.message : "Failed to save transaction",
    variant: "destructive",
  });
}
```

### 11.2 Erros no Backend

#### 11.2.1 Erros de Validação (Zod)

```typescript
if (error instanceof ZodError) {
  return NextResponse.json(
    { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
    { status: 400 }
  );
}
```

#### 11.2.2 Erros de Autenticação

```typescript
if (authError || !user) {
  throw new Error("Unauthorized");
}
// Retorna 401
```

#### 11.2.3 Erros de Limite

```typescript
const limitGuard = await guardTransactionLimit(userId, data.date);
if (!limitGuard.allowed) {
  throw new Error(limitGuard.error?.message || "Transaction limit reached");
}
// Retorna 400 com mensagem específica
```

#### 11.2.4 Erros do Banco de Dados

```typescript
if (error) {
  logger.error("Supabase error creating transaction:", {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
  throw new Error(`Failed to create transaction: ${error.message}`);
}
```

### 11.3 Códigos de Status HTTP

- **201 Created**: Transação criada com sucesso
- **400 Bad Request**: Erro de validação ou limite excedido
- **401 Unauthorized**: Usuário não autenticado
- **403 Forbidden**: Acesso negado (não usado atualmente)
- **500 Internal Server Error**: Erro interno do servidor

---

## Fluxograma Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    USUÁRIO ABRE FORMULÁRIO                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          Verifica se há contas cadastradas                   │
│          Se não: mostra AccountRequiredDialog                │
│          Se sim: carrega dados (contas, categorias, limite)│
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              USUÁRIO PREENCHE E SUBMETE FORMULÁRIO           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Validação Frontend (Zod)                             │
│         - Campos obrigatórios                                │
│         - Tipos corretos                                     │
│         - Regras de negócio (transfer, expenseType)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Verificação de Limite (Frontend)                     │
│         - Mostra aviso se próximo do limite                 │
│         - Bloqueia se excedido                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         POST /api/transactions                               │
│         - Converte data para Date                           │
│         - Valida com Zod novamente                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         createTransaction() (Server Action)                   │
│         1. Verifica autenticação                             │
│         2. Verifica limite de plano (backend)                │
│         3. Formata data                                      │
│         4. Sugere categoria (se aplicável)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
         ┌─────────────────┴─────────────────┐
         │                                     │
         ▼                                     ▼
┌──────────────────────┐          ┌──────────────────────┐
│   É TRANSFERÊNCIA?    │          │  TRANSAÇÃO REGULAR    │
│                       │          │                       │
│  Cria 2 transações:   │          │  Cria 1 transação:    │
│  - Outgoing (expense) │          │  - Expense ou Income  │
│  - Incoming (income)   │          │  - Vincula categoria │
│  - Vinculadas por IDs  │          │  - Salva sugestão (se houver)│
└──────────────────────┘          └──────────────────────┘
         │                                     │
         └─────────────────┬─────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Criptografa dados sensíveis                          │
│         - description → encryptDescription()                 │
│         - amount → encryptAmount()                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Chama Função SQL de Criação                         │
│         - create_transaction_with_limit (transação regular) │
│         - create_transfer_with_limit (transferência)        │
│         - Ambas fazem: verificação de limite + incremento + │
│           insert atômico em uma única transação SQL         │
│         - RLS garante isolamento                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Salva Sugestão de Categoria (se houver)              │
│         - suggestedCategoryId                                 │
│         - suggestedSubcategoryId                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Invalida Cache                                       │
│         - invalidateTransactionCaches()                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Retorna Transação Criada                             │
│         - Frontend recebe resposta                          │
│         - Exibe toast de sucesso                            │
│         - Atualiza lista de transações                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Considerações Importantes

### 12.1 Performance

- **Cache**: Transações são cacheadas por 10 segundos (sem busca)
- **Índices**: Múltiplos índices otimizam consultas, incluindo GIN para busca fuzzy
- **Batch Decryption**: Descriptografia em lote para melhor performance
- **Pagination**: Suporte a paginação para grandes volumes
- **Limites Agregados**: Tabela `user_monthly_usage` elimina queries `COUNT(*)` lentas
- **Sugestões Otimizadas**: Tabela `category_learning` elimina scan de 12 meses de transações
- **Campos Auxiliares**: `amount_numeric` permite SUM/AVG sem descriptografar; `description_search` permite busca rápida
- **Busca no Banco**: Busca de descrições agora usa `description_search` com ILIKE no banco, não em memória

### 12.2 Segurança

- **Criptografia**: Dados sensíveis (descrição, valor) são criptografados
- **Campos Auxiliares**: `amount_numeric` e `description_search` são não criptografados, mas não expõem dados sensíveis completos
- **RLS**: Row Level Security garante isolamento de dados (aplicado também em `user_monthly_usage` e `category_learning`)
- **Validação**: Validação em múltiplas camadas (frontend, API, banco)
- **Autenticação**: Verificação de autenticação em todas as operações
- **Atomicidade**: Funções SQL garantem que limite e criação de transação acontecem atomicamente

### 12.3 Escalabilidade

- **UUIDs**: IDs únicos gerados com `crypto.randomUUID()`
- **Timestamps**: Campos `createdAt` e `updatedAt` para auditoria
- **Normalização**: Dados normalizados com foreign keys
- **Views**: View `vw_transactions_for_reports` para relatórios (possibilidade de usar materialized views para relatórios mais pesados no futuro)

### 12.4 Manutenibilidade

- **TypeScript**: Tipagem forte em todo o código
- **Zod Schemas**: Validação declarativa e reutilizável
- **Logging**: Logs estruturados para debugging
- **Error Handling**: Tratamento consistente de erros

---

## Melhorias Implementadas (2025-01-20)

### 13.1 Campos Auxiliares para Performance

- **`amount_numeric`**: Valor numérico não criptografado para operações SQL (SUM, AVG, ORDER BY) sem necessidade de descriptografar
- **`description_search`**: Descrição normalizada para busca rápida com ILIKE no banco de dados

### 13.2 Sistema de Limites Agregados

- **Tabela `user_monthly_usage`**: Armazena contagens mensais agregadas, eliminando queries `COUNT(*)` lentas
- **Funções SQL atômicas**: Verificação de limite e criação de transação acontecem em uma única transação SQL
- **Transferências contam como 1**: Sistema garante que transferências (2 transações) contam como 1 no limite mensal

### 13.3 Otimização de Sugestões de Categorias

- **Tabela `category_learning`**: Armazena dados agregados de aprendizado, eliminando scan de 12 meses de transações
- **Atualização incremental**: Tabela é atualizada quando usuário confirma categoria
- **Função centralizada**: `normalizeDescription()` garante consistência em toda a aplicação

### 13.4 Correção de Timezone

- **Tipo `date`**: Campo `date` mudou de `timestamp` para `date` para evitar bugs de timezone
- **Formatação simplificada**: `formatDateOnly()` agora retorna `YYYY-MM-DD` (não mais `YYYY-MM-DD 00:00:00`)

### 13.5 View para Relatórios

- **`vw_transactions_for_reports`**: View que exclui transferências para cálculos corretos de income/expense
- **Previne inflação**: Transferências não inflam mais totais de receitas e despesas

### 13.6 Atomicidade de Transferências

- **Função SQL `create_transfer_with_limit`**: Cria ambas as transações de transferência atomicamente
- **Rollback automático**: Se qualquer operação falhar, tudo é revertido
- **Limite correto**: Transferência incrementa contador apenas uma vez

---

## Conclusão

O fluxo de cadastro de transações é um sistema robusto e otimizado que envolve:

1. **Frontend**: Interface reativa com validação em tempo real
2. **API**: Endpoint RESTful com validação e tratamento de erros
3. **Backend**: Server actions com lógica de negócio complexa
4. **Banco de Dados**: PostgreSQL com RLS, criptografia e estruturas otimizadas
5. **Segurança**: Múltiplas camadas de proteção
6. **Inteligência**: Sugestão automática de categorias baseada em histórico (otimizada)
7. **Performance**: Campos auxiliares, tabelas agregadas e funções SQL atômicas

Este sistema garante que as transações sejam criadas de forma segura, validada e eficiente, com suporte a recursos avançados como transferências, sugestão de categorias e limites de plano, com performance otimizada mesmo em grandes volumes de dados.


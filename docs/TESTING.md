# Guia de Testes

Este documento explica como executar os testes unitários para validar os cenários de subscription.

---

## 📦 Instalação

Primeiro, instale as dependências de teste:

```bash
npm install
```

Isso instalará:
- `jest` - Framework de testes
- `@types/jest` - Tipos TypeScript para Jest
- `jest-environment-node` - Ambiente Node.js para Jest
- `dotenv` - Carregamento de variáveis de ambiente

---

## 🚀 Executando os Testes

### Executar todos os testes

```bash
npm test
```

### Executar apenas testes de subscription

```bash
npm run test:subscription
```

### Executar testes em modo watch (re-executa ao salvar arquivos)

```bash
npm run test:watch
```

### Executar um arquivo de teste específico

```bash
npm test -- tests/subscription-scenarios.test.ts
```

---

## 📋 Testes Disponíveis

### 1. `tests/subscription-scenarios.test.ts`

Testes de integração que validam cada cenário de subscription usando os usuários de teste reais:

- ✅ Autenticação de cada usuário de teste
- ✅ Verificação de status de subscription
- ✅ Verificação de plano (basic/premium)
- ✅ Validação de trial (ativo/expirado)
- ✅ Verificação de permissões de escrita
- ✅ Validação de `cancelAtPeriodEnd`

**Requisitos:**
- Usuários de teste devem estar criados (execute `npm run test:create-users` primeiro)
- Variáveis de ambiente configuradas (`.env.local`)

### 2. `tests/subscription-helpers.test.ts`

Testes unitários para funções auxiliares que não requerem conexão com banco:

- ✅ `isTrialValid()` - Validação de trial
- ✅ `canWrite()` - Verificação de permissões de escrita
- ✅ `shouldShowUpgradeBanner()` - Lógica de exibição de banner

**Requisitos:**
- Nenhum (testes puros, sem dependências externas)

---

## 🧪 Cenários Testados

Os testes validam todos os 10 cenários documentados em `SUBSCRIPTION_SCENARIOS.md`:

1. ✅ **INÍCIO DE TRIAL** - Trial recém criado
2. ✅ **TRIAL ATIVO** - Trial em andamento
3. ✅ **EXPIRAÇÃO DO TRIAL** - Trial expirado
4. ✅ **ASSINATURA PAGA** - Subscription ativa paga
5. ✅ **RENOVAÇÃO AUTOMÁTICA** - Subscription próxima da renovação
6. ✅ **FALHA NO PAGAMENTO** - Status `past_due`
7. ✅ **CANCELAMENTO NO FINAL DO PERÍODO** - `cancelAtPeriodEnd: true`
8. ✅ **CANCELAMENTO IMEDIATO** - Status `cancelled`
9. ✅ **TROCA DE PLANO** - Subscription ativa
10. ✅ **SEM SUBSCRIPTION** - Usuário sem subscription

---

## 🔍 O que os Testes Verificam

Para cada usuário de teste, os testes verificam:

1. **Autenticação**
   - ✅ Login bem-sucedido
   - ✅ Obtenção de userId

2. **Status da Subscription**
   - ✅ Status correto (`active`, `trialing`, `cancelled`, `past_due`)
   - ✅ Plano correto (`basic`, `premium`)

3. **Trial**
   - ✅ Datas de trial presentes (quando aplicável)
   - ✅ Trial válido ou expirado conforme esperado

4. **Permissões de Escrita**
   - ✅ Permissão de escrita conforme status
   - ✅ Bloqueio de escrita quando trial expirado
   - ✅ Bloqueio de escrita quando `cancelled` ou `past_due`

5. **Configurações Especiais**
   - ✅ `cancelAtPeriodEnd` quando aplicável

---

## 🐛 Troubleshooting

### Erro: "Missing Supabase environment variables"

**Solução:** Certifique-se de que o arquivo `.env.local` existe e contém:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Erro: "Failed to sign in as [email]"

**Solução:** Execute o script de criação de usuários de teste:
```bash
npm run test:create-users
```

### Erro: "Cannot find module '@/...'"

**Solução:** Verifique se `jest.config.js` está configurado corretamente com o `moduleNameMapper`.

### Testes falhando por timeout

**Solução:** Aumente o timeout no `jest.config.js`:
```javascript
testTimeout: 30000, // 30 segundos
```

---

## 📊 Cobertura de Testes

Os testes cobrem:

- ✅ **Lógica de negócio** - Funções auxiliares de subscription
- ✅ **Validação de trial** - Verificação de datas e status
- ✅ **Permissões de acesso** - Escrita/leitura baseada em status
- ✅ **Integração com banco** - Consultas reais ao Supabase
- ✅ **Autenticação** - Login com usuários de teste

---

## 🔄 Atualizando os Testes

Quando adicionar novos cenários ou modificar a lógica:

1. **Atualize os usuários de teste** em `scripts/create-test-users.ts`
2. **Atualize os testes** em `tests/subscription-scenarios.test.ts`
3. **Execute os testes** para validar:
   ```bash
   npm run test:create-users
   npm run test:subscription
   ```

---

## 📝 Exemplo de Saída

```
PASS  tests/subscription-scenarios.test.ts
  Subscription Scenarios Tests
    Test User Authentication and Subscription Status
      ✓ 1. INÍCIO DE TRIAL
        ✓ should authenticate successfully
        ✓ should have correct subscription status: trialing
        ✓ should have correct plan: basic
        ✓ should have trial dates
        ✓ should have valid trial
        ✓ should allow write operations
      ✓ 2. TRIAL ATIVO
        ...
      ✓ 3. EXPIRAÇÃO DO TRIAL
        ...
```

---

**Última atualização:** Janeiro 2025


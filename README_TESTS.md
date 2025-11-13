# 🧪 Testes Unitários de Subscription

Sistema completo de testes para validar todos os cenários de subscription usando os usuários de teste.

## 🚀 Quick Start

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Crie os usuários de teste:**
   ```bash
   npm run test:create-users
   ```

3. **Execute os testes:**
   ```bash
   npm test
   ```

## 📁 Arquivos Criados

- `jest.config.js` - Configuração do Jest
- `jest.setup.js` - Setup dos testes (mocks, env vars)
- `tests/subscription-scenarios.test.ts` - Testes de integração com usuários reais
- `tests/subscription-helpers.test.ts` - Testes unitários de funções auxiliares
- `docs/TESTING.md` - Documentação completa dos testes

## ✅ O que é testado

- ✅ Autenticação de cada usuário de teste
- ✅ Status de subscription correto
- ✅ Validação de trial (ativo/expirado)
- ✅ Permissões de escrita baseadas em status
- ✅ Lógica de exibição de banners
- ✅ Todos os 10 cenários documentados

## 📊 Comandos Disponíveis

```bash
npm test                    # Executa todos os testes
npm run test:watch          # Modo watch (re-executa ao salvar)
npm run test:subscription   # Apenas testes de subscription
npm run test:create-users   # Cria usuários de teste
```

## 🔍 Exemplo de Saída

```
PASS  tests/subscription-scenarios.test.ts
  Subscription Scenarios Tests
    ✓ 1. INÍCIO DE TRIAL
    ✓ 2. TRIAL ATIVO
    ✓ 3. EXPIRAÇÃO DO TRIAL
    ...
```

Para mais detalhes, veja `docs/TESTING.md`.


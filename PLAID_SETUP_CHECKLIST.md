# Checklist de Configuração do Plaid

Este documento lista tudo que é necessário para fazer uma conexão com Plaid funcionar completamente.

## ✅ O que já está implementado

- [x] Endpoint `/api/v2/plaid/link/create-link-token` - Cria link token
- [x] Endpoint `/api/v2/plaid/link/exchange-public-token` - Troca public token por access token
- [x] Componente `PlaidLinkWrapper` - Wrapper React para Plaid Link
- [x] Componente `ReconnectBankButton` - Botão de reconexão
- [x] Componente `AddAccountSheet` - Sheet com opção de conectar via Plaid
- [x] Serviço `PlaidService` - Lógica de negócio completa
- [x] Repositório `PlaidItemsRepository` - Acesso ao banco de dados
- [x] Webhook handler `/api/v2/plaid/webhook` - Processa webhooks do Plaid
- [x] Dashboard de conexões - Visualização de status

## 🔧 O que precisa ser configurado

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis no seu `.env` ou no painel do Vercel:

```bash
# Plaid Credentials (obtenha em https://dashboard.plaid.com/)
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_secret_here

# Plaid Environment (sandbox, development, ou production)
PLAID_ENV=sandbox  # ou 'development' ou 'production'

# Webhook Secret (obtenha em https://dashboard.plaid.com/team/webhooks)
PLAID_WEBHOOK_SECRET=your_webhook_secret_here

# Feature Flag (opcional, default: true)
PLAID_ENABLED=true
```

**Como obter as credenciais:**
1. Acesse https://dashboard.plaid.com/
2. Faça login na sua conta Plaid
3. Vá em **Team Settings** > **Keys**
4. Copie o `Client ID` e `Secret` para o ambiente desejado (Sandbox/Development/Production)

### 2. Configurar Webhook URL no Plaid Dashboard

1. Acesse https://dashboard.plaid.com/
2. Vá em **Team Settings** > **Webhooks**
3. Adicione a URL do seu webhook:
   - **Sandbox/Development**: `https://your-domain.vercel.app/api/v2/plaid/webhook`
   - **Production**: `https://your-production-domain.com/api/v2/plaid/webhook`
4. Copie o `Webhook Secret` e adicione como `PLAID_WEBHOOK_SECRET` nas variáveis de ambiente

### 3. Verificar Tabelas no Banco de Dados

Certifique-se de que as seguintes tabelas existem no Supabase:

- `plaid_items` - Armazena itens do Plaid
- `account_integrations` - Liga contas ao Plaid
- `webhook_events` - Armazena eventos de webhook processados

**Verificar se as migrations foram aplicadas:**
```sql
-- Verificar se as tabelas existem
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('plaid_items', 'account_integrations', 'webhook_events');
```

### 4. Testar a Conexão

#### Passo 1: Verificar se o Plaid está habilitado
```bash
# No terminal, verifique se as variáveis estão setadas
echo $PLAID_CLIENT_ID
echo $PLAID_SECRET
echo $PLAID_ENV
```

#### Passo 2: Testar criação de link token
```bash
# Faça uma requisição POST para criar um link token
curl -X POST http://localhost:3000/api/v2/plaid/link/create-link-token \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie"
```

#### Passo 3: Testar no navegador
1. Acesse a página de Accounts: `/accounts`
2. Clique em "Add Account"
3. Clique em "Connect Bank Account"
4. O Plaid Link deve abrir em um modal
5. Use credenciais de teste do Plaid (veja abaixo)

### 5. Credenciais de Teste (Sandbox)

Para testar no ambiente **Sandbox**, use estas credenciais:

**Bancos de teste comuns:**
- **First Platypus Bank**: `user_good` / `pass_good`
- **First Gingham Credit Union**: `user_good` / `pass_good`
- **Tartan Bank**: `user_good` / `pass_good`

**Ver mais bancos de teste:**
- Acesse https://dashboard.plaid.com/team/test-accounts
- Ou veja a documentação: https://plaid.com/docs/sandbox/

### 6. Verificar Logs

Após tentar uma conexão, verifique os logs:

```bash
# No Vercel
vercel logs

# Ou no console do navegador
# Abra DevTools > Console
```

Procure por:
- `[PlaidClient]` - Logs do cliente Plaid
- `[PlaidService]` - Logs do serviço
- `[Plaid API]` - Logs das rotas da API

### 7. Troubleshooting Comum

#### Erro: "PLAID_CLIENT_ID and PLAID_SECRET must be set"
- **Solução**: Configure as variáveis de ambiente no Vercel ou `.env.local`

#### Erro: "Failed to create link token"
- **Solução**: Verifique se as credenciais estão corretas e se o ambiente está correto

#### Plaid Link não abre
- **Solução**: Verifique se o `linkToken` está sendo retornado corretamente
- Verifique o console do navegador para erros JavaScript

#### Webhook não funciona
- **Solução**: 
  1. Verifique se a URL do webhook está correta no Plaid Dashboard
  2. Verifique se `PLAID_WEBHOOK_SECRET` está configurado
  3. Teste o webhook manualmente usando o Plaid CLI ou Postman

#### Contas não aparecem após conexão
- **Solução**: 
  1. Verifique se o `exchangePublicToken` foi chamado com sucesso
  2. Verifique os logs do servidor
  3. Verifique se as contas foram criadas no banco de dados

## 📋 Checklist Final

Antes de considerar a integração completa, verifique:

- [ ] Variáveis de ambiente configuradas (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_WEBHOOK_SECRET`)
- [ ] Webhook URL configurada no Plaid Dashboard
- [ ] Tabelas do banco de dados criadas (`plaid_items`, `account_integrations`, `webhook_events`)
- [ ] Teste de criação de link token funcionando
- [ ] Plaid Link abre corretamente no navegador
- [ ] Conexão com banco de teste funciona
- [ ] Contas são criadas após conexão
- [ ] Webhook recebe e processa eventos
- [ ] Sync de transações funciona
- [ ] Dashboard de conexões mostra status correto

## 🚀 Próximos Passos Após Configuração

1. **Testar com bancos reais** (após aprovação do Plaid)
2. **Configurar notificações** para erros de conexão
3. **Monitorar logs** para identificar problemas
4. **Configurar retry automático** (já implementado via cron job)

## 📚 Documentação Adicional

- [Plaid Dashboard](https://dashboard.plaid.com/)
- [Plaid Docs](https://plaid.com/docs/)
- [Plaid Link Docs](https://plaid.com/docs/link/)
- [Plaid Webhooks](https://plaid.com/docs/webhooks/)

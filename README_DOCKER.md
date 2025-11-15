# 🐳 Setup Rápido - Banco de Dados Local

Guia rápido para configurar o banco de dados local com Docker.

## ⚡ Início Rápido

```bash
# 1. Criar .env.local (copie as variáveis abaixo)
cp .env.local.example .env.local

# 2. Iniciar containers
npm run db:start

# 3. Aplicar migrações
npm run db:migrate

# 4. (Opcional) Popular dados de teste
npm run db:seed
```

## 📝 Variáveis de Ambiente (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54324
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

## 🎯 Comandos Úteis

```bash
npm run db:start      # Iniciar containers
npm run db:stop       # Parar containers
npm run db:restart    # Reiniciar containers
npm run db:status     # Ver status
npm run db:logs       # Ver logs
npm run db:migrate    # Aplicar migrações
npm run db:reset      # Resetar tudo (remove dados)
```

## 🌐 Acessos

- **Supabase Studio**: http://localhost:54323
- **API Gateway**: http://localhost:54324
- **PostgreSQL**: localhost:54322

## 📚 Documentação Completa

Veja `docs/SETUP_LOCAL_DB.md` para guia detalhado.


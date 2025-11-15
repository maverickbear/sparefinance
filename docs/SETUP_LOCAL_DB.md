# Configuração do Banco de Dados Local com Docker

Este guia explica como configurar e usar o banco de dados Supabase localmente usando Docker para desenvolvimento e testes.

---

## 📋 Pré-requisitos

- Docker Desktop instalado e rodando
- Docker Compose (vem com Docker Desktop)
- Node.js e npm instalados

---

## 🚀 Configuração Inicial

### 1. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com o seguinte conteúdo:

```env
# Supabase Local URLs (Docker)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54324
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Database Connection (Direct PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Supabase Studio
SUPABASE_STUDIO_URL=http://localhost:54323
```

**Nota**: As chaves acima são para desenvolvimento local apenas. Nunca use em produção!

### 2. Iniciar os Serviços

Execute o script de setup:

```bash
npm run db:setup
```

Ou manualmente:

```bash
docker compose up -d
```

---

## 🎯 Comandos Disponíveis

### Gerenciamento de Containers

```bash
# Iniciar serviços
npm run db:start

# Parar serviços
npm run db:stop

# Reiniciar serviços
npm run db:restart

# Ver logs
npm run db:logs

# Ver status dos containers
npm run db:status

# Resetar banco (remove volumes)
npm run db:reset
```

### Migrações

```bash
# Aplicar todas as migrações
npm run db:migrate
```

As migrações são aplicadas automaticamente na ordem alfabética dos arquivos em `supabase/migrations/`.

### Seed (Dados Iniciais)

```bash
# Popular banco com dados de teste
npm run db:seed
```

---

## 🌐 Serviços Disponíveis

Após iniciar os containers, os seguintes serviços estarão disponíveis:

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **Supabase Studio** | http://localhost:54323 | Interface web para gerenciar o banco |
| **API Gateway** | http://localhost:54324 | Endpoint principal da API |
| **PostgreSQL** | localhost:54322 | Conexão direta ao banco |
| **PostgREST** | http://localhost:54326 | API REST automática |
| **GoTrue Auth** | http://localhost:54327 | Serviço de autenticação |
| **Realtime** | http://localhost:54328 | WebSockets para tempo real |
| **Storage** | http://localhost:54329 | Armazenamento de arquivos |

---

## 📝 Aplicando Migrações

### Automático (Recomendado)

```bash
npm run db:migrate
```

O script `scripts/migrate-local-db.ts`:
- Conecta ao banco local
- Verifica quais migrações já foram aplicadas
- Aplica apenas as novas migrações
- Mantém histórico na tabela `schema_migrations`

### Manual (via Supabase Studio)

1. Acesse http://localhost:54323
2. Vá em "SQL Editor"
3. Cole o conteúdo do arquivo de migração
4. Execute

### Manual (via psql)

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/migrations/20241201000000_fix_database_issues.sql
```

---

## 🧪 Testando as Correções

Após aplicar as migrações, valide as correções:

```bash
# Via script TypeScript
tsx scripts/validate-database-integrity.ts

# Ou via SQL (no Supabase Studio)
# Execute: scripts/validate-database-integrity.sql
```

---

## 🔧 Estrutura de Arquivos

```
.
├── docker-compose.yml          # Configuração Docker
├── supabase/
│   ├── migrations/            # Migrações SQL
│   │   └── 20241201000000_fix_database_issues.sql
│   └── kong.yml               # Configuração API Gateway
├── scripts/
│   ├── setup-local-db.sh      # Script de setup
│   ├── migrate-local-db.ts    # Script de migração
│   └── validate-database-integrity.ts
└── .env.local                 # Variáveis de ambiente (não commitado)
```

---

## 🐛 Troubleshooting

### Containers não iniciam

```bash
# Ver logs
docker compose logs

# Verificar se portas estão disponíveis
lsof -i :54322
lsof -i :54323
```

### Erro de conexão

1. Verifique se os containers estão rodando: `npm run db:status`
2. Verifique as variáveis em `.env.local`
3. Aguarde alguns segundos após iniciar (serviços precisam inicializar)

### Resetar tudo

```bash
# Remove containers e volumes
npm run db:reset

# Depois reinicie
npm run db:start
npm run db:migrate
```

### Migrações não aplicam

1. Verifique a conexão: `psql postgresql://postgres:postgres@localhost:54322/postgres`
2. Verifique se o arquivo SQL está correto
3. Veja logs: `docker compose logs postgres`

---

## 📊 Verificando o Banco

### Via Supabase Studio

1. Acesse http://localhost:54323
2. Navegue pelas tabelas
3. Execute queries SQL
4. Veja estrutura do schema

### Via psql

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres

# Listar tabelas
\dt

# Ver estrutura de uma tabela
\d "InvestmentAccount"

# Executar query
SELECT COUNT(*) FROM "User";
```

---

## 🔐 Credenciais Padrão

**PostgreSQL:**
- Host: `localhost`
- Port: `54322`
- Database: `postgres`
- User: `postgres`
- Password: `postgres`

**Supabase:**
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
- Service Role Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU`

---

## 🎯 Próximos Passos

1. ✅ Configurar `.env.local`
2. ✅ Iniciar containers: `npm run db:start`
3. ✅ Aplicar migrações: `npm run db:migrate`
4. ✅ Validar correções: `tsx scripts/validate-database-integrity.ts`
5. ✅ (Opcional) Popular dados: `npm run db:seed`
6. ✅ Iniciar aplicação: `npm run dev`

---

## 📚 Recursos Adicionais

- [Documentação Supabase Local](https://supabase.com/docs/guides/cli/local-development)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

**Nota**: Este setup é apenas para desenvolvimento local. Para produção, use o Supabase Cloud ou sua própria infraestrutura.


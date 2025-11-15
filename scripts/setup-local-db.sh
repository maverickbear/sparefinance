#!/bin/bash

# Script para configurar banco de dados local com Docker
# Execute: bash scripts/setup-local-db.sh

set -e

echo "🚀 Configurando banco de dados local Spare Finance..."
echo ""

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando. Por favor, inicie o Docker primeiro."
    exit 1
fi

# Verificar se docker-compose está disponível
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ docker-compose não encontrado. Por favor, instale o Docker Compose."
    exit 1
fi

# Criar .env.local se não existir
if [ ! -f .env.local ]; then
    echo "📝 Criando .env.local a partir de .env.local.example..."
    cp .env.local.example .env.local
    echo "✅ .env.local criado. Por favor, revise as configurações se necessário."
else
    echo "✅ .env.local já existe."
fi

# Criar diretório de volumes se não existir
mkdir -p supabase/volumes

# Iniciar containers
echo ""
echo "🐳 Iniciando containers Docker..."
if docker compose version &> /dev/null; then
    docker compose up -d
else
    docker-compose up -d
fi

echo ""
echo "⏳ Aguardando serviços iniciarem..."
sleep 10

# Verificar se os serviços estão rodando
echo ""
echo "🔍 Verificando status dos serviços..."
if docker compose version &> /dev/null; then
    docker compose ps
else
    docker-compose ps
fi

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "📋 Serviços disponíveis:"
echo "   - Supabase Studio: http://localhost:54323"
echo "   - API Gateway: http://localhost:54324"
echo "   - PostgreSQL: localhost:54322"
echo ""
echo "📝 Próximos passos:"
echo "   1. Acesse o Supabase Studio em http://localhost:54323"
echo "   2. Execute as migrações: npm run db:migrate"
echo "   3. (Opcional) Execute seed: npm run db:seed"
echo ""
echo "🛑 Para parar os serviços: npm run db:stop"
echo "🔄 Para reiniciar: npm run db:restart"


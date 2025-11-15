#!/bin/bash

# Script para verificar qual ambiente está ativo

ENV_LOCAL=".env.local"
ENV_PRODUCTION=".env.production"

echo "=== Ambiente Atual ==="

if [ ! -f "$ENV_LOCAL" ]; then
    echo "⚠️  Nenhum arquivo .env.local encontrado"
    exit 1
fi

# Verificar qual URL está configurada
SUPABASE_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$ENV_LOCAL" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$SUPABASE_URL" ]; then
    echo "⚠️  NEXT_PUBLIC_SUPABASE_URL não encontrado em .env.local"
    exit 1
fi

# Determinar ambiente baseado na URL
if [[ "$SUPABASE_URL" == *"localhost"* ]] || [[ "$SUPABASE_URL" == *"127.0.0.1"* ]]; then
    ENV_TYPE="LOCAL"
    EMOJI="🏠"
else
    ENV_TYPE="PRODUÇÃO"
    EMOJI="🌐"
fi

echo "$EMOJI Ambiente: $ENV_TYPE"
echo "📁 Arquivo: .env.local"
echo "🔗 Supabase URL: $SUPABASE_URL"

# Verificar se há backup disponível
if [ -f ".env.local.backup" ]; then
    BACKUP_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" ".env.local.backup" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    if [[ "$BACKUP_URL" == *"localhost"* ]]; then
        echo ""
        echo "💾 Backup local disponível (pode restaurar com: npm run env:local)"
    fi
fi

echo ""


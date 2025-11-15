#!/bin/bash

# Script para alternar para ambiente local
# Este script restaura .env.local do backup

ENV_LOCAL=".env.local"
ENV_LOCAL_BACKUP=".env.local.backup"

echo "🔄 Alternando para ambiente LOCAL..."

# Restaurar .env.local do backup
if [ -f "$ENV_LOCAL_BACKUP" ]; then
    cp "$ENV_LOCAL_BACKUP" "$ENV_LOCAL"
    echo "✅ .env.local restaurado do backup"
    
    # Verificar configuração do Supabase
    SUPABASE_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$ENV_LOCAL" | cut -d '=' -f2-)
    if [[ "$SUPABASE_URL" == *"localhost"* ]]; then
        echo "✅ Supabase URL: $SUPABASE_URL (local)"
    else
        echo "⚠️  Aviso: Supabase URL não parece ser local: $SUPABASE_URL"
    fi
else
    echo "⚠️  Aviso: Backup .env.local.backup não encontrado."
    echo "   Você pode criar um novo .env.local ou usar o script organize-env-files.sh"
    echo ""
    echo "   Exemplo de .env.local para desenvolvimento:"
    echo "   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54324"
    echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    exit 1
fi

echo ""
echo "✅ Ambiente configurado para LOCAL"
echo "📁 Usando: .env.local (desenvolvimento)"
echo ""
echo "💡 Para usar produção, execute:"
echo "   npm run env:production"
echo ""


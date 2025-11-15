#!/bin/bash

# Script para alternar para ambiente de produção
# Este script copia as variáveis do .env.production para .env.local
# (necessário porque Next.js em dev mode não carrega .env.production)

ENV_LOCAL=".env.local"
ENV_PRODUCTION=".env.production"
ENV_LOCAL_BACKUP=".env.local.backup"

echo "🔄 Alternando para ambiente de PRODUÇÃO..."

# Verificar se .env.production existe
if [ ! -f "$ENV_PRODUCTION" ]; then
    echo "❌ Erro: Arquivo .env.production não encontrado!"
    exit 1
fi

# Fazer backup do .env.local atual se existir e não estiver já em backup
if [ -f "$ENV_LOCAL" ] && [ ! -f "$ENV_LOCAL_BACKUP" ]; then
    cp "$ENV_LOCAL" "$ENV_LOCAL_BACKUP"
    echo "✅ Backup criado: $ENV_LOCAL_BACKUP"
fi

# Copiar conteúdo do .env.production para .env.local
# (Next.js em dev mode só carrega .env.local, não .env.production)
cp "$ENV_PRODUCTION" "$ENV_LOCAL"
echo "✅ .env.local atualizado com variáveis de PRODUÇÃO"

# Verificar configuração do Supabase
SUPABASE_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$ENV_LOCAL" | cut -d '=' -f2-)
if [[ "$SUPABASE_URL" == *"localhost"* ]]; then
    echo "⚠️  AVISO: Configuração parece estar apontando para localhost!"
    echo "   Verifique se está usando a URL correta do Supabase remoto."
else
    echo "✅ Supabase URL: $SUPABASE_URL"
fi

echo ""
echo "✅ Ambiente configurado para PRODUÇÃO"
echo "📁 .env.local agora contém as variáveis de produção"
echo ""
echo "💡 Para voltar ao ambiente local, execute:"
echo "   npm run env:local"
echo ""


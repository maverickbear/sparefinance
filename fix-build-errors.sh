#!/bin/bash

# Script para corrigir erros de prerendering do Next.js 16
# Autor: Claude AI
# Data: 2024

set -e

echo "🚀 Iniciando correções de build do Next.js 16..."
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de correções
FIXED=0
NOT_FOUND=0

# Função para adicionar configuração dinâmica a um arquivo
fix_route_file() {
    local file=$1
    local config_type=$2
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Arquivo não encontrado: $file${NC}"
        ((NOT_FOUND++))
        return 1
    fi
    
    # Verifica se já tem a configuração
    if grep -q "export const dynamic" "$file"; then
        echo -e "${YELLOW}⚠️  Já configurado: $file${NC}"
        return 0
    fi
    
    # Cria backup
    cp "$file" "$file.backup"
    
    # Adiciona as configurações após os imports
    if [ "$config_type" == "api" ]; then
        # Para rotas de API
        awk '
        /^import/ { imports=1; print; next }
        imports && /^[^import]/ && !done { 
            print ""
            print "// Configuração para forçar renderização dinâmica"
            print "export const dynamic = '\''force-dynamic'\'';"
            print "export const runtime = '\''nodejs'\'';"
            print ""
            done=1
        }
        { print }
        ' "$file.backup" > "$file"
    else
        # Para páginas
        awk '
        /^import/ { imports=1; print; next }
        imports && /^[^import]/ && !done { 
            print ""
            print "// Configuração para forçar renderização dinâmica"
            print "export const dynamic = '\''force-dynamic'\'';"
            print ""
            done=1
        }
        { print }
        ' "$file.backup" > "$file"
    fi
    
    echo -e "${GREEN}✅ Corrigido: $file${NC}"
    ((FIXED++))
}

# Lista de rotas de API para corrigir
echo "📂 Corrigindo rotas de API..."
echo ""

API_ROUTES=(
    "app/api/dashboard/check-updates/route.ts"
    "app/api/v2/members/invite/validate/route.ts"
    "app/api/members/invite/validate/route.ts"
    "app/api/members/invite/check-pending/route.ts"
    "app/api/stripe/session/route.ts"
    "app/api/subscription-services/plans/route.ts"
    "app/api/billing/plans/public/route.ts"
    "app/api/billing/plans/route.ts"
    "app/api/health/route.ts"
    "app/api/subscription-services/route.ts"
)

for route in "${API_ROUTES[@]}"; do
    fix_route_file "$route" "api"
done

echo ""
echo "📄 Corrigindo páginas..."
echo ""

# Lista de páginas para corrigir
PAGES=(
    "app/(protected)/insights/page.tsx"
    "app/privacy-policy/page.tsx"
)

for page in "${PAGES[@]}"; do
    fix_route_file "$page" "page"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Resumo das Correções${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Arquivos corrigidos: ${GREEN}$FIXED${NC}"
echo -e "Arquivos não encontrados: ${RED}$NOT_FOUND${NC}"
echo ""

if [ $FIXED -gt 0 ]; then
    echo "📦 Backups criados com extensão .backup"
    echo ""
    echo "🧪 Próximos passos:"
    echo "   1. Revise as mudanças: git diff"
    echo "   2. Teste o build: npm run build"
    echo "   3. Se funcionar, remova os backups: find . -name '*.backup' -delete"
    echo "   4. Se não funcionar, restaure: find . -name '*.backup' -exec sh -c 'mv \"\$1\" \"\${1%.backup}\"' _ {} \;"
    echo ""
fi

if [ $NOT_FOUND -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Alguns arquivos não foram encontrados.${NC}"
    echo "   Verifique se você está executando o script no diretório raiz do projeto."
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
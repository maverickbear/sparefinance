#!/usr/bin/env tsx

/**
 * Script para verificar arquivos obsoletos que podem ser movidos para Deprecated
 * 
 * Uso:
 *   tsx scripts/check-obsolete-files.ts
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

interface ObsoleteFile {
  path: string;
  reason: string;
  status: 'safe-to-move' | 'in-use' | 'needs-migration';
  usages?: string[];
}

const workspaceRoot = process.cwd();
const violations: ObsoleteFile[] = [];
const checkedFiles: string[] = [];

// Lista de arquivos obsoletos para verificar
const obsoleteFiles: Array<{
  path: string;
  reason: string;
  v2Alternative?: string;
}> = [
  // Rotas API antigas
  // Legacy API routes still present (use v2 instead)
  { path: 'app/api/accounts/route.ts', reason: 'Tem versão v2', v2Alternative: '/api/v2/accounts' },
  { path: 'app/api/accounts/[id]/route.ts', reason: 'Tem versão v2', v2Alternative: '/api/v2/accounts/[id]' },
  { path: 'app/api/debts/route.ts', reason: 'Tem versão v2', v2Alternative: '/api/v2/debts' },
  { path: 'app/api/debts/[id]/route.ts', reason: 'Tem versão v2', v2Alternative: '/api/v2/debts/[id]' },
  { path: 'app/api/categories/route.ts', reason: 'Tem versão v2', v2Alternative: '/api/v2/categories' },
  { path: 'app/api/budgets/route.ts', reason: 'Tem versão v2', v2Alternative: '/api/v2/budgets' },
  { path: 'app/api/budgets/[id]/route.ts', reason: 'Tem versão v2', v2Alternative: '/api/v2/budgets/[id]' },
  { path: 'app/api/goals/route.ts', reason: 'Tem versão v2', v2Alternative: '/api/v2/goals' },
  { path: 'app/api/goals/[id]/route.ts', reason: 'Tem versão v2', v2Alternative: '/api/v2/goals/[id]' },
  { path: 'app/api/goals/income-basis/route.ts', reason: 'Tem versão v2', v2Alternative: '/api/v2/goals/income-basis' },
  // Already removed: app/api/transactions/*, app/api/user-subscriptions/route.ts, app/api/categories/[id]/route.ts
];

// Arquivos em lib/api que violam arquitetura
const libApiFiles: Array<{
  path: string;
  reason: string;
}> = [
  { path: 'lib/api/accounts.ts', reason: 'Deve usar Application Services' },
  { path: 'lib/api/debts.ts', reason: 'Deve usar Application Services' },
  { path: 'lib/api/transactions.ts', reason: 'Deve usar Application Services' },
  { path: 'lib/api/categories.ts', reason: 'Deve usar Application Services' },
];

function findUsages(filePath: string): string[] {
  const usages: string[] = [];
  const fileName = filePath.split('/').pop() || '';
  const baseName = fileName.replace('.ts', '').replace('.tsx', '');
  
  // Padrões de busca
  const patterns = [
    new RegExp(`from\\s+["']@/${filePath.replace(/\\/g, '/')}["']`, 'g'),
    new RegExp(`from\\s+["']\\.\\./.*${baseName}["']`, 'g'),
    new RegExp(`from\\s+["']\\./${baseName}["']`, 'g'),
    new RegExp(`import.*${baseName}`, 'g'),
  ];

  // Para rotas API, também buscar por URL
  if (filePath.includes('app/api/')) {
    const routePath = filePath
      .replace('app/api/', '/api/')
      .replace('/route.ts', '')
      .replace('[id]', ':id');
    patterns.push(new RegExp(`["']${routePath}["']`, 'g'));
    patterns.push(new RegExp(`fetch\\(["']${routePath}`, 'g'));
  }

  walkDir(workspaceRoot, (file: string) => {
    if (file === filePath || file.includes('Deprecated') || file.includes('node_modules') || file.includes('.next')) {
      return;
    }

    try {
      const content = readFileSync(file, 'utf-8');
      patterns.forEach(pattern => {
        if (pattern.test(content)) {
          const relativePath = relative(workspaceRoot, file);
          if (!usages.includes(relativePath)) {
            usages.push(relativePath);
          }
        }
      });
    } catch (error) {
      // Ignore errors
    }
  });

  return usages;
}

function walkDir(dir: string, callback: (file: string) => void): void {
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      const filePath = join(dir, file);
      const stat = statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules' && file !== '.next' && file !== 'Deprecated') {
          walkDir(filePath, callback);
        }
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
        callback(filePath);
      }
    }
  } catch (error) {
    // Ignore errors
  }
}

function checkFile(file: { path: string; reason: string; v2Alternative?: string }) {
  const fullPath = join(workspaceRoot, file.path);
  
  try {
    if (!statSync(fullPath).isFile()) {
      return; // File doesn't exist
    }
  } catch {
    return; // File doesn't exist
  }

  const usages = findUsages(file.path);
  
  let status: 'safe-to-move' | 'in-use' | 'needs-migration';
  if (usages.length === 0) {
    status = 'safe-to-move';
  } else if (file.path.includes('lib/api/')) {
    status = 'needs-migration';
  } else {
    status = 'in-use';
  }

  violations.push({
    path: file.path,
    reason: file.reason + (file.v2Alternative ? ` (v2: ${file.v2Alternative})` : ''),
    status,
    usages: usages.length > 0 ? usages : undefined,
  });
}

console.log('🔍 Verificando arquivos obsoletos...\n');

// Verificar rotas API antigas
console.log('📁 Verificando rotas API antigas...');
obsoleteFiles.forEach(file => checkFile(file));

// Verificar arquivos em lib/api
console.log('📦 Verificando arquivos em lib/api...');
libApiFiles.forEach(file => checkFile(file));

// Relatório
console.log('\n📊 RELATÓRIO DE ARQUIVOS OBSOLETOS\n');
console.log('=' .repeat(80));

const safeToMove = violations.filter(v => v.status === 'safe-to-move');
const inUse = violations.filter(v => v.status === 'in-use');
const needsMigration = violations.filter(v => v.status === 'needs-migration');

if (safeToMove.length > 0) {
  console.log(`\n✅ SEGUROS PARA MOVER (${safeToMove.length}):\n`);
  safeToMove.forEach(v => {
    console.log(`  • ${v.path}`);
    console.log(`    Motivo: ${v.reason}`);
    console.log('');
  });
}

if (inUse.length > 0) {
  console.log(`\n⚠️  AINDA EM USO (${inUse.length}):\n`);
  inUse.forEach(v => {
    console.log(`  • ${v.path}`);
    console.log(`    Motivo: ${v.reason}`);
    if (v.usages && v.usages.length > 0) {
      console.log(`    Usado em (${v.usages.length} arquivo(s)):`);
      v.usages.slice(0, 5).forEach(usage => {
        console.log(`      - ${usage}`);
      });
      if (v.usages.length > 5) {
        console.log(`      ... e mais ${v.usages.length - 5} arquivo(s)`);
      }
    }
    console.log('');
  });
}

if (needsMigration.length > 0) {
  console.log(`\n🔄 PRECISAM MIGRAÇÃO (${needsMigration.length}):\n`);
  needsMigration.forEach(v => {
    console.log(`  • ${v.path}`);
    console.log(`    Motivo: ${v.reason}`);
    if (v.usages && v.usages.length > 0) {
      console.log(`    Usado em (${v.usages.length} arquivo(s)):`);
      v.usages.slice(0, 5).forEach(usage => {
        console.log(`      - ${usage}`);
      });
      if (v.usages.length > 5) {
        console.log(`      ... e mais ${v.usages.length - 5} arquivo(s)`);
      }
    }
    console.log('');
  });
}

console.log('=' .repeat(80));
console.log(`\n📈 Resumo:`);
console.log(`  ✅ Seguros para mover: ${safeToMove.length}`);
console.log(`  ⚠️  Ainda em uso: ${inUse.length}`);
console.log(`  🔄 Precisam migração: ${needsMigration.length}`);
console.log(`  📁 Total: ${violations.length}\n`);

if (safeToMove.length > 0) {
  console.log('💡 Você pode mover os arquivos "Seguros para mover" para a pasta Deprecated.\n');
}


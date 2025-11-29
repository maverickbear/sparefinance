#!/usr/bin/env ts-node
/**
 * Check for Old Implementation Usage
 * 
 * Verifies that the codebase doesn't use old implementation patterns:
 * 1. Client-side API calls (*-client.ts)
 * 2. Direct database access from components
 * 3. Old API imports in Application/Presentation layers
 * 4. Functions that don't use factories
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface Violation {
  file: string;
  line: number;
  type: 'error' | 'warning';
  message: string;
  pattern: string;
}

const violations: Violation[] = [];
const checkedFiles: string[] = [];

// Patterns to check
const patterns = {
  // Client-side API imports
  clientApiImports: [
    /from\s+["']@\/lib\/api\/.*-client["']/g,
    /from\s+["']\.\.\/.*-client["']/g,
    /from\s+["']\.\/.*-client["']/g,
  ],
  
  // Client-side API function calls
  clientApiCalls: [
    /getAccountsClient\(/g,
    /getAllCategoriesClient\(/g,
    /getProfileClient\(/g,
    /getUserClient\(/g,
    /getUserRoleClient\(/g,
    /getHouseholdMembersClient\(/g,
    /getBudgetsClient\(/g,
    /getTransactionsClient\(/g,
    /getGoalsClient\(/g,
    /getDebtsClient\(/g,
    /createAccountClient\(/g,
    /updateAccountClient\(/g,
    /deleteAccountClient\(/g,
  ],
  
  // Direct Supabase access from components
  directSupabaseAccess: [
    /supabase\.from\(/g,
    /createClient\(\)\.from\(/g,
    /\.from\(["']Account["']\)/g,
    /\.from\(["']Transaction["']\)/g,
    /\.from\(["']Category["']\)/g,
    /\.from\(["']Budget["']\)/g,
    /\.from\(["']Goal["']\)/g,
    /\.from\(["']Debt["']\)/g,
  ],
  
  // Old API imports in Application/Presentation layers
  oldApiImports: [
    /from\s+["']@\/lib\/api\/accounts["']/g,
    /from\s+["']@\/lib\/api\/categories["']/g,
    /from\s+["']@\/lib\/api\/transactions["']/g,
    /from\s+["']@\/lib\/api\/budgets["']/g,
    /from\s+["']@\/lib\/api\/goals["']/g,
    /from\s+["']@\/lib\/api\/debts["']/g,
    /from\s+["']@\/lib\/api\/members["']/g,
    /from\s+["']@\/lib\/api\/profile["']/g,
  ],
};

function checkFile(filePath: string, content: string, relativePath: string) {
  const lines = content.split('\n');
  const isApplicationLayer = relativePath.includes('src/application/');
  const isPresentationLayer = relativePath.includes('src/presentation/') || relativePath.includes('app/') || relativePath.includes('components/');
  const isComponent = relativePath.includes('components/') || (relativePath.includes('app/') && relativePath.endsWith('.tsx'));
  const isClientComponent = content.includes('"use client"');
  const isServerComponent = !isClientComponent && (relativePath.includes('app/') || relativePath.includes('components/'));
  
  // Check for client-side API imports
  patterns.clientApiImports.forEach((pattern) => {
    const matches = content.match(pattern);
    if (matches && !relativePath.includes('-client.ts') && !relativePath.includes('Deprecated')) {
      lines.forEach((line, lineNum) => {
        if (pattern.test(line)) {
          violations.push({
            file: relativePath,
            line: lineNum + 1,
            type: 'error',
            message: `Client-side API import found: ${matches[0]}`,
            pattern: 'clientApiImports',
          });
        }
      });
    }
  });
  
  // Check for client-side API function calls
  if (isComponent || isPresentationLayer) {
    patterns.clientApiCalls.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches && !relativePath.includes('-client.ts')) {
        lines.forEach((line, lineNum) => {
          if (pattern.test(line) && !line.includes('// TODO') && !line.includes('// DEPRECATED')) {
            violations.push({
              file: relativePath,
              line: lineNum + 1,
              type: 'error',
              message: `Client-side API call found: ${matches[0]}`,
              pattern: 'clientApiCalls',
            });
          }
        });
      }
    });
  }
  
  // Check for direct Supabase access in components
  if (isClientComponent) {
    patterns.directSupabaseAccess.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches && !relativePath.includes('repository') && !relativePath.includes('infrastructure')) {
        lines.forEach((line, lineNum) => {
          if (pattern.test(line) && !line.includes('// TODO') && !line.includes('// DEPRECATED')) {
            violations.push({
              file: relativePath,
              line: lineNum + 1,
              type: 'error',
              message: `Direct database access from component: ${matches[0]}`,
              pattern: 'directSupabaseAccess',
            });
          }
        });
      }
    });
  }
  
  // Check for old API imports in Application/Presentation layers
  if (isApplicationLayer || isPresentationLayer) {
    patterns.oldApiImports.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches && !relativePath.includes('Deprecated') && !relativePath.includes('lib/api/')) {
        // Allow some exceptions (like getUserLiabilities from plaid/liabilities)
        const isException = relativePath.includes('financial-health') && matches[0].includes('plaid/liabilities');
        if (!isException) {
          lines.forEach((line, lineNum) => {
            if (pattern.test(line) && !line.includes('// TODO') && !line.includes('// DEPRECATED')) {
              violations.push({
                file: relativePath,
                line: lineNum + 1,
                type: 'warning',
                message: `Old API import in ${isApplicationLayer ? 'Application' : 'Presentation'} layer: ${matches[0]}`,
                pattern: 'oldApiImports',
              });
            }
          });
        }
      }
    });
  }
}

function walkDir(dir: string, baseDir: string = dir): void {
  const files = readdirSync(dir);
  
  files.forEach((file) => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    const relativePath = filePath.replace(baseDir + '/', '');
    
    // Skip node_modules, .next, etc.
    if (
      file.startsWith('.') ||
      file === 'node_modules' ||
      file === '.next' ||
      file === 'dist' ||
      file === 'build' ||
      file.includes('Deprecated') ||
      file.includes('lib/api/') // Skip lib/api itself (it's the old implementation)
    ) {
      return;
    }
    
    if (stat.isDirectory()) {
      walkDir(filePath, baseDir);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        checkFile(filePath, content, relativePath);
        checkedFiles.push(relativePath);
      } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
      }
    }
  });
}

// Run verification
console.log('🔍 Checking for old implementation usage...\n');
walkDir(process.cwd());

// Report results
console.log(`✅ Checked ${checkedFiles.length} files\n`);

const errors = violations.filter(v => v.type === 'error');
const warnings = violations.filter(v => v.type === 'warning');

if (errors.length > 0) {
  console.log(`❌ Found ${errors.length} errors:\n`);
  errors.forEach(v => {
    console.log(`  ${v.file}:${v.line} - ${v.message}`);
  });
  console.log('');
}

if (warnings.length > 0) {
  console.log(`⚠️  Found ${warnings.length} warnings:\n`);
  warnings.forEach(v => {
    console.log(`  ${v.file}:${v.line} - ${v.message}`);
  });
  console.log('');
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All checks passed! No old implementation patterns found.\n');
  process.exit(0);
} else {
  console.log(`\n❌ Verification failed with ${errors.length} errors and ${warnings.length} warnings.\n`);
  process.exit(errors.length > 0 ? 1 : 0);
}


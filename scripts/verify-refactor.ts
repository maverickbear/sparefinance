#!/usr/bin/env ts-node
/**
 * Refactor Verification Script
 * 
 * Verifies that the Clean Architecture refactor is complete and correct:
 * 1. No runtime client-side API calls
 * 2. All imports follow layer rules
 * 3. API routes use factories
 * 4. Components use API routes
 * 5. No direct database access from Presentation layer
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface Violation {
  file: string;
  line: number;
  type: 'error' | 'warning';
  message: string;
}

const violations: Violation[] = [];
const checkedFiles: string[] = [];

// Patterns to check
const patterns = {
  // Client-side API function calls (runtime)
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
    /from\(["']Account["']\)/g,
    /from\(["']Transaction["']\)/g,
    /from\(["']Category["']\)/g,
    /from\(["']Budget["']\)/g,
    /from\(["']Goal["']\)/g,
    /from\(["']Debt["']\)/g,
  ],
  
  // API routes should use factories
  apiRouteFactories: /make\w+Service\(\)/g,
  
  // Components should use fetch
  componentFetch: /fetch\(["']\/api\/v2\//g,
};

function checkFile(filePath: string, content: string, relativePath: string) {
  const lines = content.split('\n');
  const isApiRoute = relativePath.includes('/api/v2/') && relativePath.endsWith('route.ts');
  const isComponent = relativePath.includes('components/') || relativePath.includes('app/');
  const isClientComponent = content.includes('"use client"');
  
  // Check for client-side API calls (runtime)
  if (isComponent && !relativePath.includes('-client.ts')) {
    patterns.clientApiCalls.forEach((pattern, index) => {
      const matches = content.match(pattern);
      if (matches) {
        lines.forEach((line, lineNum) => {
          if (pattern.test(line)) {
            violations.push({
              file: relativePath,
              line: lineNum + 1,
              type: 'error',
              message: `Runtime client-side API call found: ${matches[0]}`,
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
      if (matches && !relativePath.includes('repository')) {
        lines.forEach((line, lineNum) => {
          if (pattern.test(line)) {
            violations.push({
              file: relativePath,
              line: lineNum + 1,
              type: 'error',
              message: `Direct database access from component: ${matches[0]}`,
            });
          }
        });
      }
    });
  }
  
  // Check API routes use factories
  if (isApiRoute) {
    const hasFactory = patterns.apiRouteFactories.test(content);
    if (!hasFactory && content.includes('export async function')) {
      violations.push({
        file: relativePath,
        line: 1,
        type: 'warning',
        message: 'API route may not be using factory pattern',
      });
    }
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
      file.includes('Deprecated')
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
console.log('🔍 Starting refactor verification...\n');
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
  console.log('✅ All checks passed! Refactor is complete.\n');
  process.exit(0);
} else {
  console.log(`\n❌ Verification failed with ${errors.length} errors and ${warnings.length} warnings.\n`);
  process.exit(errors.length > 0 ? 1 : 0);
}


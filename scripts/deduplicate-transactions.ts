#!/usr/bin/env tsx

/**
 * Script to deduplicate transactions
 * 
 * Usage:
 *   tsx scripts/deduplicate-transactions.ts [accountId]
 * 
 * If accountId is provided, only deduplicates transactions for that account.
 * Otherwise, deduplicates all transactions.
 */

import { deduplicateTransactions } from '../lib/api/plaid/deduplicate-transactions';

async function main() {
  const accountId = process.argv[2] || undefined;

  console.log('🔍 Starting transaction deduplication...');
  if (accountId) {
    console.log(`   Account ID: ${accountId}`);
  } else {
    console.log('   All accounts');
  }

  try {
    const result = await deduplicateTransactions(accountId);

    console.log('\n✅ Deduplication completed!');
    console.log(`   Duplicates found: ${result.duplicatesFound}`);
    console.log(`   Duplicates removed: ${result.duplicatesRemoved}`);
    console.log(`   Errors: ${result.errors}`);

    if (result.duplicatesRemoved > 0) {
      console.log(`\n✨ Successfully removed ${result.duplicatesRemoved} duplicate transaction(s)!`);
    } else if (result.duplicatesFound === 0) {
      console.log('\n✨ No duplicates found!');
    }
  } catch (error: any) {
    console.error('\n❌ Error during deduplication:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();


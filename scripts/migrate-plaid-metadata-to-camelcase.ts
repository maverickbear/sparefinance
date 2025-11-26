/**
 * Migration script to convert existing plaidMetadata from snake_case to camelCase
 * 
 * This script can be run to migrate existing transaction data to the new camelCase format.
 * It's safe to run multiple times as it only converts fields that are still in snake_case.
 * 
 * Usage:
 *   npx tsx scripts/migrate-plaid-metadata-to-camelcase.ts
 * 
 * Or with environment variables:
 *   DATABASE_URL=... npx tsx scripts/migrate-plaid-metadata-to-camelcase.ts
 */

import { createServerClient } from '../lib/supabase-server';
import { convertPlaidTransactionToCamelCase } from '../lib/api/plaid/utils';

async function migratePlaidMetadata() {
  console.log('Starting migration of plaidMetadata from snake_case to camelCase...');
  
  const supabase = await createServerClient();
  
  // Get all transactions with plaidMetadata
  const { data: transactions, error: fetchError } = await supabase
    .from('Transaction')
    .select('id, plaidMetadata')
    .not('plaidMetadata', 'is', null);
  
  if (fetchError) {
    console.error('Error fetching transactions:', fetchError);
    process.exit(1);
  }
  
  if (!transactions || transactions.length === 0) {
    console.log('No transactions with plaidMetadata found. Migration complete.');
    return;
  }
  
  console.log(`Found ${transactions.length} transactions with plaidMetadata`);
  
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const transaction of transactions) {
    try {
      const plaidMetadata = transaction.plaidMetadata as any;
      
      if (!plaidMetadata || typeof plaidMetadata !== 'object') {
        skipped++;
        continue;
      }
      
      // Check if already in camelCase (has at least one camelCase field)
      const hasCamelCase = 
        plaidMetadata.authorizedDate !== undefined ||
        plaidMetadata.isoCurrencyCode !== undefined ||
        plaidMetadata.transactionType !== undefined;
      
      // Check if has snake_case fields that need conversion
      const hasSnakeCase = 
        plaidMetadata.authorized_date !== undefined ||
        plaidMetadata.iso_currency_code !== undefined ||
        plaidMetadata.transaction_type !== undefined;
      
      // Skip if already converted or has no snake_case fields
      if (hasCamelCase && !hasSnakeCase) {
        skipped++;
        continue;
      }
      
      // Convert to camelCase
      const converted = convertPlaidTransactionToCamelCase(plaidMetadata);
      
      // Update transaction
      const { error: updateError } = await supabase
        .from('Transaction')
        .update({ plaidMetadata: converted })
        .eq('id', transaction.id);
      
      if (updateError) {
        console.error(`Error updating transaction ${transaction.id}:`, updateError);
        errors++;
      } else {
        migrated++;
        if (migrated % 100 === 0) {
          console.log(`Migrated ${migrated} transactions...`);
        }
      }
    } catch (error) {
      console.error(`Error processing transaction ${transaction.id}:`, error);
      errors++;
    }
  }
  
  console.log('\nMigration complete!');
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped} (already in camelCase or no metadata)`);
  console.log(`  Errors: ${errors}`);
}

// Run migration
migratePlaidMetadata()
  .then(() => {
    console.log('Migration script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });


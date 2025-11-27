/**
 * Script to decrypt transaction amounts that don't have amount_numeric
 * 
 * This script:
 * 1. Finds transactions where amount_numeric is NULL but amount exists
 * 2. Decrypts the amount field
 * 3. Populates amount_new with the decrypted value
 * 
 * Run this after migration 20250205000000_remove_amount_encryption.sql
 * and before migration 20250205000001_finalize_amount_migration.sql
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { decryptAmount } from '../lib/utils/transaction-encryption';
import { logger } from '../lib/utils/logger';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  console.error('\nPlease ensure these variables are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function decryptTransactionAmounts() {
  console.log('Starting transaction amount decryption...\n');

  // First, check if amount_new column exists (created by first migration)
  // Try to select amount_new to see if it exists
  const { error: testError } = await supabase
    .from('Transaction')
    .select('amount_new')
    .limit(1);

  if (testError && testError.code === '42703') {
    console.error('❌ Error: Column "amount_new" does not exist.');
    console.error('\n⚠️  You must run the first migration before running this script:');
    console.error('   Migration: 20250205000000_remove_amount_encryption.sql');
    console.error('\nThis migration creates the "amount_new" column needed for the decryption process.');
    console.error('\nTo apply the migration:');
    console.error('   - If using Supabase CLI: supabase migration up');
    console.error('   - If using Supabase Dashboard: Run the migration SQL manually');
    process.exit(1);
  }

  // Find transactions that need decryption
  // These are transactions where amount_numeric is NULL but amount exists
  // Also check if amount_new is NULL (meaning it hasn't been populated yet)
  const { data: transactions, error: fetchError } = await supabase
    .from('Transaction')
    .select('id, amount, amount_numeric, amount_new')
    .is('amount_numeric', null)
    .is('amount_new', null)
    .not('amount', 'is', null);

  if (fetchError) {
    console.error('Error fetching transactions:', fetchError);
    process.exit(1);
  }

  if (!transactions || transactions.length === 0) {
    console.log('No transactions need decryption. All amounts are already migrated.');
    return;
  }

  console.log(`Found ${transactions.length} transactions to decrypt.\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ id: string; error: string }> = [];

  // Process in batches to avoid overwhelming the database
  const BATCH_SIZE = 100;
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(transactions.length / BATCH_SIZE)}...`);

    const updates = await Promise.all(
      batch.map(async (tx) => {
        try {
          // Decrypt the amount
          const decryptedAmount = decryptAmount(tx.amount);

          if (decryptedAmount === null) {
            throw new Error('Failed to decrypt amount');
          }

          // Update amount_new
          const { error: updateError } = await supabase
            .from('Transaction')
            .update({ amount_new: decryptedAmount })
            .eq('id', tx.id);

          if (updateError) {
            throw updateError;
          }

          return { success: true, id: tx.id };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, id: tx.id, error: errorMessage };
        }
      })
    );

    // Count results
    updates.forEach((result) => {
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        errors.push({ id: result.id, error: result.error || 'Unknown error' });
      }
    });

    console.log(`  Batch complete: ${updates.filter((r) => r.success).length} succeeded, ${updates.filter((r) => !r.success).length} failed`);
  }

  console.log('\n=== Decryption Summary ===');
  console.log(`Total transactions: ${transactions.length}`);
  console.log(`Successfully decrypted: ${successCount}`);
  console.log(`Errors: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\n=== Errors ===');
    errors.slice(0, 10).forEach((err) => {
      console.log(`  Transaction ${err.id}: ${err.error}`);
    });
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }

  if (errorCount > 0) {
    console.log('\n⚠️  Some transactions failed to decrypt. Please review errors above.');
    process.exit(1);
  }

  console.log('\n✅ All transactions successfully decrypted!');
  console.log('You can now run the final migration: 20250205000001_finalize_amount_migration.sql');
}

// Run the script
decryptTransactionAmounts()
  .then(() => {
    console.log('\nScript completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });


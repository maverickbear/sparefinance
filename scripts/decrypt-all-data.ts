/**
 * Script to decrypt all encrypted data in the database
 * 
 * This script:
 * 1. Decrypts all transaction descriptions
 * 
 * Run this after removing encryption from the codebase
 * 
 * IMPORTANT: Make sure ENCRYPTION_KEY is still set in .env.local for this script to work
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../lib/utils/encryption';

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

/**
 * Check if a string looks like encrypted data
 * Encrypted data format: salt (128 hex chars) + iv (32 hex chars) + tag (32 hex chars) + encrypted data
 * Minimum length: (64 + 16 + 16) * 2 = 192 hex characters
 */
function looksEncrypted(text: string | null): boolean {
  if (!text) return false;
  const MIN_ENCRYPTED_LENGTH = 192;
  const isHexString = /^[0-9a-f]+$/i.test(text);
  return text.length >= MIN_ENCRYPTED_LENGTH && isHexString;
}

/**
 * Try to decrypt a value, return original if it fails
 */
function tryDecrypt(encryptedValue: string | null): string | null {
  if (!encryptedValue) return encryptedValue;
  
  // If it doesn't look encrypted, return as-is
  if (!looksEncrypted(encryptedValue)) {
    return encryptedValue;
  }
  
  // Check if ENCRYPTION_KEY is available
  if (!process.env.ENCRYPTION_KEY && !process.env.NEXT_PUBLIC_ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not set in environment variables');
  }
  
  try {
    return decrypt(encryptedValue, true); // silent mode
  } catch (error) {
    // Only log if it's not a missing key error (which we already checked)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('ENCRYPTION_KEY')) {
      console.warn('Failed to decrypt value, keeping original:', errorMessage);
    }
    return encryptedValue;
  }
}

async function decryptTransactionDescriptions() {
  console.log('🔓 Decrypting transaction descriptions...\n');
  
  const hasEncryptionKey = !!(process.env.ENCRYPTION_KEY || process.env.NEXT_PUBLIC_ENCRYPTION_KEY);

  // Get all transactions with descriptions
  const { data: transactions, error: fetchError } = await supabase
    .from('Transaction')
    .select('id, description')
    .not('description', 'is', null);

  if (fetchError) {
    console.error('Error fetching transactions:', fetchError);
    return;
  }

  if (!transactions || transactions.length === 0) {
    console.log('No transactions with descriptions found.');
    return;
  }

  console.log(`Found ${transactions.length} transactions with descriptions.\n`);

  let decryptedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Process in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(transactions.length / BATCH_SIZE)}...`);

    const updates = await Promise.all(
      batch.map(async (tx) => {
        try {
          // Check if description looks encrypted
          if (!looksEncrypted(tx.description)) {
            return { success: true, id: tx.id, skipped: true };
          }

          // Check if we have encryption key before trying to decrypt
          if (!hasEncryptionKey) {
            // Data looks encrypted but we can't decrypt it
            return { success: true, id: tx.id, skipped: true, needsKey: true };
          }

          // Decrypt description
          const decryptedDescription = tryDecrypt(tx.description);

          if (decryptedDescription === tx.description) {
            // Decryption failed or wasn't needed
            return { success: true, id: tx.id, skipped: true };
          }

          // Update transaction
          const { error: updateError } = await supabase
            .from('Transaction')
            .update({ description: decryptedDescription })
            .eq('id', tx.id);

          if (updateError) {
            throw updateError;
          }

          return { success: true, id: tx.id, decrypted: true };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Only return error if it's not about missing key (we already handle that)
          if (errorMessage.includes('ENCRYPTION_KEY') && !hasEncryptionKey) {
            return { success: true, id: tx.id, skipped: true, needsKey: true };
          }
          return { success: false, id: tx.id, error: errorMessage };
        }
      })
    );

    // Count results
    updates.forEach((result) => {
      if (result.success) {
        if ((result as any).decrypted) {
          decryptedCount++;
        } else {
          skippedCount++;
        }
      } else {
        errorCount++;
      }
    });

    console.log(`  Batch complete: ${updates.filter((r) => (r as any).decrypted).length} decrypted, ${updates.filter((r) => (r as any).skipped).length} skipped, ${updates.filter((r) => !r.success).length} errors`);
  }

  console.log('\n=== Transaction Descriptions Summary ===');
  console.log(`Total transactions: ${transactions.length}`);
  console.log(`Decrypted: ${decryptedCount}`);
  console.log(`Skipped (not encrypted): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
}


async function main() {
  console.log('🚀 Starting data decryption migration...\n');
  
  // Check if ENCRYPTION_KEY is set
  const hasEncryptionKey = !!(process.env.ENCRYPTION_KEY || process.env.NEXT_PUBLIC_ENCRYPTION_KEY);
  
  if (!hasEncryptionKey) {
    console.log('⚠️  WARNING: ENCRYPTION_KEY is not set in .env.local');
    console.log('   The script will only check if data is encrypted, but cannot decrypt it.\n');
    console.log('   If you have encrypted data, please:');
    console.log('   1. Add ENCRYPTION_KEY to .env.local');
    console.log('   2. Run this script again\n');
  } else {
    console.log('✓ ENCRYPTION_KEY is set - ready to decrypt data\n');
  }

  try {
    await decryptTransactionDescriptions();

    console.log('\n✅ Migration completed successfully!');
    
    if (hasEncryptionKey) {
      console.log('\n📝 Next steps:');
      console.log('   1. Verify the decrypted data in the database');
      console.log('   2. Remove ENCRYPTION_KEY from .env.local (optional)');
      console.log('   3. Remove ENCRYPTION_KEY from Vercel environment variables');
    } else {
      console.log('\n📝 Note: No encrypted data was found, or ENCRYPTION_KEY was not set.');
      console.log('   If all data is already decrypted, you can safely remove ENCRYPTION_KEY.');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });


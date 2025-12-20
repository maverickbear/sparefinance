#!/usr/bin/env tsx
/**
 * Script to fix Plaid transaction types that were incorrectly imported
 * 
 * Before the fix, the logic was inverted:
 * - Positive amounts were classified as 'income' (should be 'expense')
 * - Negative amounts were classified as 'expense' (should be 'income')
 * 
 * This script inverts the type for all Plaid transactions:
 * - 'income' -> 'expense'
 * - 'expense' -> 'income'
 * - 'transfer' -> unchanged (transfers are not affected)
 * 
 * Run with: npx tsx scripts/fix-plaid-transaction-types.ts [--dry-run]
 * 
 * Use --dry-run to preview changes without applying them.
 */

// Load environment variables before importing modules that depend on them
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SECRET_KEY || 
                               process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing required environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("   SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY):", supabaseServiceRoleKey ? "✓" : "✗");
  console.error("\nPlease ensure these variables are set in .env.local");
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  description: string | null;
  plaid_transaction_id: string | null;
  date: string;
}

const isDryRun = process.argv.includes('--dry-run');

async function fixPlaidTransactionTypes() {
  console.log("🔍 Finding Plaid transactions with incorrect types...");
  if (isDryRun) {
    console.log("⚠️  DRY RUN MODE - No changes will be made\n");
  }

  // Find all transactions that have a plaid_transaction_id (imported from Plaid)
  const { data: transactions, error: fetchError } = await supabase
    .from("transactions")
    .select("id, type, amount, description, plaid_transaction_id, date")
    .not("plaid_transaction_id", "is", null)
    .is("deleted_at", null) // Exclude soft-deleted records
    .order("date", { ascending: false });

  if (fetchError) {
    console.error("❌ Error fetching transactions:", fetchError);
    return;
  }

  if (!transactions || transactions.length === 0) {
    console.log("✅ No Plaid transactions found");
    return;
  }

  console.log(`📊 Found ${transactions.length} Plaid transactions\n`);

  // Filter transactions that need type correction (income/expense only, not transfers)
  const transactionsToFix = transactions.filter(
    (tx) => tx.type === 'income' || tx.type === 'expense'
  ) as Transaction[];

  if (transactionsToFix.length === 0) {
    console.log("✅ No transactions need type correction (all are transfers or already correct)");
    return;
  }

  console.log(`📝 Transactions to fix: ${transactionsToFix.length}`);
  console.log(`   Income -> Expense: ${transactionsToFix.filter(tx => tx.type === 'income').length}`);
  console.log(`   Expense -> Income: ${transactionsToFix.filter(tx => tx.type === 'expense').length}\n`);

  if (isDryRun) {
    console.log("📋 Preview of changes (first 10):");
    transactionsToFix.slice(0, 10).forEach((tx) => {
      const newType = tx.type === 'income' ? 'expense' : 'income';
      console.log(`   ${tx.id.substring(0, 8)}... | ${tx.type} -> ${newType} | $${tx.amount.toFixed(2)} | ${tx.description?.substring(0, 40) || 'N/A'}`);
    });
    if (transactionsToFix.length > 10) {
      console.log(`   ... and ${transactionsToFix.length - 10} more\n`);
    }
    console.log("\n✅ Dry run completed. Run without --dry-run to apply changes.");
    return;
  }

  let fixed = 0;
  let errors = 0;
  const errorsList: Array<{ id: string; error: string }> = [];

  // Process in batches to avoid overwhelming the database
  const batchSize = 100;
  for (let i = 0; i < transactionsToFix.length; i += batchSize) {
    const batch = transactionsToFix.slice(i, i + batchSize);
    
    for (const tx of batch) {
      try {
        // Invert the type: income -> expense, expense -> income
        const newType = tx.type === 'income' ? 'expense' : 'income';
        
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ 
            type: newType,
            updated_at: new Date().toISOString()
          })
          .eq("id", tx.id);

        if (updateError) {
          console.error(`❌ Error updating transaction ${tx.id}:`, updateError.message);
          errors++;
          errorsList.push({ id: tx.id, error: updateError.message });
        } else {
          fixed++;
          if (fixed % 50 === 0) {
            console.log(`   Progress: ${fixed}/${transactionsToFix.length} transactions fixed...`);
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing transaction ${tx.id}:`, error.message);
        errors++;
        errorsList.push({ id: tx.id, error: error.message });
      }
    }
  }

  console.log("\n📈 Summary:");
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📊 Total processed: ${transactionsToFix.length}`);

  if (errors > 0 && errorsList.length > 0) {
    console.log("\n⚠️  Errors encountered:");
    errorsList.slice(0, 10).forEach(({ id, error }) => {
      console.log(`   ${id.substring(0, 8)}...: ${error}`);
    });
    if (errorsList.length > 10) {
      console.log(`   ... and ${errorsList.length - 10} more errors`);
    }
  }

  if (fixed > 0) {
    console.log(`\n✨ Successfully corrected ${fixed} Plaid transaction type(s)!`);
  }
}

// Run the script
fixPlaidTransactionTypes()
  .then(() => {
    console.log("\n✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });


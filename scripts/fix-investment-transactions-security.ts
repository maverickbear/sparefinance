#!/usr/bin/env tsx
/**
 * Script to fix investment transactions without securityId
 * 
 * This script identifies investment transactions that should have a securityId
 * but don't, and attempts to fix them by:
 * 1. Finding existing securities by symbol/name
 * 2. Creating new securities if needed
 * 3. Updating transactions with the securityId
 * 
 * Run with: npx tsx scripts/fix-investment-transactions-security.ts
 */

// Load environment variables before importing modules that depend on them
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing required environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceRoleKey ? "✓" : "✗");
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
  type: string;
  accountId: string;
  securityId: string | null;
  notes: string | null;
  date: string;
}

interface Security {
  id: string;
  symbol: string;
  name: string;
}

async function fixTransactionsWithoutSecurityId() {
  console.log("🔍 Finding investment transactions without securityId...");

  // Find transactions that should have a securityId but don't
  // Types that require securityId: buy, sell, dividend, interest
  const { data: transactions, error: fetchError } = await supabase
    .from("InvestmentTransaction")
    .select("id, type, accountId, securityId, notes, date")
    .in("type", ["buy", "sell", "dividend", "interest"])
    .is("securityId", null)
    .order("date", { ascending: false });

  if (fetchError) {
    console.error("Error fetching transactions:", fetchError);
    return;
  }

  if (!transactions || transactions.length === 0) {
    console.log("✅ No transactions found without securityId");
    return;
  }

  console.log(`📊 Found ${transactions.length} transactions without securityId`);

  // Get all existing securities for lookup
  const { data: allSecurities, error: securitiesError } = await supabase
    .from("Security")
    .select("id, symbol, name");

  if (securitiesError) {
    console.error("Error fetching securities:", securitiesError);
    return;
  }

  const securityMap = new Map<string, Security>();
  if (allSecurities) {
    for (const security of allSecurities) {
      // Map by symbol (uppercase for case-insensitive matching)
      securityMap.set(security.symbol.toUpperCase(), security);
      // Also map by name for fallback
      securityMap.set(security.name.toUpperCase(), security);
    }
  }

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const tx of transactions) {
    try {
      // Try to extract symbol from notes or other fields
      // This is a heuristic - adjust based on your data format
      let symbol: string | null = null;

      // Check if notes contain a symbol (common patterns)
      if (tx.notes) {
        // Try to find symbol patterns like "AAPL", "TSLA", etc.
        const symbolMatch = tx.notes.match(/\b[A-Z]{1,5}\b/);
        if (symbolMatch) {
          symbol = symbolMatch[0];
        }
      }

      // If we can't find a symbol, we can't fix this transaction
      if (!symbol) {
        console.log(`⚠️  Skipping transaction ${tx.id} (${tx.type}) - no symbol found in notes: ${tx.notes}`);
        skipped++;
        continue;
      }

      // Look up security by symbol
      const security = securityMap.get(symbol.toUpperCase());

      if (security) {
        // Update transaction with existing security
        const { error: updateError } = await supabase
          .from("InvestmentTransaction")
          .update({ securityId: security.id })
          .eq("id", tx.id);

        if (updateError) {
          console.error(`❌ Error updating transaction ${tx.id}:`, updateError);
          errors++;
        } else {
          console.log(`✅ Fixed transaction ${tx.id} (${tx.type}) - linked to security ${security.symbol}`);
          fixed++;
        }
      } else {
        // Create new security
        const { randomUUID } = await import("crypto");
        const newSecurityId = randomUUID();
        const { error: createError } = await supabase
          .from("Security")
          .insert({
            id: newSecurityId,
            symbol: symbol,
            name: symbol, // Use symbol as name if no name available
            class: "Stock",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

        if (createError) {
          console.error(`❌ Error creating security for ${symbol}:`, createError);
          errors++;
          continue;
        }

        // Update transaction with new security
        const { error: updateError } = await supabase
          .from("InvestmentTransaction")
          .update({ securityId: newSecurityId })
          .eq("id", tx.id);

        if (updateError) {
          console.error(`❌ Error updating transaction ${tx.id}:`, updateError);
          errors++;
        } else {
          console.log(`✅ Fixed transaction ${tx.id} (${tx.type}) - created and linked to security ${symbol}`);
          fixed++;
          // Add to map for future lookups
          securityMap.set(symbol.toUpperCase(), {
            id: newSecurityId,
            symbol: symbol,
            name: symbol,
          });
        }
      }
    } catch (error: any) {
      console.error(`❌ Error processing transaction ${tx.id}:`, error);
      errors++;
    }
  }

  console.log("\n📈 Summary:");
  console.log(`   Fixed: ${fixed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total: ${transactions.length}`);
}

// Run the script
fixTransactionsWithoutSecurityId()
  .then(() => {
    console.log("\n✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });


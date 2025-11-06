#!/usr/bin/env tsx
/**
 * Script to clean up duplicate subcategories in Supabase
 * Run with: npm run cleanup:duplicate-subcategories -- --confirm
 * 
 * WARNING: This script will DELETE duplicate subcategories from the database.
 * Make sure to backup your database before running this script.
 */

// Load environment variables from .env.local
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing Supabase environment variables");
  console.log("\n💡 Please check your .env.local file:");
  console.log("   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co");
  console.log("   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key\n");
  console.log("   Note: Service role key is required to bypass RLS and delete subcategories.");
  process.exit(1);
}

// Use service role key to bypass RLS for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  createdAt: string;
}

async function cleanupDuplicates() {
  console.log("🔍 Finding duplicate subcategories...\n");

  // Get all subcategories with their category info
  const { data: subcategories, error } = await supabase
    .from("Subcategory")
    .select(`
      id,
      name,
      categoryId,
      createdAt,
      category:Category!inner(
        id,
        name
      )
    `)
    .order("createdAt", { ascending: true });

  if (error) {
    console.error("❌ Error fetching subcategories:", error);
    process.exit(1);
  }

  if (!subcategories || subcategories.length === 0) {
    console.log("✅ No subcategories found");
    return;
  }

  // Group by name + categoryId
  const subcategoryMap = new Map<string, any[]>();
  
  subcategories.forEach((subcat: any) => {
    const key = `${subcat.name}-${subcat.categoryId}`;
    if (!subcategoryMap.has(key)) {
      subcategoryMap.set(key, []);
    }
    subcategoryMap.get(key)!.push(subcat);
  });

  // Find duplicates
  const duplicatesToDelete: string[] = [];
  const duplicatesInfo: Array<{ key: string; category: any; keep: any; delete: any[] }> = [];

  subcategoryMap.forEach((subcats, key) => {
    if (subcats.length > 1) {
      // Sort by createdAt to keep the oldest one
      subcats.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const keep = subcats[0];
      const toDelete = subcats.slice(1);

      duplicatesInfo.push({ 
        key, 
        category: subcats[0].category,
        keep, 
        delete: toDelete 
      });
      toDelete.forEach((subcat) => duplicatesToDelete.push(subcat.id));
    }
  });

  if (duplicatesToDelete.length === 0) {
    console.log("✅ No duplicates found!");
    return;
  }

  console.log(`⚠️  Found ${duplicatesToDelete.length} duplicate subcategories to delete:\n`);

  // Show what will be deleted
  duplicatesInfo.forEach(({ key, category, keep, delete: toDelete }) => {
    const [name] = key.split('-');
    console.log(`📋 Category: ${category.name} - Subcategory: "${name}"`);
    console.log(`   ✅ KEEP: ${keep.id} (created: ${keep.createdAt})`);
    toDelete.forEach((subcat) => {
      console.log(`   ❌ DELETE: ${subcat.id} (created: ${subcat.createdAt})`);
    });
    console.log();
  });

  // Check for transactions
  console.log("🔍 Checking for transactions...\n");

  for (const subcategoryId of duplicatesToDelete) {
    const { count: transactionCount, error: transError } = await supabase
      .from("Transaction")
      .select("id", { count: "exact", head: true })
      .eq("subcategoryId", subcategoryId);

    if (transError) {
      console.error(`❌ Error checking transactions for ${subcategoryId}:`, transError);
      continue;
    }

    if (transactionCount && transactionCount > 0) {
      const dupInfo = duplicatesInfo.find((d) => 
        d.delete.some((subcat) => subcat.id === subcategoryId)
      );
      
      if (dupInfo) {
        console.warn(`⚠️  Subcategory ${subcategoryId} is used in ${transactionCount} transaction(s)`);
        console.warn(`   ✅ These transactions will be updated to use subcategory ${dupInfo.keep.id} (${dupInfo.keep.name})\n`);
      }
    }
  }

  // Ask for confirmation
  console.log(`\n⚠️  WARNING: This will delete ${duplicatesToDelete.length} duplicate subcategories.`);
  console.log("   Make sure you have a backup of your database!\n");
  console.log("   To proceed, run this script with the --confirm flag:");
  console.log("   npm run cleanup:duplicate-subcategories -- --confirm\n");

  // Check for --confirm flag
  const args = process.argv.slice(2);
  if (!args.includes("--confirm")) {
    console.log("❌ Aborted. Use --confirm flag to proceed.");
    process.exit(0);
  }

  console.log("🗑️  Deleting duplicate subcategories...\n");

  let deletedCount = 0;
  let errorCount = 0;
  let updatedTransactions = 0;

  for (const dupInfo of duplicatesInfo) {
    const { keep, delete: toDelete } = dupInfo;

    for (const subcategoryToDelete of toDelete) {
      // Update transactions to use the kept subcategory instead
      const { count: transactionCount, error: transError } = await supabase
        .from("Transaction")
        .update({ subcategoryId: keep.id })
        .eq("subcategoryId", subcategoryToDelete.id);

      if (transError) {
        console.error(`❌ Error updating transactions for ${subcategoryToDelete.id}:`, transError);
        errorCount++;
        continue;
      }

      if (transactionCount && transactionCount > 0) {
        updatedTransactions += transactionCount;
        console.log(`   ✅ Updated ${transactionCount} transaction(s) to use kept subcategory`);
      }

      // Delete the duplicate subcategory
      const { error: deleteError } = await supabase
        .from("Subcategory")
        .delete()
        .eq("id", subcategoryToDelete.id);

      if (deleteError) {
        console.error(`❌ Error deleting subcategory ${subcategoryToDelete.id}:`, deleteError);
        errorCount++;
        continue;
      }

      deletedCount++;
      console.log(`✅ Deleted duplicate subcategory ${subcategoryToDelete.id} (${subcategoryToDelete.name})`);
    }
  }

  console.log(`\n✅ Cleanup complete!`);
  console.log(`   Deleted: ${deletedCount} duplicate subcategories`);
  console.log(`   Updated: ${updatedTransactions} transaction(s)`);
  if (errorCount > 0) {
    console.log(`   Errors: ${errorCount}`);
  }
}

cleanupDuplicates()
  .then(() => {
    console.log("\n✅ Script complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });


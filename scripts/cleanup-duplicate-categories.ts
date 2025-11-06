#!/usr/bin/env tsx
/**
 * Script to clean up duplicate categories in Supabase
 * Run with: npm run cleanup:duplicates
 * 
 * WARNING: This script will DELETE duplicate categories from the database.
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
  console.log("   Note: Service role key is required to bypass RLS and delete system categories.");
  process.exit(1);
}

// Use service role key to bypass RLS for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface Category {
  id: string;
  name: string;
  macroId: string;
  userId: string | null;
  createdAt: string;
}

async function cleanupDuplicates() {
  console.log("🔍 Finding duplicate categories...\n");

  // Get all system categories
  const { data: categories, error } = await supabase
    .from("Category")
    .select(`
      id,
      name,
      macroId,
      userId,
      createdAt
    `)
    .is("userId", null)
    .order("createdAt", { ascending: true });

  if (error) {
    console.error("❌ Error fetching categories:", error);
    process.exit(1);
  }

  if (!categories || categories.length === 0) {
    console.log("✅ No categories found");
    return;
  }

  // Group by name + macroId
  const categoryMap = new Map<string, Category[]>();
  
  categories.forEach((cat) => {
    const key = `${cat.name}-${cat.macroId}`;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, []);
    }
    categoryMap.get(key)!.push(cat);
  });

  // Find duplicates
  const duplicatesToDelete: string[] = [];
  const duplicatesInfo: Array<{ key: string; keep: Category; delete: Category[] }> = [];

  categoryMap.forEach((cats, key) => {
    if (cats.length > 1) {
      // Sort by createdAt to keep the oldest one
      cats.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const keep = cats[0];
      const toDelete = cats.slice(1);

      duplicatesInfo.push({ key, keep, delete: toDelete });
      toDelete.forEach((cat) => duplicatesToDelete.push(cat.id));
    }
  });

  if (duplicatesToDelete.length === 0) {
    console.log("✅ No duplicates found!");
    return;
  }

  console.log(`⚠️  Found ${duplicatesToDelete.length} duplicate categories to delete:\n`);

  // Show what will be deleted
  duplicatesInfo.forEach(({ key, keep, delete: toDelete }) => {
    console.log(`📋 ${key}:`);
    console.log(`   ✅ KEEP: ${keep.id} (created: ${keep.createdAt})`);
    toDelete.forEach((cat) => {
      console.log(`   ❌ DELETE: ${cat.id} (created: ${cat.createdAt})`);
    });
    console.log();
  });

  // Check for subcategories and transactions
  console.log("🔍 Checking for subcategories and transactions...\n");

  for (const categoryId of duplicatesToDelete) {
    // Check subcategories
    const { data: subcategories, error: subError } = await supabase
      .from("Subcategory")
      .select("id, name")
      .eq("categoryId", categoryId);

    if (subError) {
      console.error(`❌ Error checking subcategories for ${categoryId}:`, subError);
      continue;
    }

    if (subcategories && subcategories.length > 0) {
      // Find the kept category for this duplicate
      const dupInfo = duplicatesInfo.find((d) => 
        d.delete.some((cat) => cat.id === categoryId)
      );
      
      if (dupInfo) {
        console.warn(`⚠️  Category ${categoryId} has ${subcategories.length} subcategories:`);
        subcategories.forEach((sub) => {
          console.warn(`   - ${sub.name} (${sub.id})`);
        });
        console.warn(`   ✅ These subcategories will be MIGRATED to category ${dupInfo.keep.id} (${dupInfo.keep.name})\n`);
      }
    }

    // Check transactions
    const { count: transactionCount, error: transError } = await supabase
      .from("Transaction")
      .select("id", { count: "exact", head: true })
      .eq("categoryId", categoryId);

    if (transError) {
      console.error(`❌ Error checking transactions for ${categoryId}:`, transError);
      continue;
    }

    if (transactionCount && transactionCount > 0) {
      const dupInfo = duplicatesInfo.find((d) => 
        d.delete.some((cat) => cat.id === categoryId)
      );
      
      if (dupInfo) {
        console.warn(`⚠️  Category ${categoryId} is used in ${transactionCount} transaction(s)`);
        console.warn(`   ✅ These transactions will be updated to use category ${dupInfo.keep.id} (${dupInfo.keep.name})\n`);
      }
    }
  }

  // Ask for confirmation
  console.log(`\n⚠️  WARNING: This will delete ${duplicatesToDelete.length} duplicate categories.`);
  console.log("   Make sure you have a backup of your database!\n");
  console.log("   To proceed, run this script with the --confirm flag:");
  console.log("   npm run cleanup:duplicates -- --confirm\n");

  // Check for --confirm flag
  const args = process.argv.slice(2);
  if (!args.includes("--confirm")) {
    console.log("❌ Aborted. Use --confirm flag to proceed.");
    process.exit(0);
  }

  console.log("🗑️  Deleting duplicate categories...\n");

  let deletedCount = 0;
  let errorCount = 0;
  let migratedSubcategories = 0;

  for (const dupInfo of duplicatesInfo) {
    const { keep, delete: toDelete } = dupInfo;

    for (const categoryToDelete of toDelete) {
      // First, migrate subcategories to the kept category
      const { data: subcategories, error: subFetchError } = await supabase
        .from("Subcategory")
        .select("id, name")
        .eq("categoryId", categoryToDelete.id);

      if (subFetchError) {
        console.error(`❌ Error fetching subcategories for ${categoryToDelete.id}:`, subFetchError);
        errorCount++;
        continue;
      }

      if (subcategories && subcategories.length > 0) {
        // Check which subcategories already exist in the kept category
        const { data: existingSubs, error: existingError } = await supabase
          .from("Subcategory")
          .select("name")
          .eq("categoryId", keep.id);

        if (existingError) {
          console.error(`❌ Error checking existing subcategories:`, existingError);
          errorCount++;
          continue;
        }

        const existingNames = new Set((existingSubs || []).map((s: any) => s.name.toLowerCase()));

        // Migrate subcategories that don't already exist
        for (const subcat of subcategories) {
          if (existingNames.has(subcat.name.toLowerCase())) {
            console.log(`   ⏭️  Skipping subcategory "${subcat.name}" (already exists in kept category)`);
            // Delete the duplicate subcategory
            await supabase
              .from("Subcategory")
              .delete()
              .eq("id", subcat.id);
          } else {
            // Migrate to kept category
            const { error: migrateError } = await supabase
              .from("Subcategory")
              .update({ categoryId: keep.id })
              .eq("id", subcat.id);

            if (migrateError) {
              console.error(`❌ Error migrating subcategory ${subcat.id}:`, migrateError);
            } else {
              migratedSubcategories++;
              console.log(`   ✅ Migrated subcategory "${subcat.name}" to kept category`);
            }
          }
        }
      }

      // Update transactions to use the kept category instead
      const { error: transError } = await supabase
        .from("Transaction")
        .update({ categoryId: keep.id })
        .eq("categoryId", categoryToDelete.id);

      if (transError) {
        console.error(`❌ Error updating transactions for ${categoryToDelete.id}:`, transError);
        errorCount++;
        continue;
      }

      // Delete the duplicate category (subcategories are already migrated or deleted)
      const { error: deleteError } = await supabase
        .from("Category")
        .delete()
        .eq("id", categoryToDelete.id);

      if (deleteError) {
        console.error(`❌ Error deleting category ${categoryToDelete.id}:`, deleteError);
        errorCount++;
        continue;
      }

      deletedCount++;
      console.log(`✅ Deleted duplicate category ${categoryToDelete.id} (${categoryToDelete.name})`);
    }
  }

  console.log(`\n✅ Cleanup complete!`);
  console.log(`   Deleted: ${deletedCount} duplicate categories`);
  console.log(`   Migrated: ${migratedSubcategories} subcategories to kept categories`);
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


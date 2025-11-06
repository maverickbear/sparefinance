#!/usr/bin/env tsx
/**
 * Script to check for duplicate subcategories in Supabase
 * Run with: npm run check:duplicate-subcategories
 */

// Load environment variables from .env.local
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase environment variables");
  console.log("\n💡 Please check your .env.local file:");
  console.log("   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co");
  console.log("   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key\n");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

async function checkDuplicates() {
  console.log("🔍 Checking for duplicate subcategories...\n");

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
        name,
        userId
      )
    `)
    .order("name", { ascending: true });

  if (error) {
    console.error("❌ Error fetching subcategories:", error);
    process.exit(1);
  }

  if (!subcategories || subcategories.length === 0) {
    console.log("✅ No subcategories found");
    return;
  }

  console.log(`Found ${subcategories.length} total subcategories\n`);

  // Check for duplicates by ID
  const idMap = new Map<string, Subcategory>();
  const duplicateIds: string[] = [];

  subcategories.forEach((subcat: any) => {
    if (idMap.has(subcat.id)) {
      duplicateIds.push(subcat.id);
      console.error(`❌ DUPLICATE ID FOUND: ${subcat.id} - ${subcat.name}`);
    }
    idMap.set(subcat.id, subcat);
  });

  // Check for duplicates by name + categoryId
  const nameMap = new Map<string, any[]>();

  subcategories.forEach((subcat: any) => {
    const key = `${subcat.name}-${subcat.categoryId}`;
    if (!nameMap.has(key)) {
      nameMap.set(key, []);
    }
    nameMap.get(key)!.push(subcat);
  });

  // Report duplicates
  let hasDuplicates = false;
  const duplicatesByCategory = new Map<string, any[]>();

  nameMap.forEach((subcats, key) => {
    if (subcats.length > 1) {
      hasDuplicates = true;
      const [name, categoryId] = key.split('-');
      const category = subcats[0].category;
      
      if (!duplicatesByCategory.has(categoryId)) {
        duplicatesByCategory.set(categoryId, []);
      }
      duplicatesByCategory.get(categoryId)!.push({ name, subcats });
    }
  });

  if (hasDuplicates) {
    console.log(`\n⚠️  Found ${nameMap.size - Array.from(nameMap.values()).filter(arr => arr.length === 1).length} duplicate subcategory groups:\n`);
    
    duplicatesByCategory.forEach((dups, categoryId) => {
      const category = dups[0].subcats[0].category;
      console.log(`📋 Category: ${category.name} (${categoryId})`);
      
      dups.forEach(({ name, subcats }) => {
        console.log(`   ⚠️  DUPLICATE: "${name}" (${subcats.length} occurrences)`);
        subcats.forEach((subcat: any) => {
          console.log(`      - ID: ${subcat.id}, Created: ${subcat.createdAt}`);
        });
      });
      console.log();
    });
  }

  if (!hasDuplicates && duplicateIds.length === 0) {
    console.log("✅ No duplicates found!");
  } else if (duplicateIds.length > 0) {
    console.log(`\n❌ Found ${duplicateIds.length} duplicate IDs in database`);
  }

  // Summary by category
  const categoryMap = new Map<string, number>();
  subcategories.forEach((subcat: any) => {
    const catId = subcat.categoryId;
    categoryMap.set(catId, (categoryMap.get(catId) || 0) + 1);
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Total subcategories: ${subcategories.length}`);
  console.log(`   Unique categories with subcategories: ${categoryMap.size}`);
  if (hasDuplicates) {
    console.log(`   ⚠️  Duplicate groups found: ${Array.from(nameMap.values()).filter(arr => arr.length > 1).length}`);
  }
}

checkDuplicates()
  .then(() => {
    console.log("\n✅ Check complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });


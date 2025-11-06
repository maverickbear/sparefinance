#!/usr/bin/env tsx
/**
 * Script to check for duplicate categories in Supabase
 * Run with: npm run check:duplicates
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

async function checkDuplicates() {
  // Get current user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    console.log("Not authenticated, checking system categories only");
    
    const { data, error } = await supabase
      .from("Category")
      .select(`
        id,
        name,
        macroId,
        userId,
        createdAt
      `)
      .is("userId", null)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
      return;
    }

    console.log(`\nFound ${data?.length || 0} system categories`);
    
    // Check for duplicates by name and macroId
    const nameMap = new Map<string, any[]>();
    const idMap = new Map<string, any>();
    
    data?.forEach((cat) => {
      const key = `${cat.name}-${cat.macroId}`;
      if (!nameMap.has(key)) {
        nameMap.set(key, []);
      }
      nameMap.get(key)!.push(cat);
      
      if (idMap.has(cat.id)) {
        console.error(`❌ DUPLICATE ID FOUND: ${cat.id} - ${cat.name}`);
      }
      idMap.set(cat.id, cat);
    });

    // Report duplicates
    let hasDuplicates = false;
    nameMap.forEach((categories, key) => {
      if (categories.length > 1) {
        hasDuplicates = true;
        console.log(`\n⚠️  DUPLICATE FOUND (name + macroId): ${key}`);
        categories.forEach((cat) => {
          console.log(`   - ID: ${cat.id}, Name: ${cat.name}, MacroId: ${cat.macroId}, Created: ${cat.createdAt}`);
        });
      }
    });

    if (!hasDuplicates) {
      console.log("✅ No duplicates found in system categories");
    }
    
    return;
  }

  console.log(`Checking categories for user: ${authUser.id}\n`);

  // Get all categories (system + user)
  const { data, error } = await supabase
    .from("Category")
    .select(`
      id,
      name,
      macroId,
      userId,
      createdAt
    `)
    .or(`userId.is.null,userId.eq.${authUser.id}`)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching categories:", error);
    return;
  }

  console.log(`Found ${data?.length || 0} total categories`);
  
  const systemCategories = data?.filter((cat) => cat.userId === null) || [];
  const userCategories = data?.filter((cat) => cat.userId === authUser.id) || [];
  
  console.log(`  - System categories: ${systemCategories.length}`);
  console.log(`  - User categories: ${userCategories.length}`);

  // Check for duplicates by ID
  const idMap = new Map<string, any>();
  const duplicateIds: string[] = [];
  
  data?.forEach((cat) => {
    if (idMap.has(cat.id)) {
      duplicateIds.push(cat.id);
      console.error(`❌ DUPLICATE ID FOUND: ${cat.id} - ${cat.name}`);
    }
    idMap.set(cat.id, cat);
  });

  // Check for duplicates by name + macroId + userId
  const nameMap = new Map<string, any[]>();
  
  data?.forEach((cat) => {
    const key = `${cat.name}-${cat.macroId}-${cat.userId || 'null'}`;
    if (!nameMap.has(key)) {
      nameMap.set(key, []);
    }
    nameMap.get(key)!.push(cat);
  });

  // Report duplicates
  let hasDuplicates = false;
  nameMap.forEach((categories, key) => {
    if (categories.length > 1) {
      hasDuplicates = true;
      const [name, macroId, userId] = key.split('-');
      console.log(`\n⚠️  DUPLICATE FOUND (name + macroId + userId): ${name} (Macro: ${macroId}, User: ${userId || 'system'})`);
      categories.forEach((cat) => {
        console.log(`   - ID: ${cat.id}, Created: ${cat.createdAt}`);
      });
    }
  });

  if (!hasDuplicates && duplicateIds.length === 0) {
    console.log("\n✅ No duplicates found!");
  } else if (duplicateIds.length > 0) {
    console.log(`\n❌ Found ${duplicateIds.length} duplicate IDs in database`);
  }
}

checkDuplicates()
  .then(() => {
    console.log("\n✅ Check complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });


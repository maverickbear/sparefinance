#!/usr/bin/env tsx
/**
 * Script to import logos for existing subcategories
 * Uses free logo APIs (Clearbit and Google Favicon)
 * 
 * Run with: npm run import:logos
 */

// Load environment variables from .env.local FIRST
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

// Now import Supabase client after env vars are loaded
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing Supabase environment variables");
  console.log("\n💡 Please check your .env.local file:");
  console.log("   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co");
  console.log("   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key\n");
  process.exit(1);
}

// Create service role client directly (bypasses RLS)
function createServiceRoleClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not set");
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Mapping of subcategory names to domains
const subcategoryDomainMap: Record<string, string> = {
  // Utilities
  "BC Hydro": "bchydro.com",
  "Fortis BC": "fortisbc.com",
  "Internet": "", // Generic, no specific logo
  "Maintenance": "", // Generic
  "Insurance": "", // Generic
  
  // Streaming
  "Netflix": "netflix.com",
  "Disney+": "disney.com",
  "YouTube": "youtube.com",
  "Spotify": "spotify.com",
  
  // Software
  "Adobe": "adobe.com",
  "ChatGPT": "openai.com",
  "Cloud": "", // Generic
  
  // Vehicle
  "Car Loan": "", // Generic
  "Car Insurance": "", // Generic
  "Fuel": "", // Generic
  "Parking": "", // Generic
  "Vehicle Maintenance": "", // Generic
  
  // Transit
  "Transit Pass": "", // Generic
  "Public Transit": "", // Generic
  
  // Food
  "Apollo": "", // Could be pet food brand, but not sure of domain
  
  // Health
  "Ozempic": "ozempic.com",
  "Naor": "", // Personal name
  "Natalia": "", // Personal name
  
  // Business
  "Office Rent (70%)": "", // Generic
  "Phone & Internet": "", // Generic
  "Equipment": "", // Generic
  "Hosting": "", // Generic
  "Accounting": "", // Generic
};

/**
 * Tries to infer the domain based on the subcategory name
 */
function inferDomain(subcategoryName: string): string | null {
  // First, check the direct mapping
  const mappedDomain = subcategoryDomainMap[subcategoryName];
  if (mappedDomain) {
    // If it's an empty string, it means it's generic and has no logo
    if (mappedDomain === "") {
      return null;
    }
    return mappedDomain;
  }
  
  // Try to infer based on the name
  const name = subcategoryName.toLowerCase().trim();
  
  // Remove special characters and spaces, but keep dots and hyphens
  let cleanName = name.replace(/[^a-z0-9.-]/g, "");
  
  // Remove dots and hyphens at the beginning/end
  cleanName = cleanName.replace(/^[.-]+|[.-]+$/g, "");
  
  // If the name already looks like a domain (has a dot)
  if (cleanName.includes(".")) {
    return cleanName;
  }
  
  // If the name looks like a known company (more than 3 characters)
  if (cleanName.length > 3 && cleanName.length < 30) {
    // Try some common variations
    return `${cleanName}.com`;
  }
  
  return null;
}

/**
 * Fetches logo using Clearbit Logo API
 */
async function getClearbitLogo(domain: string): Promise<string | null> {
  try {
    const url = `https://logo.clearbit.com/${domain}`;
    const response = await fetch(url, { method: "HEAD" });
    
    if (response.ok) {
      return url;
    }
  } catch (error) {
    console.error(`Error fetching Clearbit logo for ${domain}:`, error);
  }
  
  return null;
}

/**
 * Fetches logo using Google Favicon API (fallback)
 */
async function getGoogleFavicon(domain: string): Promise<string | null> {
  try {
    const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const response = await fetch(url, { method: "HEAD" });
    
    if (response.ok) {
      return url;
    }
  } catch (error) {
    console.error(`Error fetching Google favicon for ${domain}:`, error);
  }
  
  return null;
}

/**
 * Finds logo for a subcategory
 */
async function findLogoForSubcategory(subcategoryName: string): Promise<string | null> {
  const domain = inferDomain(subcategoryName);
  
  if (!domain) {
    console.log(`⚠️  Could not infer domain for: ${subcategoryName}`);
    return null;
  }
  
  console.log(`🔍 Searching for logo for "${subcategoryName}" (${domain})...`);
  
  // Try Clearbit first (better quality)
  const clearbitLogo = await getClearbitLogo(domain);
  if (clearbitLogo) {
    console.log(`✅ Logo found (Clearbit): ${clearbitLogo}`);
    return clearbitLogo;
  }
  
  // Fallback to Google Favicon
  const faviconLogo = await getGoogleFavicon(domain);
  if (faviconLogo) {
    console.log(`✅ Logo found (Google Favicon): ${faviconLogo}`);
    return faviconLogo;
  }
  
  console.log(`❌ Logo not found for: ${subcategoryName}`);
  return null;
}

/**
 * Updates a subcategory with the logo
 */
async function updateSubcategoryLogo(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subcategoryId: string,
  logo: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("Subcategory")
      .update({ logo, updatedAt: new Date().toISOString() })
      .eq("id", subcategoryId)
      .is("userId", null); // Only system subcategories
    
    if (error) {
      console.error(`❌ Error updating subcategory ${subcategoryId}:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error updating subcategory ${subcategoryId}:`, error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log("🚀 Starting logo import for subcategories...\n");
  
  const supabase = createServiceRoleClient();
  
  // Fetch all system subcategories (userId IS NULL)
  const { data: subcategories, error } = await supabase
    .from("Subcategory")
    .select("id, name, logo")
    .is("userId", null)
    .order("name");
  
  if (error) {
    console.error("❌ Error fetching subcategories:", error);
    process.exit(1);
  }
  
  if (!subcategories || subcategories.length === 0) {
    console.log("ℹ️  No subcategories found.");
    return;
  }
  
  console.log(`📋 Found ${subcategories.length} system subcategories.\n`);
  
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const subcategory of subcategories) {
    // Skip if it already has a logo
    if (subcategory.logo) {
      console.log(`⏭️  Skipping "${subcategory.name}" (already has logo)`);
      skipped++;
      continue;
    }
    
    // Find logo
    const logo = await findLogoForSubcategory(subcategory.name);
    
    if (logo) {
      // Update subcategory
      const success = await updateSubcategoryLogo(supabase, subcategory.id, logo);
      
      if (success) {
        updated++;
        console.log(`✅ Logo imported for "${subcategory.name}"\n`);
      } else {
        failed++;
        console.log(`❌ Failed to update "${subcategory.name}"\n`);
      }
    } else {
      skipped++;
      console.log(`⏭️  Skipping "${subcategory.name}" (logo not found)\n`);
    }
    
    // Small delay to avoid overloading the APIs
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log(`✅ Updated: ${updated}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log("=".repeat(50));
}

// Run the script
main()
  .then(() => {
    console.log("\n✨ Import completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });


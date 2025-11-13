#!/usr/bin/env tsx
/**
 * Script to sync plan features from database to Stripe products as metadata
 * Run with: npx tsx scripts/sync-features-to-stripe.ts
 */

// Load environment variables from .env.local
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { PlanFeatures } from "@/lib/validations/plan";

// Create Supabase client directly
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

interface Plan {
  id: string;
  name: string;
  features: PlanFeatures;
  stripeProductId: string | null;
}

// Feature definitions mapping our plan features to Stripe Features
const FEATURE_DEFINITIONS = [
  { lookupKey: "investments", name: "Investments", description: "Investment tracking and portfolio management" },
  { lookupKey: "household", name: "Household Members", description: "Add and manage household members" },
  { lookupKey: "advanced_reports", name: "Advanced Reports", description: "Access to advanced financial reports" },
  { lookupKey: "csv_export", name: "CSV Export", description: "Export data to CSV format" },
  { lookupKey: "debts", name: "Debt Tracking", description: "Track and manage debts" },
  { lookupKey: "goals", name: "Goals", description: "Set and track financial goals" },
  { lookupKey: "bank_integration", name: "Bank Integration", description: "Connect bank accounts via Plaid" },
] as const;

/**
 * Create or update a Stripe Feature
 */
async function ensureStripeFeature(
  stripe: Stripe,
  lookupKey: string,
  name: string,
  description: string
): Promise<string> {
  try {
    // Try to find existing feature
    const existingFeatures = await stripe.entitlements.features.list({
      lookup_key: lookupKey,
      limit: 1,
    });

    if (existingFeatures.data.length > 0) {
      // Update existing feature
      const feature = await stripe.entitlements.features.update(
        existingFeatures.data[0].id,
        {
          name,
          metadata: {
            description,
          },
        }
      );
      console.log(`   ✅ Updated feature: ${name} (${lookupKey})`);
      return feature.id;
    } else {
      // Create new feature
      const feature = await stripe.entitlements.features.create({
        lookup_key: lookupKey,
        name,
        metadata: {
          description,
        },
      });
      console.log(`   ✅ Created feature: ${name} (${lookupKey})`);
      return feature.id;
    }
  } catch (error: any) {
    console.error(`   ❌ Error ensuring feature ${lookupKey}:`, error.message);
    throw error;
  }
}

async function syncFeaturesToStripe() {
  console.log("🔄 Syncing plan features to Stripe using Features API...\n");

  // Check environment variables
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ STRIPE_SECRET_KEY is not set");
    process.exit(1);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover",
    typescript: true,
  });

  const supabase = createSupabaseClient();

  // First, ensure all features exist in Stripe
  console.log("📋 Creating/updating Stripe Features...\n");
  const featureMap = new Map<string, string>(); // lookupKey -> featureId
  
  for (const featureDef of FEATURE_DEFINITIONS) {
    try {
      const featureId = await ensureStripeFeature(
        stripe,
        featureDef.lookupKey,
        featureDef.name,
        featureDef.description
      );
      featureMap.set(featureDef.lookupKey, featureId);
    } catch (error) {
      console.error(`   ⚠️  Skipping feature ${featureDef.lookupKey} due to error`);
    }
  }

  console.log("");

  // Fetch plans from database
  console.log("📊 Fetching plans from database...\n");
  const { data: plans, error } = await supabase
    .from("Plan")
    .select("id, name, features, stripeProductId")
    .in("id", ["basic", "premium"]);

  if (error) {
    console.error("❌ Error fetching plans:", error.message);
    process.exit(1);
  }

  if (!plans || plans.length === 0) {
    console.error("❌ No plans found in database");
    process.exit(1);
  }

  console.log(`✅ Found ${plans.length} plan(s)\n`);

  // Sync each plan to Stripe
  for (const plan of plans as Plan[]) {
    console.log(`📦 Processing ${plan.id} plan...`);

    if (!plan.stripeProductId) {
      console.log(`   ⚠️  Skipping ${plan.id}: No Stripe Product ID configured`);
      continue;
    }

    try {
      // Retrieve the product from Stripe
      const product = await stripe.products.retrieve(plan.stripeProductId);
      console.log(`   ✅ Found product: ${product.name} (${product.id})`);

      // Map our features to Stripe Features
      const featureMap_local: Record<string, boolean> = {
        investments: plan.features.hasInvestments,
        household: plan.features.hasHousehold,
        advanced_reports: plan.features.hasAdvancedReports,
        csv_export: plan.features.hasCsvExport,
        debts: plan.features.hasDebts,
        goals: plan.features.hasGoals,
        bank_integration: plan.features.hasBankIntegration,
      };

      // Collect feature IDs for this plan
      const planFeatureIds: string[] = [];
      for (const [lookupKey, enabled] of Object.entries(featureMap_local)) {
        if (enabled && featureMap.has(lookupKey)) {
          planFeatureIds.push(featureMap.get(lookupKey)!);
        }
      }

      // Update product with metadata (including feature IDs)
      const metadata: Record<string, string> = {
        planId: plan.id,
        planName: plan.name,
        // Individual feature flags
        hasInvestments: String(plan.features.hasInvestments),
        hasAdvancedReports: String(plan.features.hasAdvancedReports),
        hasCsvExport: String(plan.features.hasCsvExport),
        hasDebts: String(plan.features.hasDebts),
        hasGoals: String(plan.features.hasGoals),
        hasBankIntegration: String(plan.features.hasBankIntegration),
        hasHousehold: String(plan.features.hasHousehold),
        // Limits
        maxTransactions: String(plan.features.maxTransactions),
        maxAccounts: String(plan.features.maxAccounts),
        // Feature IDs (comma-separated) - for reference
        featureIds: planFeatureIds.join(","),
        // Full features JSON (for reference)
        features: JSON.stringify(plan.features),
      };

      await stripe.products.update(plan.stripeProductId, {
        metadata,
      });

      console.log(`   ✅ Updated product for ${plan.id}`);
      console.log(`      Features enabled:`);
      for (const [lookupKey, enabled] of Object.entries(featureMap_local)) {
        if (enabled) {
          const featureDef = FEATURE_DEFINITIONS.find(f => f.lookupKey === lookupKey);
          console.log(`        ✓ ${featureDef?.name || lookupKey}`);
        }
      }
      console.log(`      Limits:`);
      console.log(`        - Max Transactions: ${plan.features.maxTransactions === -1 ? "Unlimited" : plan.features.maxTransactions}`);
      console.log(`        - Max Accounts: ${plan.features.maxAccounts === -1 ? "Unlimited" : plan.features.maxAccounts}`);
      console.log("");
    } catch (error: any) {
      if (error.code === "resource_missing") {
        console.error(`   ❌ Product ${plan.stripeProductId} not found in Stripe`);
      } else {
        console.error(`   ❌ Error updating product ${plan.stripeProductId}:`, error.message);
      }
    }
  }

  console.log("✅ Feature sync completed!\n");
  console.log("💡 You can verify the features in Stripe Dashboard:");
  console.log("   1. Go to Products > Select a product");
  console.log("   2. Check the 'Metadata' section for feature flags");
  console.log("   3. Go to Features section to see created features");
  console.log("   4. Features are now available to associate with products\n");
}

syncFeaturesToStripe().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});


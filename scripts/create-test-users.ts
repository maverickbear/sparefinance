/**
 * Script para criar usuários de teste para cada cenário de subscription
 * 
 * Uso: npx tsx scripts/create-test-users.ts
 * 
 * Este script cria usuários com diferentes estados de subscription para testar
 * todos os cenários documentados em docs/SUBSCRIPTION_SCENARIOS.md
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables from .env.local
function loadEnvFile() {
  try {
    const envPath = join(process.cwd(), ".env.local");
    const envFile = readFileSync(envPath, "utf-8");
    const lines = envFile.split("\n");
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }
      
      // Match KEY=VALUE or KEY="VALUE" or KEY='VALUE'
      const match = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Only set if not already in process.env (system env takes precedence)
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch (error: any) {
    // .env.local might not exist, that's okay
    if (error.code !== "ENOENT") {
      console.warn("⚠️  Could not load .env.local file:", error.message);
    }
  }
}

// Load environment variables
loadEnvFile();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("\n❌ Missing Supabase environment variables!");
  console.error("\nRequired variables:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  console.error("\n💡 Please check your .env.local file in the project root.");
  console.error("   Make sure these variables are set.\n");
  process.exit(1);
}

// Use service role client to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface TestUser {
  email: string;
  password: string;
  name: string;
  scenario: string;
  subscription?: {
    planId: string;
    status: "active" | "trialing" | "cancelled" | "past_due";
    trialStartDate?: Date;
    trialEndDate?: Date;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
  };
}

const testUsers: TestUser[] = [
  // 1. INÍCIO DE TRIAL
  {
    email: "trial-start@test.com",
    password: "Test123!@#",
    name: "Trial Start User",
    scenario: "1. INÍCIO DE TRIAL",
    subscription: {
      planId: "basic",
      status: "trialing",
      trialStartDate: new Date(),
      trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    },
  },
  
  // 2. TRIAL ATIVO
  {
    email: "trial-active@test.com",
    password: "Test123!@#",
    name: "Trial Active User",
    scenario: "2. TRIAL ATIVO",
    subscription: {
      planId: "premium",
      status: "trialing",
      trialStartDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      trialEndDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000), // 9 days from now
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    },
  },
  
  // 3. EXPIRAÇÃO DO TRIAL (sem payment method - será cancelled)
  {
    email: "trial-expired@test.com",
    password: "Test123!@#",
    name: "Trial Expired User",
    scenario: "3. EXPIRAÇÃO DO TRIAL (sem payment)",
    subscription: {
      planId: "basic",
      status: "trialing", // Status ainda é trialing, mas trialEndDate passou
      trialStartDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      trialEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago (expired)
      currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    },
  },
  
  // 4. ASSINATURA PAGA (CHECKOUT)
  {
    email: "checkout-paid@test.com",
    password: "Test123!@#",
    name: "Checkout Paid User",
    scenario: "4. ASSINATURA PAGA (CHECKOUT)",
    subscription: {
      planId: "premium",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      cancelAtPeriodEnd: false,
    },
  },
  
  // 5. RENOVAÇÃO AUTOMÁTICA
  {
    email: "auto-renewal@test.com",
    password: "Test123!@#",
    name: "Auto Renewal User",
    scenario: "5. RENOVAÇÃO AUTOMÁTICA",
    subscription: {
      planId: "basic",
      status: "active",
      currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      currentPeriodEnd: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now (renewing soon)
      cancelAtPeriodEnd: false,
    },
  },
  
  // 6. FALHA NO PAGAMENTO
  {
    email: "payment-failed@test.com",
    password: "Test123!@#",
    name: "Payment Failed User",
    scenario: "6. FALHA NO PAGAMENTO",
    subscription: {
      planId: "premium",
      status: "past_due",
      currentPeriodStart: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      currentPeriodEnd: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (overdue)
      cancelAtPeriodEnd: false,
    },
  },
  
  // 7. CANCELAMENTO NO FINAL DO PERÍODO
  {
    email: "cancel-end-period@test.com",
    password: "Test123!@#",
    name: "Cancel End Period User",
    scenario: "7. CANCELAMENTO NO FINAL DO PERÍODO",
    subscription: {
      planId: "basic",
      status: "active",
      currentPeriodStart: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      cancelAtPeriodEnd: true, // Cancelará no final do período
    },
  },
  
  // 8. CANCELAMENTO IMEDIATO
  {
    email: "cancel-immediate@test.com",
    password: "Test123!@#",
    name: "Cancel Immediate User",
    scenario: "8. CANCELAMENTO IMEDIATO",
    subscription: {
      planId: "premium",
      status: "cancelled",
      currentPeriodStart: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now (but cancelled)
      cancelAtPeriodEnd: false,
    },
  },
  
  // 9. TROCA DE PLANO (usuário com subscription ativa)
  {
    email: "plan-change@test.com",
    password: "Test123!@#",
    name: "Plan Change User",
    scenario: "9. TROCA DE PLANO",
    subscription: {
      planId: "basic",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    },
  },
  
  // 10. SEM SUBSCRIPTION (usuário novo)
  {
    email: "no-subscription@test.com",
    password: "Test123!@#",
    name: "No Subscription User",
    scenario: "10. SEM SUBSCRIPTION",
    // Sem subscription
  },
];

async function createTestUser(user: TestUser): Promise<void> {
  console.log(`\n📝 Creating user: ${user.email} (${user.scenario})`);
  
  try {
    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: user.name,
      },
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create auth user: ${authError?.message}`);
    }

    const userId = authData.user.id;
    console.log(`  ✅ Auth user created: ${userId}`);

    // 2. Create user profile in User table
    const { error: userError } = await supabase
      .from("User")
      .insert({
        id: userId,
        email: user.email,
        name: user.name,
        role: "admin",
      });

    if (userError) {
      // User might already exist in User table, try to update
      const { error: updateError } = await supabase
        .from("User")
        .update({
          name: user.name,
          role: "admin",
        })
        .eq("id", userId);

      if (updateError) {
        throw new Error(`Failed to create/update user profile: ${updateError.message}`);
      }
      console.log(`  ✅ User profile updated`);
    } else {
      console.log(`  ✅ User profile created`);
    }

    // 3. Create household member record (owner is also a member)
    const invitationToken = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const { error: memberError } = await supabase
      .from("HouseholdMember")
      .upsert({
        ownerId: userId,
        memberId: userId,
        email: user.email,
        name: user.name,
        status: "active",
        invitationToken,
        invitedAt: now,
        acceptedAt: now,
        role: "admin",
      }, {
        onConflict: "ownerId,memberId",
      });

    if (memberError) {
      console.warn(`  ⚠️  Failed to create household member: ${memberError.message}`);
    } else {
      console.log(`  ✅ Household member record created`);
    }

    // 4. Create subscription if provided
    if (user.subscription) {
      const subscriptionId = `${userId}-${user.subscription.planId}`;
      const subscriptionData: any = {
        id: subscriptionId,
        userId: userId,
        planId: user.subscription.planId,
        status: user.subscription.status,
        cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (user.subscription.trialStartDate) {
        subscriptionData.trialStartDate = user.subscription.trialStartDate.toISOString();
      }
      if (user.subscription.trialEndDate) {
        subscriptionData.trialEndDate = user.subscription.trialEndDate.toISOString();
      }
      if (user.subscription.currentPeriodStart) {
        subscriptionData.currentPeriodStart = user.subscription.currentPeriodStart.toISOString();
      }
      if (user.subscription.currentPeriodEnd) {
        subscriptionData.currentPeriodEnd = user.subscription.currentPeriodEnd.toISOString();
      }

      const { error: subError } = await supabase
        .from("Subscription")
        .upsert(subscriptionData, {
          onConflict: "id",
        });

      if (subError) {
        throw new Error(`Failed to create subscription: ${subError.message}`);
      }
      console.log(`  ✅ Subscription created: ${subscriptionData.status} (${user.subscription.planId})`);
    }

    console.log(`  ✅ User ${user.email} created successfully!`);
    console.log(`  📧 Email: ${user.email}`);
    console.log(`  🔑 Password: ${user.password}`);
    
  } catch (error) {
    console.error(`  ❌ Error creating user ${user.email}:`, error);
    throw error;
  }
}

async function main() {
  console.log("🚀 Starting test users creation...");
  console.log(`📊 Total users to create: ${testUsers.length}\n`);

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const user of testUsers) {
    try {
      await createTestUser(user);
      results.success++;
    } catch (error) {
      results.failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.errors.push(`${user.email}: ${errorMsg}`);
      console.error(`  ❌ Failed to create ${user.email}: ${errorMsg}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Success: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log("\n❌ Errors:");
    results.errors.forEach((error) => console.log(`  - ${error}`));
  }

  console.log("\n📋 TEST USERS CREATED:");
  console.log("=".repeat(60));
  testUsers.forEach((user) => {
    console.log(`\n${user.scenario}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Password: ${user.password}`);
    if (user.subscription) {
      console.log(`  Subscription: ${user.subscription.status} (${user.subscription.planId})`);
      if (user.subscription.trialEndDate) {
        const isExpired = user.subscription.trialEndDate < new Date();
        console.log(`  Trial: ${isExpired ? "EXPIRED" : "ACTIVE"} (ends: ${user.subscription.trialEndDate.toISOString()})`);
      }
    } else {
      console.log(`  Subscription: NONE`);
    }
  });

  console.log("\n✅ Done!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});


/**
 * Subscription Scenarios Tests
 * 
 * Tests para validar todos os cenários de subscription documentados em
 * docs/SUBSCRIPTION_SCENARIOS.md usando os usuários de teste criados.
 * 
 * Execute: npm test -- subscription-scenarios.test.ts
 */

import { createClient } from "@supabase/supabase-js";

// Test users from create-test-users.ts
const TEST_USERS = [
  {
    email: "trial-start@test.com",
    password: "Test123!@#",
    scenario: "1. INÍCIO DE TRIAL",
    expectedStatus: "trialing",
    expectedPlan: "basic",
    shouldHaveTrial: true,
    trialShouldBeValid: true,
    shouldAllowWrite: true,
  },
  {
    email: "trial-active@test.com",
    password: "Test123!@#",
    scenario: "2. TRIAL ATIVO",
    expectedStatus: "trialing",
    expectedPlan: "premium",
    shouldHaveTrial: true,
    trialShouldBeValid: true,
    shouldAllowWrite: true,
  },
  {
    email: "trial-expired@test.com",
    password: "Test123!@#",
    scenario: "3. EXPIRAÇÃO DO TRIAL",
    expectedStatus: "trialing",
    expectedPlan: "basic",
    shouldHaveTrial: true,
    trialShouldBeValid: false, // Trial expired
    shouldAllowWrite: false, // Should block writes when trial expired
  },
  {
    email: "checkout-paid@test.com",
    password: "Test123!@#",
    scenario: "4. ASSINATURA PAGA (CHECKOUT)",
    expectedStatus: "active",
    expectedPlan: "premium",
    shouldHaveTrial: false,
    trialShouldBeValid: true,
    shouldAllowWrite: true,
  },
  {
    email: "auto-renewal@test.com",
    password: "Test123!@#",
    scenario: "5. RENOVAÇÃO AUTOMÁTICA",
    expectedStatus: "active",
    expectedPlan: "basic",
    shouldHaveTrial: false,
    trialShouldBeValid: true,
    shouldAllowWrite: true,
  },
  {
    email: "payment-failed@test.com",
    password: "Test123!@#",
    scenario: "6. FALHA NO PAGAMENTO",
    expectedStatus: "past_due",
    expectedPlan: "premium",
    shouldHaveTrial: false,
    trialShouldBeValid: true,
    shouldAllowWrite: false, // Should block writes when past_due
  },
  {
    email: "cancel-end-period@test.com",
    password: "Test123!@#",
    scenario: "7. CANCELAMENTO NO FINAL DO PERÍODO",
    expectedStatus: "active",
    expectedPlan: "basic",
    shouldHaveTrial: false,
    trialShouldBeValid: true,
    shouldAllowWrite: true, // Still active until period ends
    cancelAtPeriodEnd: true,
  },
  {
    email: "cancel-immediate@test.com",
    password: "Test123!@#",
    scenario: "8. CANCELAMENTO IMEDIATO",
    expectedStatus: "cancelled",
    expectedPlan: "premium",
    shouldHaveTrial: false,
    trialShouldBeValid: true,
    shouldAllowWrite: false, // Should block writes when cancelled
  },
  {
    email: "plan-change@test.com",
    password: "Test123!@#",
    scenario: "9. TROCA DE PLANO",
    expectedStatus: "active",
    expectedPlan: "basic",
    shouldHaveTrial: false,
    trialShouldBeValid: true,
    shouldAllowWrite: true,
  },
  {
    email: "no-subscription@test.com",
    password: "Test123!@#",
    scenario: "10. SEM SUBSCRIPTION",
    expectedStatus: null,
    expectedPlan: null,
    shouldHaveTrial: false,
    trialShouldBeValid: false,
    shouldAllowWrite: false, // Should block writes when no subscription
  },
];

// Helper function to check if trial is valid
function isTrialValid(subscription: any): boolean {
  if (subscription.status !== "trialing") {
    return true; // Not a trial, so it's valid
  }
  
  if (!subscription.trialEndDate) {
    return false; // Trial without end date is invalid
  }
  
  const trialEndDate = new Date(subscription.trialEndDate);
  const now = new Date();
  
  return trialEndDate > now; // Trial is valid if end date is in the future
}

// Helper function to check if user can write
function canWrite(subscription: any): boolean {
  if (!subscription) {
    return false;
  }

  // User can write if subscription is active
  if (subscription.status === "active") {
    return true;
  }

  // User can write if trial is active and valid
  if (subscription.status === "trialing") {
    return isTrialValid(subscription);
  }

  // All other statuses (cancelled, past_due) block writes
  return false;
}

describe("Subscription Scenarios Tests", () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️  Supabase environment variables not set. Skipping integration tests.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  describe("Test User Authentication and Subscription Status", () => {
    TEST_USERS.forEach((testUser) => {
      describe(testUser.scenario, () => {
        let userId: string | null = null;
        let subscription: any = null;

        beforeAll(async () => {
          // Sign in as test user
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: testUser.email,
            password: testUser.password,
          });

          if (authError || !authData.user) {
            throw new Error(`Failed to sign in as ${testUser.email}: ${authError?.message}`);
          }

          userId = authData.user.id;

          // Get user's subscription
          const { data: subData, error: subError } = await supabase
            .from("Subscription")
            .select("*")
            .eq("userId", userId)
            .in("status", ["active", "trialing", "cancelled", "past_due"])
            .order("createdAt", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (subError && subError.code !== "PGRST116") {
            throw new Error(`Failed to get subscription: ${subError.message}`);
          }

          subscription = subData;
        });

        afterAll(async () => {
          // Sign out
          await supabase.auth.signOut();
        });

        it("should authenticate successfully", () => {
          expect(userId).toBeTruthy();
        });

        it(`should have correct subscription status: ${testUser.expectedStatus || "null"}`, () => {
          if (testUser.expectedStatus === null) {
            expect(subscription).toBeNull();
          } else {
            expect(subscription).toBeTruthy();
            expect(subscription.status).toBe(testUser.expectedStatus);
          }
        });

        it(`should have correct plan: ${testUser.expectedPlan || "null"}`, () => {
          if (testUser.expectedPlan === null) {
            expect(subscription).toBeNull();
          } else {
            expect(subscription).toBeTruthy();
            expect(subscription.planId).toBe(testUser.expectedPlan);
          }
        });

        it(`should ${testUser.shouldHaveTrial ? "have" : "not have"} trial dates`, () => {
          if (testUser.shouldHaveTrial) {
            expect(subscription).toBeTruthy();
            expect(subscription.trialStartDate).toBeTruthy();
            expect(subscription.trialEndDate).toBeTruthy();
          } else {
            if (subscription) {
              // If subscription exists, it might not have trial dates
              expect(subscription.trialStartDate || subscription.trialEndDate).toBeFalsy();
            }
          }
        });

        it(`should ${testUser.trialShouldBeValid ? "have valid" : "have invalid or no"} trial`, () => {
          if (!subscription) {
            expect(testUser.trialShouldBeValid).toBe(false);
            return;
          }

          const isValid = isTrialValid(subscription);
          expect(isValid).toBe(testUser.trialShouldBeValid);
        });

        it(`should ${testUser.shouldAllowWrite ? "allow" : "block"} write operations`, () => {
          const canUserWrite = canWrite(subscription);
          expect(canUserWrite).toBe(testUser.shouldAllowWrite);
        });

        if (testUser.cancelAtPeriodEnd !== undefined) {
          it("should have cancelAtPeriodEnd set correctly", () => {
            expect(subscription).toBeTruthy();
            expect(subscription.cancelAtPeriodEnd).toBe(testUser.cancelAtPeriodEnd);
          });
        }
      });
    });
  });

  describe("Trial Validation Logic", () => {
    it("should validate active trial", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      };
      expect(isTrialValid(subscription)).toBe(true);
    });

    it("should invalidate expired trial", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      };
      expect(isTrialValid(subscription)).toBe(false);
    });

    it("should invalidate trial without end date", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: null,
      };
      expect(isTrialValid(subscription)).toBe(false);
    });

    it("should validate non-trial subscriptions", () => {
      const subscription = {
        status: "active",
        trialEndDate: null,
      };
      expect(isTrialValid(subscription)).toBe(true);
    });
  });

  describe("Write Access Logic", () => {
    it("should allow writes for active subscription", () => {
      const subscription = {
        status: "active",
      };
      expect(canWrite(subscription)).toBe(true);
    });

    it("should allow writes for valid trial", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      expect(canWrite(subscription)).toBe(true);
    });

    it("should block writes for expired trial", () => {
      const subscription = {
        status: "trialing",
        trialEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      };
      expect(canWrite(subscription)).toBe(false);
    });

    it("should block writes for cancelled subscription", () => {
      const subscription = {
        status: "cancelled",
      };
      expect(canWrite(subscription)).toBe(false);
    });

    it("should block writes for past_due subscription", () => {
      const subscription = {
        status: "past_due",
      };
      expect(canWrite(subscription)).toBe(false);
    });

    it("should block writes when no subscription", () => {
      expect(canWrite(null)).toBe(false);
    });
  });

  describe("Subscription Status Mapping", () => {
    it("should handle all valid subscription statuses", () => {
      const validStatuses = ["active", "trialing", "cancelled", "past_due"];
      
      validStatuses.forEach((status) => {
        const subscription = { status };
        // Should not throw error
        expect(() => canWrite(subscription)).not.toThrow();
      });
    });
  });
});


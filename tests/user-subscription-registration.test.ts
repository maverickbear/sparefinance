/**
 * User registration with subscription – integration test
 *
 * Validates that when a user completes registration and starts a trial subscription,
 * the subscription is created in both Stripe and Supabase (app_subscriptions).
 *
 * Requires:
 * - .env.local with NEXT_PUBLIC_SUPABASE_*, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY),
 *   STRIPE_SECRET_KEY (Stripe test key)
 * - app_plans must have at least one plan with stripe_price_id_monthly set
 *
 * Run: npm test -- user-subscription-registration.test.ts
 */

import { createClient, Session } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let testSession: { access_token: string; refresh_token: string } | null = null;

jest.mock("@/src/infrastructure/database/supabase-server", () => {
  const actual = jest.requireActual("@/src/infrastructure/database/supabase-server");
  return {
    ...actual,
    createServerClient: async (accessToken?: string, refreshToken?: string) => {
      if (accessToken && refreshToken) {
        return actual.createServerClient(accessToken, refreshToken);
      }
      if (testSession) {
        const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
        const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false },
        });
        await client.auth.setSession({
          access_token: testSession.access_token,
          refresh_token: testSession.refresh_token,
        });
        return client;
      }
      return actual.createServerClient();
    },
  };
});

describe("User registration with subscription", () => {
  const planId = "pro";
  let testUserId: string;
  let supabaseAnon: ReturnType<typeof createClient>;
  let supabaseService: ReturnType<typeof createClient>;
  let stripe: Stripe;

  beforeAll(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn(
        "⚠️  Supabase env vars not set. Skipping user-subscription-registration tests."
      );
      return;
    }
    if (!stripeSecretKey) {
      console.warn(
        "⚠️  STRIPE_SECRET_KEY not set. Skipping user-subscription-registration tests."
      );
      return;
    }
    supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    if (supabaseServiceKey) {
      supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    }
    stripe = new Stripe(stripeSecretKey!, { apiVersion: "2025-10-29.clover" });
  });

  async function createTestUser(): Promise<{ userId: string; session: Session }> {
    const email = `sub-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.com`;
    const password = "TestSubscription123!@#";

    if (!supabaseServiceKey) {
      throw new Error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY required to create test user (email_confirm)");
    }

    const { data: adminUser, error: createError } = await supabaseService.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !adminUser.user) {
      throw new Error(`Admin createUser failed: ${createError?.message ?? "no user"}`);
    }

    const userId = adminUser.user.id;

    const { error: userInsertError } = await supabaseService
      .from("users")
      .upsert(
        {
          id: userId,
          email,
          name: "Subscription Test User",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (userInsertError) {
      console.warn("Optional users upsert failed (trigger may have created row):", userInsertError.message);
    }

    const { data: signInData, error: signInError } =
      await supabaseAnon.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.session) {
      throw new Error(`SignIn after createUser failed: ${signInError?.message ?? "no session"}`);
    }

    return { userId, session: signInData.session };
  }

  it("should create subscription in Stripe and Supabase when user starts trial", async () => {
    if (!supabaseUrl || !supabaseAnonKey || !stripeSecretKey || !supabaseServiceKey) {
      console.warn(
        "Skipping: set NEXT_PUBLIC_SUPABASE_*, SUPABASE_SECRET_KEY (or SERVICE_ROLE), STRIPE_SECRET_KEY in .env.local"
      );
      return;
    }

    const { userId, session } = await createTestUser();
    testUserId = userId;
    testSession = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    };

    const { makeTrialService } = await import("@/src/application/trial/trial.factory");
    const trialService = makeTrialService();
    const result = await trialService.startTrial(userId, planId);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.subscription).toBeDefined();

    const subscriptionId = `${userId}-${planId}`;
    const sub = result.subscription as { stripe_subscription_id?: string; stripe_customer_id?: string } | undefined;
    const stripeSubId = sub?.stripe_subscription_id;
    const stripeCustId = sub?.stripe_customer_id;

    expect(stripeSubId).toBeTruthy();
    expect(stripeCustId).toBeTruthy();

    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubId as string);
    expect(stripeSubscription).toBeDefined();
    expect(stripeSubscription.status).toBe("trialing");
    expect(stripeSubscription.customer).toBe(stripeCustId);
    expect(stripeSubscription.metadata?.userId).toBe(userId);
    expect(stripeSubscription.metadata?.planId).toBe(planId);

    if (supabaseServiceKey) {
      const { data: row, error: subError } = await supabaseService
        .from("app_subscriptions")
        .select("id, user_id, plan_id, status, stripe_subscription_id, stripe_customer_id, trial_end_date")
        .eq("id", subscriptionId)
        .single();

      expect(subError).toBeNull();
      expect(row).toBeDefined();
      expect(row?.id).toBe(subscriptionId);
      expect(row?.user_id).toBe(userId);
      expect(row?.plan_id).toBe(planId);
      expect(row?.status).toBe("trialing");
      expect(row?.stripe_subscription_id).toBe(stripeSubId);
      expect(row?.stripe_customer_id).toBe(stripeCustId);
      expect(row?.trial_end_date).toBeTruthy();
    }

    testSession = null;
  }, 30000);
});

/**
 * Trial Service
 * Business logic for starting trial subscriptions without payment method
 */

import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { getStripeClient } from "@/src/infrastructure/external/stripe/stripe-client";
import { makeSubscriptionsService } from "../subscriptions/subscriptions.factory";
import { makeMembersService } from "../members/members.factory";
import { logger } from "@/src/infrastructure/utils/logger";

export interface StartTrialResult {
  success: boolean;
  subscription?: any;
  trialEndDate?: string;
  error?: string;
}

export class TrialService {
  /**
   * Start a trial subscription for a user without requiring payment method
   */
  async startTrial(userId: string, planId: string): Promise<StartTrialResult> {
    try {
      const supabase = await createServerClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser || authUser.id !== userId) {
        return { success: false, error: "Unauthorized" };
      }

      // Verify plan exists
      const { data: plan, error: planError } = await supabase
        .from("app_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return { success: false, error: "Plan not found" };
      }

      // Check if user already has an active subscription or trial
      const { data: existingSubscriptions, error: subError } = await supabase
        .from("app_subscriptions")
        .select("*")
        .eq("user_id", authUser.id)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false });

      if (subError) {
        logger.error("[TrialService] Error checking existing subscriptions:", subError);
        return { success: false, error: "Failed to check existing subscriptions" };
      }

      // If user already has an active subscription or trial, return error
      if (existingSubscriptions && existingSubscriptions.length > 0) {
        return { success: false, error: "User already has an active subscription or trial" };
      }

      // Check if user already had a trial before (cancelled subscription with trialEndDate)
      const { data: cancelledSubscriptions, error: cancelledError } = await supabase
        .from("app_subscriptions")
        .select("trial_end_date")
        .eq("user_id", authUser.id)
        .eq("status", "cancelled")
        .not("trial_end_date", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelledError && cancelledError.code !== "PGRST116") {
        logger.error("[TrialService] Error checking cancelled subscriptions:", cancelledError);
      }

      // If user already had a trial (cancelled subscription with trial_end_date), don't allow another trial
      if (cancelledSubscriptions && cancelledSubscriptions.trial_end_date) {
        return { success: false, error: "You have already used your trial period. Please subscribe to a plan." };
      }

      // Calculate trial dates (30 days from now)
      const trialStartDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      // Get or create Stripe customer
      let customerId: string;
      const { data: existingSubscription } = await supabase
        .from("app_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", authUser.id)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get user name from User table
      const { data: userData } = await supabase
        .from("users")
        .select("name")
        .eq("id", authUser.id)
        .single();

      // Get or create active household ID for the user
      let householdId = await getActiveHouseholdId(authUser.id);
      
      if (!householdId) {
        // CRITICAL: Create personal household if it doesn't exist
        // This ensures users can start trials even if household wasn't created during signup
        logger.info("[TrialService] No active household found, creating personal household for user:", authUser.id);
        
        try {
          const membersService = makeMembersService();
          const householdName = userData?.name ? `${userData.name}'s Account` : "Minha Conta";
          
          const newHousehold = await membersService.createHousehold(
            authUser.id,
            householdName,
            'personal'
          );
          
          householdId = newHousehold.id;
          logger.info("[TrialService] Personal household created successfully:", { userId: authUser.id, householdId });
        } catch (householdError) {
          logger.error("[TrialService] Error creating personal household:", householdError);
          return { 
            success: false, 
            error: "Failed to create household. Please contact support." 
          };
        }
      }

      if (existingSubscription?.stripe_customer_id) {
        customerId = existingSubscription.stripe_customer_id;
        logger.info("[TrialService] Using existing Stripe customer:", customerId);
        
        // Update existing customer with current email and name
        try {
          const stripe = getStripeClient();
          await stripe.customers.update(customerId, {
            email: authUser.email!,
            name: userData?.name || undefined,
            metadata: {
              userId: authUser.id,
            },
          });
          logger.info("[TrialService] Updated existing Stripe customer with email and name:", { 
            customerId, 
            email: authUser.email, 
            name: userData?.name 
          });
        } catch (updateError) {
          logger.error("[TrialService] Error updating existing Stripe customer:", updateError);
          // Continue anyway - customer exists, just couldn't update
        }
      } else {
        // Create Stripe customer
        logger.info("[TrialService] Creating new Stripe customer for user:", authUser.id);
        const stripe = getStripeClient();
        const customer = await stripe.customers.create({
          email: authUser.email!,
          name: userData?.name || undefined,
          metadata: {
            userId: authUser.id,
          },
        });
        customerId = customer.id;
        logger.info("[TrialService] Stripe customer created:", { customerId, email: authUser.email, name: userData?.name });
      }

      // Get price ID (default to monthly)
      const priceId = plan.stripe_price_id_monthly;
      if (!priceId) {
        return { success: false, error: "Stripe price ID not configured for this plan" };
      }

      // Create subscription in Stripe with trial period
      // Using payment_behavior: "default_incomplete" allows trial without payment method
      // The subscription will be in "incomplete" status until payment method is added
      logger.info("[TrialService] Creating Stripe subscription with trial:", { customerId, priceId });
      const stripe = getStripeClient();
      const stripeSubscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: 30,
        payment_behavior: "default_incomplete",
        payment_settings: {
          payment_method_types: ["card"],
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          userId: authUser.id,
          planId: planId,
        },
      });

      logger.info("[TrialService] Stripe subscription created:", {
        subscriptionId: stripeSubscription.id,
        status: stripeSubscription.status,
        trialEnd: stripeSubscription.trial_end,
      });

      // Create subscription in database
      // Use same ID format as webhook handler: userId + "-" + planId
      const subscriptionId = `${authUser.id}-${planId}`;
      
      // CRITICAL: Use service role client to bypass RLS during creation
      // This ensures the subscription is created even if there are timing issues with RLS policies
      // The RLS policies will still protect access after creation
      const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
      const serviceRoleClient = createServiceRoleClient();
      
      const { data: newSubscription, error: insertError } = await serviceRoleClient
        .from("app_subscriptions")
        .insert({
          id: subscriptionId,
          user_id: authUser.id,
          household_id: householdId, // Link to active household
          plan_id: planId,
          status: "trialing",
          stripe_subscription_id: stripeSubscription.id,
          stripe_customer_id: customerId,
          trial_start_date: trialStartDate.toISOString(),
          trial_end_date: trialEndDate.toISOString(),
          current_period_start: stripeSubscription.trial_start 
            ? new Date(stripeSubscription.trial_start * 1000).toISOString()
            : trialStartDate.toISOString(),
          current_period_end: stripeSubscription.trial_end 
            ? new Date(stripeSubscription.trial_end * 1000).toISOString()
            : trialEndDate.toISOString(),
          cancel_at_period_end: false,
        })
        .select()
        .single();

      if (insertError || !newSubscription) {
        logger.error("[TrialService] Error creating subscription:", insertError);
        // If database insert fails, cancel the Stripe subscription
        try {
          const stripe = getStripeClient();
          await stripe.subscriptions.cancel(stripeSubscription.id);
          logger.info("[TrialService] Stripe subscription cancelled due to database error");
        } catch (cancelError) {
          logger.error("[TrialService] Error cancelling Stripe subscription:", cancelError);
        }
        return { success: false, error: "Failed to create trial subscription" };
      }

      // Move temporary income to household settings and generate initial data if exists
      const { makeProfileService } = await import("@/src/application/profile/profile.factory");
      const profileService = makeProfileService();
      const profile = await profileService.getProfile();
      
      if (profile?.temporaryExpectedIncome) {
        const { makeOnboardingService } = await import("@/src/application/onboarding/onboarding.factory");
        const onboardingService = makeOnboardingService();
        const incomeRange = profile.temporaryExpectedIncome;
        const incomeAmount = profile.temporaryExpectedIncomeAmount;
        
        // Save income to household settings (including custom amount if provided)
        await onboardingService.saveExpectedIncome(
          userId,
          incomeRange,
          undefined,
          undefined,
          incomeAmount
        );
        
        // Clear temporary income from profile
        await profileService.updateProfile({ 
          temporaryExpectedIncome: null,
          temporaryExpectedIncomeAmount: null 
        });
        logger.info("[TrialService] Moved temporary income to household settings");
      }

      // Verify subscription is accessible after creation
      // This helps catch RLS permission issues early
      try {
        const { data: verifySubscription, error: verifyError } = await supabase
          .from("app_subscriptions")
          .select("id, status, plan_id, household_id")
          .eq("id", subscriptionId)
          .single();
        
        if (verifyError) {
          logger.warn("[TrialService] Warning: Subscription created but not immediately accessible:", {
            subscriptionId,
            error: verifyError.message,
            code: verifyError.code,
            hint: "This may indicate an RLS policy issue",
          });
        } else if (verifySubscription) {
          logger.debug("[TrialService] Subscription verified and accessible after creation:", {
            subscriptionId: verifySubscription.id,
            status: verifySubscription.status,
            plan_id: verifySubscription.plan_id,
            household_id: verifySubscription.household_id,
          });
        }
      } catch (verifyErr) {
        logger.warn("[TrialService] Error verifying subscription after creation (non-critical):", verifyErr);
      }

      // Invalidate subscription cache to ensure fresh data on next check
      try {
        const { invalidateUserCaches } = await import("@/src/infrastructure/utils/cache-utils");
        await invalidateUserCaches(authUser.id, { subscriptions: true, accounts: true });
        logger.debug("[TrialService] Cache invalidated for subscriptions and accounts", {
          userId: authUser.id,
          subscriptionId: newSubscription.id,
        });
      } catch (cacheError) {
        logger.warn("[TrialService] Error invalidating cache (non-critical):", cacheError);
      }
      
      // Small delay to ensure cache invalidation is processed and database is consistent
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send welcome email when subscription is created
      if (authUser.email) {
        try {
          const { sendWelcomeEmail } = await import("@/lib/utils/email");
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sparefinance.com/";
          
          await sendWelcomeEmail({
            to: authUser.email,
            userName: "", // Not used anymore, but keeping for interface compatibility
            founderName: "Naor Tartarotti",
            appUrl: appUrl,
          });
          
          logger.info("[TrialService] ✅ Welcome email sent successfully to:", authUser.email);
        } catch (welcomeEmailError) {
          logger.error("[TrialService] ❌ Error sending welcome email:", welcomeEmailError);
          // Don't fail subscription creation if welcome email fails
        }
      }

      logger.info("[TrialService] Trial started successfully:", {
        subscriptionId: newSubscription.id,
        stripeSubscriptionId: stripeSubscription.id,
        planId: planId,
        status: newSubscription.status,
        trialEndDate: trialEndDate.toISOString(),
      });

      return {
        success: true,
        subscription: newSubscription,
        trialEndDate: trialEndDate.toISOString(),
      };
    } catch (error) {
      logger.error("[TrialService] Error starting trial:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start trial",
      };
    }
  }
}


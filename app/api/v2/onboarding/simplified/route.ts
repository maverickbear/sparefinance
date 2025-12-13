import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { simplifiedOnboardingSchema } from "@/src/domain/onboarding/onboarding.validations";
import { getActiveHouseholdId } from "@/lib/utils/household";
import { makeTrialService } from "@/src/application/trial/trial.factory";
import { makeOnboardingService } from "@/src/application/onboarding/onboarding.factory";
import { makeProfileService } from "@/src/application/profile/profile.factory";
import { makeStripeService } from "@/src/application/stripe/stripe.factory";

/**
 * POST /api/v2/onboarding/simplified
 * Complete simplified onboarding (30-45s flow)
 * 1. Save goals and household type preferences
 * 2. Save income (optional)
 * 3. Create trial subscription automatically
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { goals, householdType, incomeRange, incomeAmount, location, planId, interval } = body;

    // Validate input
    const validated = simplifiedOnboardingSchema.parse({
      goals,
      householdType,
      incomeRange: incomeRange || null,
      incomeAmount: incomeAmount || null,
      location: location || null,
    });

    if (!planId || !interval) {
      return NextResponse.json(
        { error: "planId and interval are required" },
        { status: 400 }
      );
    }

    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    // Step 1: Save income and location if provided
    if (validated.incomeRange || validated.location) {
      try {
        const onboardingService = makeOnboardingService();
        
        if (validated.incomeRange) {
          await onboardingService.saveExpectedIncome(
            userId,
            validated.incomeRange,
            accessToken,
            refreshToken,
            validated.incomeAmount || null
          );
          
          // Save location if provided
          if (validated.location) {
            await onboardingService.saveLocation(
              userId,
              validated.location.country,
              validated.location.stateOrProvince,
              accessToken,
              refreshToken
            );
          }
        } else if (validated.location) {
          // Save location only if income not provided
          await onboardingService.saveLocation(
            userId,
            validated.location.country,
            validated.location.stateOrProvince,
            accessToken,
            refreshToken
          );
        }

        // Generate initial budgets if income provided
        if (validated.incomeRange) {
          try {
            const { makeBudgetRulesService } = await import("@/src/application/budgets/budget-rules.factory");
            const budgetRulesService = makeBudgetRulesService();
            const monthlyIncome = onboardingService.getMonthlyIncomeFromRange(
              validated.incomeRange,
              validated.incomeAmount
            );
            const suggestion = budgetRulesService.suggestRule(monthlyIncome);
            
            await onboardingService.generateInitialBudgets(
              userId,
              validated.incomeRange,
              accessToken,
              refreshToken,
              suggestion.rule.id,
              validated.incomeAmount
            );
          } catch (budgetError) {
            console.error("[SIMPLIFIED-ONBOARDING] Error generating budgets:", budgetError);
            // Don't fail onboarding if budget generation fails
          }
        }
      } catch (error) {
        console.error("[SIMPLIFIED-ONBOARDING] Error saving income/location:", error);
        // Continue anyway - income is optional
      }
    }

    // Step 2: Save goals and household type preferences, then mark onboarding as complete
    try {
      const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
      if (householdId) {
        const onboardingService = makeOnboardingService();
        const { HouseholdRepository } = await import("@/src/infrastructure/database/repositories/household.repository");
        const { OnboardingMapper } = await import("@/src/application/onboarding/onboarding.mapper");
        const householdRepository = new HouseholdRepository();
        
        // Get current settings (already mapped to domain type)
        const currentSettings = await householdRepository.getSettings(householdId, accessToken, refreshToken);
        
        if (!currentSettings) {
          throw new AppError("Household settings not found", 400);
        }
        
        // Store goals and household type in household settings using mapper
        const updatedSettings = OnboardingMapper.settingsToDatabase({
          ...currentSettings,
          onboardingGoals: goals,
          onboardingHouseholdType: householdType,
        });
        
        await householdRepository.updateSettings(householdId, updatedSettings, accessToken, refreshToken);
        console.log("[SIMPLIFIED-ONBOARDING] Saved onboarding preferences to household settings");
        
        // Mark onboarding as complete immediately after saving preferences
        await onboardingService.markOnboardingComplete(userId, householdId, accessToken, refreshToken);
        console.log("[SIMPLIFIED-ONBOARDING] Marked onboarding as complete");
      } else {
        console.error("[SIMPLIFIED-ONBOARDING] No household found - cannot save preferences");
        throw new AppError("Household not found", 400);
      }
    } catch (error) {
      console.error("[SIMPLIFIED-ONBOARDING] Error saving preferences:", error);
      // This is critical - if we can't save preferences, onboarding is incomplete
      throw error instanceof AppError ? error : new AppError(
        "Failed to save onboarding preferences",
        500
      );
    }

    // Step 3: Create trial subscription
    const trialService = makeTrialService();
    const trialResult = await trialService.startTrial(userId, planId);

    if (!trialResult.success) {
      // Check if subscription was created by another request (race condition)
      const { SubscriptionsRepository } = await import("@/src/infrastructure/database/repositories/subscriptions.repository");
      const subscriptionsRepository = new SubscriptionsRepository();
      const subscriptionId = `${userId}-${planId}`;
      const existingSubscription = await subscriptionsRepository.findById(subscriptionId);
      
      if (existingSubscription) {
        console.log("[SIMPLIFIED-ONBOARDING] Subscription already exists:", existingSubscription.id);
      } else {
        throw new AppError(
          trialResult.error || "Failed to start trial",
          500
        );
      }
    }

    // Step 4: Update Stripe customer metadata with onboarding data
    try {
      const stripeService = makeStripeService();
      const supabase = await import("@/src/infrastructure/database/supabase-server").then(m => m.createServerClient());
      const { data: userData } = await supabase
        .from("users")
        .select("email, name")
        .eq("id", userId)
        .single();

      if (userData) {
        const { data: subscription } = await supabase
          .from("app_subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", userId)
          .not("stripe_customer_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subscription?.stripe_customer_id) {
          const { getStripeClient } = await import("@/src/infrastructure/external/stripe/stripe-client");
          const stripe = getStripeClient();
          await stripe.customers.update(subscription.stripe_customer_id, {
            metadata: {
              onboardingGoals: goals.join(","),
              onboardingHouseholdType: householdType,
              onboardingCompletedAt: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error) {
      console.error("[SIMPLIFIED-ONBOARDING] Error updating Stripe customer metadata:", error);
      // Non-critical - continue
    }

    // Step 5: Invalidate subscription cache (for subscription data, not for onboarding decision)
    // Note: Onboarding decision no longer depends on subscription, but we still invalidate
    // subscription cache so subscription data is fresh for other parts of the app
    try {
      revalidateTag("subscriptions", "max");
      revalidateTag(`subscription-${userId}`, "max");
      console.log("[SIMPLIFIED-ONBOARDING] Subscription cache invalidated");
    } catch (cacheError) {
      console.warn("[SIMPLIFIED-ONBOARDING] Error invalidating subscription cache (non-critical):", cacheError);
      // Continue anyway - not critical for onboarding completion
    }

    return NextResponse.json({
      success: true,
      subscription: trialResult.subscription,
      trialEndDate: trialResult.trialEndDate,
    });
  } catch (error) {
    console.error("[SIMPLIFIED-ONBOARDING] Error:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}

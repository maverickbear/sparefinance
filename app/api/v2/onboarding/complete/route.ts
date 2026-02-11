import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { profileSchema } from "@/src/domain/profile/profile.validations";
import { expectedIncomeRangeSchema } from "@/src/domain/onboarding/onboarding.validations";
import { BudgetRuleType } from "@/src/domain/budgets/budget-rules.types";
import { locationSchema } from "@/src/domain/taxes/taxes.validations";
import { z } from "zod";

const completeOnboardingSchema = z.object({
  step1: z.object({
    name: z.string().min(1, "Name is required"),
    phoneNumber: z.string().optional().nullable(),
    dateOfBirth: z.string().optional().nullable(),
    avatarUrl: z.string().optional().nullable(),
  }),
  step2: z.object({
    incomeRange: expectedIncomeRangeSchema,
    incomeAmount: z.number().positive().nullable().optional(),
    location: locationSchema.nullable().optional(),
    ruleType: z.string().optional(),
  }),
  step3: z.object({
    planId: z.string().min(1, "Plan ID is required"),
    interval: z.enum(["month", "year"]),
  }),
});

/**
 * POST /api/v2/onboarding/complete
 * Complete onboarding by executing all operations in sequence:
 * 1. Save personal data (profile)
 * 2. Save location (country and state/province)
 * 3. Save expected income
 * 4. Create initial budgets
 * 5. Create subscription
 * 6. Invalidate caches
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = completeOnboardingSchema.parse(body);

    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    // Step 1: Save personal data (profile)
    try {
      const { makeProfileService } = await import("@/src/application/profile/profile.factory");
      const profileService = makeProfileService();
      
      const profileData = profileSchema.parse({
        name: validated.step1.name,
        phoneNumber: validated.step1.phoneNumber || null,
        dateOfBirth: validated.step1.dateOfBirth || null,
        avatarUrl: validated.step1.avatarUrl || null,
      });

      await profileService.updateProfile(profileData);
      console.log("[ONBOARDING-COMPLETE] Profile saved successfully");
    } catch (error) {
      console.error("[ONBOARDING-COMPLETE] Error saving profile:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to save profile",
        500
      );
    }

    // Step 2: Save location and expected income
    try {
      const { makeOnboardingService } = await import("@/src/application/onboarding/onboarding.factory");
      const onboardingService = makeOnboardingService();
      
      // Save location if provided
      if (validated.step2.location?.country) {
        await onboardingService.saveLocation(
          userId,
          validated.step2.location.country,
          validated.step2.location.stateOrProvince ?? null,
          accessToken,
          refreshToken
        );
        console.log("[ONBOARDING-COMPLETE] Location saved successfully");
      }
      
      // Save expected income
      await onboardingService.saveExpectedIncome(
        userId,
        validated.step2.incomeRange,
        accessToken,
        refreshToken,
        validated.step2.incomeAmount
      );
      console.log("[ONBOARDING-COMPLETE] Expected income saved successfully");
    } catch (error) {
      console.error("[ONBOARDING-COMPLETE] Error saving location/income:", error);
      throw new AppError(
        error instanceof Error ? error.message : "Failed to save location/income",
        500
      );
    }

    // Step 3: Budgets are no longer created automatically during onboarding
    // Users will create budgets manually by selecting categories in the budgets page

    // Step 4: Create subscription (or use existing if already created)
    try {
      // Check if subscription already exists using SubscriptionsService
      const { makeSubscriptionsService } = await import("@/src/application/subscriptions/subscriptions.factory");
      const subscriptionsService = makeSubscriptionsService();
      const subscriptionId = `${userId}-${validated.step3.planId}`;
      
      // Use repository to check if subscription exists (via service)
      const { SubscriptionsRepository } = await import("@/src/infrastructure/database/repositories/subscriptions.repository");
      const subscriptionsRepository = new SubscriptionsRepository();
      const existingSubscription = await subscriptionsRepository.findById(subscriptionId);

      if (existingSubscription) {
        console.log("[ONBOARDING-COMPLETE] Subscription already exists:", existingSubscription.id);
        const { revalidateTag } = await import("next/cache");
        revalidateTag("subscriptions", "max");
        revalidateTag("accounts", "max");
        revalidateTag(`dashboard-${userId}`, "max");
        revalidateTag(`reports-${userId}`, "max");
      } else {
        const { makeStripeService } = await import("@/src/application/stripe/stripe.factory");
        const stripeService = makeStripeService();
        const returnUrl = "/dashboard?trial_started=1";
        const result = await stripeService.createTrialCheckoutSessionForUser(
          userId,
          validated.step3.planId,
          validated.step3.interval,
          returnUrl,
          undefined,
          undefined
        );

        if (result.error || !result.url) {
          const checkAgain = await subscriptionsRepository.findById(subscriptionId);
          if (checkAgain) {
            const { revalidateTag } = await import("next/cache");
            revalidateTag("subscriptions", "max");
            revalidateTag("accounts", "max");
            revalidateTag(`dashboard-${userId}`, "max");
            revalidateTag(`reports-${userId}`, "max");
          } else {
            throw new AppError(
              result.error || "Failed to create checkout session",
              500
            );
          }
        } else {
          return NextResponse.json(
            { success: true, message: "Redirect to checkout.", checkoutUrl: result.url },
            { status: 200 }
          );
        }
      }
    } catch (error) {
      console.error("[ONBOARDING-COMPLETE] Error creating subscription:", error);
      
      // If error is about duplicate key, check if subscription exists now
      if (error instanceof Error && error.message.includes("duplicate key")) {
        const { SubscriptionsRepository } = await import("@/src/infrastructure/database/repositories/subscriptions.repository");
        const subscriptionsRepository = new SubscriptionsRepository();
        const subscriptionId = `${userId}-${validated.step3.planId}`;
        const existingSubscription = await subscriptionsRepository.findById(subscriptionId);
        
        if (existingSubscription) {
          console.log("[ONBOARDING-COMPLETE] Subscription exists after duplicate error, continuing:", existingSubscription.id);
          // Continue - subscription exists, that's fine
          
          // Invalidate cache so dashboard and reports reflect subscription
          const { revalidateTag } = await import("next/cache");
          revalidateTag('subscriptions', 'max');
          revalidateTag('accounts', 'max');
          revalidateTag(`dashboard-${userId}`, 'max');
          revalidateTag(`reports-${userId}`, 'max');
        } else {
          throw new AppError(
            error.message || "Failed to create subscription",
            500
          );
        }
      } else {
        throw new AppError(
          error instanceof Error ? error.message : "Failed to create subscription",
          500
        );
      }
    }

    // Step 6: Invalidate caches
    try {
      const { makeSubscriptionsService } = await import("@/src/application/subscriptions/subscriptions.factory");
      const subscriptionsService = makeSubscriptionsService();


      console.log("[ONBOARDING-COMPLETE] Caches invalidated successfully");
    } catch (error) {
      // Log but don't fail - cache invalidation is not critical
      console.warn("[ONBOARDING-COMPLETE] Error invalidating caches:", error);
    }

    return NextResponse.json(
      { success: true, message: "Onboarding completed successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ONBOARDING-COMPLETE] Error completing onboarding:", error);

    // Handle validation errors with user-friendly messages
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      let errorMessage = "Invalid request data";
      
      if (firstError) {
        const field = firstError.path.join(".");
        if (field.includes("step1.name")) {
          errorMessage = "Name is required";
        } else if (field.includes("step2.location")) {
          errorMessage = "Please select your location";
        } else if (field.includes("step2.incomeRange")) {
          errorMessage = "Please select an income range";
        } else if (field.includes("step3.planId")) {
          errorMessage = "Please select a subscription plan";
        } else if (field.includes("step3.interval")) {
          errorMessage = "Please select a billing interval";
        } else {
          errorMessage = `Invalid ${field}: ${firstError.message}`;
        }
      }
      
      return NextResponse.json(
        { error: errorMessage, details: error.errors },
        { status: 400 }
      );
    }

    // Handle application errors with user-friendly messages
    if (error instanceof AppError) {
      let userMessage = error.message;
      
      // Make error messages more user-friendly
      if (error.message.includes("profile")) {
        userMessage = "Failed to save your profile information. Please try again.";
      } else if (error.message.includes("income")) {
        userMessage = "Failed to save your income information. Please try again.";
      } else if (error.message.includes("budget")) {
        userMessage = "Failed to create your budgets. You can create them later from the dashboard.";
      } else if (error.message.includes("subscription")) {
        userMessage = "Failed to activate your subscription. Please try again or contact support.";
      }
      
      return NextResponse.json(
        { error: userMessage },
        { status: error.statusCode }
      );
    }

    // Handle unexpected errors
    return NextResponse.json(
      {
        error: "An unexpected error occurred while completing your onboarding. Please try again or contact support if the problem persists.",
      },
      { status: 500 }
    );
  }
}


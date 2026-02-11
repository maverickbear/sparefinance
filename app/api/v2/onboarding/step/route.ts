import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";
import { profileSchema } from "@/src/domain/profile/profile.validations";
import { expectedIncomeRangeSchema } from "@/src/domain/onboarding/onboarding.validations";
import { locationSchema } from "@/src/domain/taxes/taxes.validations";
import { BudgetRuleType } from "@/src/domain/budgets/budget-rules.types";
import { z } from "zod";

const stepRequestSchema = z.object({
  step: z.enum(["profile", "income", "budgets", "subscription", "finalize"]),
  data: z.object({
    step1: z.object({
      name: z.string().min(1, "Name is required"),
      phoneNumber: z.string().optional().nullable(),
      dateOfBirth: z.string().optional().nullable(),
      avatarUrl: z.string().optional().nullable(),
    }).optional(),
    step2: z.object({
      incomeRange: expectedIncomeRangeSchema,
      incomeAmount: z.number().positive().nullable().optional(),
      location: locationSchema.optional().nullable(),
      ruleType: z.string().optional(),
    }).optional(),
    step3: z.object({
      planId: z.string().min(1, "Plan ID is required"),
      interval: z.enum(["month", "year"]),
    }).optional(),
  }),
});

/**
 * POST /api/v2/onboarding/step
 * Process a single onboarding step sequentially
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = stepRequestSchema.parse(body);

    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    switch (validated.step) {
      case "profile": {
        if (!validated.data.step1) {
          throw new AppError("Step 1 data is required for profile step", 400);
        }

        const { makeProfileService } = await import("@/src/application/profile/profile.factory");
        const profileService = makeProfileService();
        
        const profileData = profileSchema.parse({
          name: validated.data.step1.name,
          phoneNumber: validated.data.step1.phoneNumber || null,
          dateOfBirth: validated.data.step1.dateOfBirth || null,
          avatarUrl: validated.data.step1.avatarUrl || null,
        });

        await profileService.updateProfile(profileData);
        console.log("[ONBOARDING-STEP] Profile saved successfully");

        return NextResponse.json({
          success: true,
          step: "profile",
          message: "Profile saved successfully",
        });
      }

      case "income": {
        if (!validated.data.step2) {
          throw new AppError("Step 2 data is required for income step", 400);
        }

        const { makeOnboardingService } = await import("@/src/application/onboarding/onboarding.factory");
        const onboardingService = makeOnboardingService();
        
        // Save location if provided
        if (validated.data.step2.location) {
          const locationData = locationSchema.safeParse(validated.data.step2.location);
          if (locationData.success) {
            await onboardingService.saveLocation(
              userId,
              locationData.data.country,
              locationData.data.stateOrProvince ?? null,
              accessToken,
              refreshToken
            );
            console.log("[ONBOARDING-STEP] Location saved successfully");
          }
        }
        
        // Save expected income
        await onboardingService.saveExpectedIncome(
          userId,
          validated.data.step2.incomeRange,
          accessToken,
          refreshToken,
          validated.data.step2.incomeAmount
        );
        console.log("[ONBOARDING-STEP] Expected income saved successfully");

        return NextResponse.json({
          success: true,
          step: "income",
          message: "Income and location saved successfully",
        });
      }

      case "budgets": {
        // Budgets are no longer created automatically during onboarding
        // Users will create budgets manually by selecting categories in the budgets page
        return NextResponse.json({
          success: true,
          step: "budgets",
          message: "Budget step completed. Users can create budgets manually in the budgets page.",
        });
      }

      case "subscription": {
        if (!validated.data.step3) {
          throw new AppError("Step 3 data is required for subscription step", 400);
        }

        const { SubscriptionsRepository } = await import("@/src/infrastructure/database/repositories/subscriptions.repository");
        const subscriptionsRepository = new SubscriptionsRepository();
        const subscriptionId = `${userId}-${validated.data.step3.planId}`;
        const existingSubscription = await subscriptionsRepository.findById(subscriptionId);

        if (existingSubscription) {
          console.log("[ONBOARDING-STEP] Subscription already exists:", existingSubscription.id);
          return NextResponse.json({
            success: true,
            step: "subscription",
            message: "Subscription already active",
          });
        }

        const returnUrl = "/dashboard?trial_started=1";
        const { makeStripeService } = await import("@/src/application/stripe/stripe.factory");
        const stripeService = makeStripeService();
        const result = await stripeService.createTrialCheckoutSessionForUser(
          userId,
          validated.data.step3.planId,
          validated.data.step3.interval,
          returnUrl,
          undefined,
          undefined
        );

        if (result.error || !result.url) {
          const checkAgain = await subscriptionsRepository.findById(subscriptionId);
          if (checkAgain) {
            return NextResponse.json({
              success: true,
              step: "subscription",
              message: "Subscription already active",
            });
          }
          throw new AppError(
            result.error || "Failed to create checkout session",
            500
          );
        }

        return NextResponse.json({
          success: true,
          step: "subscription",
          message: "Redirect to checkout to add your card and start your 30-day trial.",
          checkoutUrl: result.url,
        });
      }

      case "finalize": {
        // Invalidate caches
        const { makeSubscriptionsService } = await import("@/src/application/subscriptions/subscriptions.factory");
        const subscriptionsService = makeSubscriptionsService();


        console.log("[ONBOARDING-STEP] Caches invalidated successfully");

        return NextResponse.json({
          success: true,
          step: "finalize",
          message: "Setup finalized successfully",
        });
      }

      default:
        throw new AppError(`Unknown step: ${validated.step}`, 400);
    }
  } catch (error) {
    console.error("[ONBOARDING-STEP] Error processing step:", error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    // Handle application errors
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    // Handle unexpected errors
    return NextResponse.json(
      {
        error: "An unexpected error occurred while processing this step. Please try again.",
      },
      { status: 500 }
    );
  }
}


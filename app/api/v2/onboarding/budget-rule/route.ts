import { NextRequest, NextResponse } from "next/server";
import { makeOnboardingService } from "@/src/application/onboarding/onboarding.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { BudgetRuleType } from "@/src/domain/budgets/budget-rules.types";
import { z } from "zod";

const budgetRuleSchema = z.enum(["50_30_20", "40_30_20_10", "60_FIXED", "PAY_YOURSELF_FIRST"]);

/**
 * GET /api/v2/onboarding/budget-rule
 * Get current budget rule from household settings
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    const onboardingService = makeOnboardingService();
    const budgetRule = await onboardingService.getBudgetRule(userId, accessToken, refreshToken);

    return NextResponse.json({ budgetRule }, {
    });
  } catch (error) {
    console.error("[ONBOARDING-BUDGET-RULE] Error getting budget rule:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/onboarding/budget-rule
 * Save budget rule to household settings
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = budgetRuleSchema.parse(body.ruleType);

    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    const onboardingService = makeOnboardingService();
    await onboardingService.saveBudgetRule(userId, validated, accessToken, refreshToken);

    return NextResponse.json(
      { success: true, message: "Budget rule saved successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ONBOARDING-BUDGET-RULE] Error saving budget rule:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid budget rule type" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import { makeOnboardingService } from "@/src/application/onboarding/onboarding.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { expectedIncomeRangeSchema, expectedIncomeAmountSchema } from "@/src/domain/onboarding/onboarding.validations";
import { BudgetRuleType } from "@/src/domain/budgets/budget-rules.types";
import { z } from "zod";

/**
 * GET /api/v2/onboarding/income
 * Get expected income and check if income onboarding is complete
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeOnboardingService();
    const { incomeRange, incomeAmount } = await service.getExpectedIncomeWithAmount(userId);
    const hasExpectedIncome = incomeRange !== null;

    return NextResponse.json(
      { 
        hasExpectedIncome, 
        expectedIncome: incomeRange,
        expectedIncomeAmount: incomeAmount ?? null,
      },
      {
      }
    );
  } catch (error) {
    console.error("Error checking income onboarding status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/onboarding/income
 * Save expected income
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = expectedIncomeRangeSchema.parse(body.incomeRange);
    const incomeAmount = body.incomeAmount !== undefined 
      ? expectedIncomeAmountSchema.parse(body.incomeAmount) 
      : undefined;
    const ruleType = body.ruleType as BudgetRuleType | undefined;

    const service = makeOnboardingService();
    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    // Save expected income (with optional custom amount)
    await service.saveExpectedIncome(userId, validated, accessToken, refreshToken, incomeAmount);

    // Generate initial budgets ONLY if ruleType is explicitly provided
    // Do NOT auto-suggest - user must choose a rule during onboarding
    if (ruleType) {
    try {
      const { getActiveHouseholdId } = await import("@/lib/utils/household");
      const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
      
      if (householdId) {
          // Only generate budgets if user explicitly provided a rule type
        await service.generateInitialBudgets(
          userId,
          validated,
          accessToken,
          refreshToken,
            ruleType,
          incomeAmount
        );
      }
      // If no household, budgets will be generated when household is created
    } catch (error) {
      // Log but don't fail the request if budget generation fails
      console.error("Error generating initial budgets:", error);
    }
    }
    // If no ruleType provided, do NOT create budgets automatically

    // Recalculate emergency fund goal based on new income (only if household exists)
    try {
      const { getActiveHouseholdId } = await import("@/lib/utils/household");
      const householdId = await getActiveHouseholdId(userId, accessToken, refreshToken);
      if (householdId) {
        const { makeGoalsService } = await import("@/src/application/goals/goals.factory");
        const goalsService = makeGoalsService();
        await goalsService.calculateAndUpdateEmergencyFund(accessToken, refreshToken);
      }
      // If no household, emergency fund will be created when household is created
    } catch (error) {
      // Log but don't fail the request if emergency fund calculation fails
      console.error("Error recalculating emergency fund:", error);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error saving expected income:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid income range" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}


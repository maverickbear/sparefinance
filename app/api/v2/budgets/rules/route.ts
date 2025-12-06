import { NextRequest, NextResponse } from "next/server";
import { makeBudgetRulesService } from "@/src/application/budgets/budget-rules.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { BudgetRuleType } from "@/src/domain/budgets/budget-rules.types";
import { z } from "zod";

const applyRuleSchema = z.object({
  ruleType: z.enum(["50_30_20", "40_30_20_10", "60_FIXED", "PAY_YOURSELF_FIRST"]),
  period: z.string().optional(), // ISO date string
});

/**
 * GET /api/v2/budgets/rules
 * Get all available budget rules
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeBudgetRulesService();
    const rules = service.getAvailableRules();

    return NextResponse.json(rules, {
    });
  } catch (error) {
    console.error("Error fetching budget rules:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/budgets/rules
 * Apply a budget rule to generate/update budgets for a period
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = applyRuleSchema.parse(body);

    const ruleType = validated.ruleType as BudgetRuleType;
    const period = validated.period ? new Date(validated.period) : new Date();

    // Get access tokens for service calls
    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    // Get user's expected income to calculate budgets
    const { makeOnboardingService } = await import("@/src/application/onboarding/onboarding.factory");
    const onboardingService = makeOnboardingService();
    const { incomeRange, incomeAmount } = await onboardingService.getExpectedIncomeWithAmount(userId, accessToken, refreshToken);

    if (!incomeRange) {
      return NextResponse.json(
        { error: "Expected income not set. Please set your income range first." },
        { status: 400 }
      );
    }

    // Generate budgets using the selected rule and user's income from onboarding
    await onboardingService.generateInitialBudgets(
      userId,
      incomeRange,
      accessToken,
      refreshToken,
      ruleType,
      incomeAmount
    );

    return NextResponse.json({ 
      success: true,
      message: `Budget rule "${ruleType}" applied successfully`,
    }, { status: 200 });
  } catch (error) {
    console.error("Error applying budget rule:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}


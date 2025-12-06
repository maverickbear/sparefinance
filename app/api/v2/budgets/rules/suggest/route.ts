import { NextRequest, NextResponse } from "next/server";
import { makeBudgetRulesService } from "@/src/application/budgets/budget-rules.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";

/**
 * GET /api/v2/budgets/rules/suggest
 * Suggest a budget rule based on user's income
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const incomeRange = searchParams.get("incomeRange") || null;
    const cityCost = searchParams.get("cityCost") as "high" | "medium" | "low" | null;

    const service = makeBudgetRulesService();

    // If incomeRange is provided, convert to monthly income
    let monthlyIncome = 0;
    if (incomeRange) {
      const { makeOnboardingService } = await import("@/src/application/onboarding/onboarding.factory");
      const onboardingService = makeOnboardingService();
      monthlyIncome = onboardingService.getMonthlyIncomeFromRange(
        incomeRange as import("@/src/domain/onboarding/onboarding.types").ExpectedIncomeRange
      );
    } else {
      // Try to get from user's saved income
      const accessToken = request.cookies.get("sb-access-token")?.value;
      const refreshToken = request.cookies.get("sb-refresh-token")?.value;
      
      const { makeOnboardingService } = await import("@/src/application/onboarding/onboarding.factory");
      const onboardingService = makeOnboardingService();
      const savedIncomeRange = await onboardingService.getExpectedIncome(userId, accessToken, refreshToken);
      
      if (savedIncomeRange) {
        monthlyIncome = onboardingService.getMonthlyIncomeFromRange(savedIncomeRange);
      }
    }

    // If no income available, default to 50/30/20
    if (monthlyIncome === 0) {
      const defaultRule = service.getRuleById("50_30_20");
      return NextResponse.json({
        rule: defaultRule,
        explanation: "The 50/30/20 rule is the most popular and works well for most people.",
        confidence: "high" as const,
      });
    }

    const suggestion = service.suggestRule(monthlyIncome, cityCost || undefined);

    return NextResponse.json(suggestion, {
    });
  } catch (error) {
    console.error("Error suggesting budget rule:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}


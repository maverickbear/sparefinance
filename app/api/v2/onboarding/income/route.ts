import { NextRequest, NextResponse } from "next/server";
import { makeOnboardingService } from "@/src/application/onboarding/onboarding.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { expectedIncomeRangeSchema } from "@/src/domain/onboarding/onboarding.validations";

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
    const expectedIncome = await service.getExpectedIncome(userId);
    const hasExpectedIncome = expectedIncome !== null;

    return NextResponse.json(
      { hasExpectedIncome, expectedIncome },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
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
 * Save expected income and generate initial budgets
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = expectedIncomeRangeSchema.parse(body.incomeRange);

    const service = makeOnboardingService();

    // Save expected income
    await service.saveExpectedIncome(userId, validated);

    // Generate initial budgets if income range is provided
    if (validated) {
      try {
        await service.generateInitialBudgets(userId, validated);
      } catch (error) {
        // Log but don't fail the request if budget generation fails
        console.error("Error generating initial budgets:", error);
      }
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


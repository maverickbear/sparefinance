import { NextRequest, NextResponse } from "next/server";
import { makeOnboardingService } from "@/src/application/onboarding/onboarding.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { checkOnboardingStatus } from "@/lib/api/onboarding";
import { OnboardingStatusExtended } from "@/src/domain/onboarding/onboarding.types";

/**
 * GET /api/v2/onboarding/status
 * Return complete onboarding status including income step
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get existing onboarding status
    const existingStatus = await checkOnboardingStatus();

    // Check income onboarding status
    const service = makeOnboardingService();
    const hasExpectedIncome = await service.checkIncomeOnboardingStatus(userId);

    // Build extended status
    const extendedStatus: OnboardingStatusExtended = {
      ...existingStatus,
      hasExpectedIncome,
      totalCount: existingStatus.totalCount + 1, // Add income step
      completedCount: existingStatus.completedCount + (hasExpectedIncome ? 1 : 0),
    };

    return NextResponse.json(extendedStatus, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import { makeOnboardingDecisionService } from "@/src/application/onboarding/onboarding.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";

/**
 * GET /api/v2/onboarding/should-show
 * Returns whether onboarding dialog should be shown to the user
 * This is the server-side endpoint for client components to check onboarding status
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decisionService = makeOnboardingDecisionService();
    const shouldShow = await decisionService.shouldShowOnboardingDialog(userId);

    return NextResponse.json({ shouldShow });
  } catch (error) {
    console.error("[OnboardingShouldShow] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}


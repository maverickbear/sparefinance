import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { makeOnboardingDecisionService } from "@/src/application/onboarding/onboarding.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";

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
    // Get tokens from cookies for authenticated requests
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;
    const refreshToken = cookieStore.get("sb-refresh-token")?.value;
    const shouldShow = await decisionService.shouldShowOnboardingDialog(userId, accessToken, refreshToken);

    return NextResponse.json({ shouldShow });
  } catch (error) {
    console.error("[OnboardingShouldShow] Error:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}


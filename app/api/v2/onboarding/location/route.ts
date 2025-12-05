import { NextRequest, NextResponse } from "next/server";
import { makeOnboardingService } from "@/src/application/onboarding/onboarding.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { locationSchema } from "@/src/domain/taxes/taxes.validations";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/v2/onboarding/location
 * Get current location from household settings
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
    const location = await onboardingService.getLocation(userId, accessToken, refreshToken);

    return NextResponse.json(location, {
      headers: {
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[ONBOARDING-LOCATION] Error getting location:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}

/**
 * POST /api/v2/onboarding/location
 * Save location to household settings
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = locationSchema.parse(body);

    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    const onboardingService = makeOnboardingService();
    await onboardingService.saveLocation(
      userId,
      validated.country,
      validated.stateOrProvince ?? null,
      accessToken,
      refreshToken
    );

    return NextResponse.json(
      { success: true, message: "Location saved successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ONBOARDING-LOCATION] Error saving location:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}


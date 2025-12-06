import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { makeProfileService } from "@/src/application/profile/profile.factory";
import { AppError } from "@/src/application/shared/app-error";
import { getCacheHeaders } from "@/src/infrastructure/utils/cache-headers";

/**
 * GET /api/v2/user
 * Returns user data with plan and subscription information
 * Consolidates data from User table, subscription, and plan
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const service = makeProfileService();
    const data = await service.getUserWithSubscription(userId);

    // User data changes infrequently, use semi-static cache
    const cacheHeaders = getCacheHeaders('semi-static');

    return NextResponse.json(data, {
      status: 200,
      headers: cacheHeaders,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch user data" },
      { status: 500 }
    );
  }
}


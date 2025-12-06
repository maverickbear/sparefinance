import { NextRequest, NextResponse } from "next/server";
import { makeSubscriptionServicesService } from "@/src/application/subscription-services/subscription-services.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/subscription-services/plans
 * Get active plans for a subscription service (public endpoint)
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("serviceId");

    if (!serviceId) {
      return NextResponse.json(
        { error: "Service ID is required" },
        { status: 400 }
      );
    }

    const service = makeSubscriptionServicesService();
    const plans = await service.getPlansByServiceId(serviceId);

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Error in GET /api/subscription-services/plans:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


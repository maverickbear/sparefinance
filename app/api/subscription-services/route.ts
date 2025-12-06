import { NextResponse } from "next/server";
import { makeSubscriptionServicesService } from "@/src/application/subscription-services/subscription-services.factory";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/subscription-services
 * Get active subscription service categories and services (public endpoint)
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const service = makeSubscriptionServicesService();
    const result = await service.getCategoriesAndServices();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in GET /api/subscription-services:", error);
    
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


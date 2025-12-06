import { NextRequest, NextResponse } from "next/server";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { updatePlanSchema } from "@/src/domain/admin/admin.validations";
import { z } from "zod";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/v2/admin/plans
 * Get all subscription plans
 * Only accessible by super_admin
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeAdminService();
    
    // Check if user is super_admin
    if (!(await service.isSuperAdmin(userId))) {
      return NextResponse.json(
        { error: "Unauthorized: Only super_admin can access this endpoint" },
        { status: 403 }
      );
    }

    const plans = await service.getAllPlans();

    return NextResponse.json({ plans }, {
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v2/admin/plans
 * Update a subscription plan
 * Only accessible by super_admin
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeAdminService();
    
    // Check if user is super_admin
    if (!(await service.isSuperAdmin(userId))) {
      return NextResponse.json(
        { error: "Unauthorized: Only super_admin can access this endpoint" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = updatePlanSchema.parse(body);

    const result = await service.updatePlan(validated.id, {
      name: validated.name,
      features: validated.features,
      priceMonthly: validated.priceMonthly,
      priceYearly: validated.priceYearly,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating plan:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : "Failed to update plan";
    
    // Handle specific error cases
    if (errorMessage.includes("Invalid features format")) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


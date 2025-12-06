import { NextRequest, NextResponse } from "next/server";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { createPromoCodeSchema, updatePromoCodeSchema } from "@/src/domain/admin/admin.validations";
import { z } from "zod";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/v2/admin/promo-codes
 * Get all promo codes
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

    const promoCodes = await service.getAllPromoCodes();

    return NextResponse.json({ promoCodes }, {
    });
  } catch (error) {
    console.error("Error fetching promo codes:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch promo codes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v2/admin/promo-codes
 * Create a new promo code
 * Only accessible by super_admin
 */
export async function POST(request: NextRequest) {
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
    const validated = createPromoCodeSchema.parse(body);

    const promoCode = await service.createPromoCode({
      code: validated.code,
      discountType: validated.discountType,
      discountValue: validated.discountValue,
      duration: validated.duration,
      durationInMonths: validated.durationInMonths ?? undefined,
      maxRedemptions: validated.maxRedemptions ?? undefined,
      expiresAt: validated.expiresAt ?? undefined,
      planIds: validated.planIds,
    });

    return NextResponse.json({ promoCode }, { status: 201 });
  } catch (error) {
    console.error("Error creating promo code:", error);

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

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create promo code" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v2/admin/promo-codes
 * Update a promo code
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
    const validated = updatePromoCodeSchema.parse(body);

    const updateData: Partial<{
      code?: string;
      discountType?: "percent" | "fixed";
      discountValue?: number;
      duration?: "once" | "forever" | "repeating";
      durationInMonths?: number | null;
      maxRedemptions?: number | null;
      expiresAt?: Date | null;
      isActive?: boolean;
      planIds?: string[];
    }> = {};

    if (validated.code !== undefined) updateData.code = validated.code;
    if (validated.discountType !== undefined) updateData.discountType = validated.discountType;
    if (validated.discountValue !== undefined) updateData.discountValue = validated.discountValue;
    if (validated.duration !== undefined) updateData.duration = validated.duration;
    if (validated.durationInMonths !== undefined) updateData.durationInMonths = validated.durationInMonths;
    if (validated.maxRedemptions !== undefined) updateData.maxRedemptions = validated.maxRedemptions;
    if (validated.expiresAt !== undefined) updateData.expiresAt = validated.expiresAt;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;
    if (validated.planIds !== undefined) updateData.planIds = validated.planIds;

    const promoCode = await service.updatePromoCode(validated.id, updateData);

    return NextResponse.json({ promoCode });
  } catch (error) {
    console.error("Error updating promo code:", error);

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

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update promo code" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v2/admin/promo-codes
 * Delete a promo code
 * Only accessible by super_admin
 */
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 }
      );
    }

    await service.deletePromoCode(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting promo code:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete promo code" },
      { status: 500 }
    );
  }
}


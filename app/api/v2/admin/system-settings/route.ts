import { NextRequest, NextResponse } from "next/server";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { updateSystemSettingsSchema } from "@/src/domain/admin/admin.validations";
import { z } from "zod";
import { AppError } from "@/src/application/shared/app-error";

/**
 * GET /api/v2/admin/system-settings
 * Get current system settings (maintenance mode status)
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

    const settings = await service.getSystemSettings();

    return NextResponse.json(settings, {
    });
  } catch (error) {
    console.error("Error fetching system settings:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch system settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v2/admin/system-settings
 * Update system settings (maintenance mode)
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
    const validated = updateSystemSettingsSchema.parse(body);

    const settings = await service.updateSystemSettings(validated);

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating system settings:", error);
    
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
      { error: error instanceof Error ? error.message : "Failed to update system settings" },
      { status: 500 }
    );
  }
}


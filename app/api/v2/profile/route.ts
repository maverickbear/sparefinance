import { NextRequest, NextResponse } from "next/server";
import { makeProfileService } from "@/src/application/profile/profile.factory";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { createServiceRoleClient } from "@/src/infrastructure/database/supabase-server";
import { profileUpdateSchema } from "@/src/domain/profile/profile.validations";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { ZodError } from "zod";
import { revalidateTag } from "next/cache";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminService = makeAdminService();
    if (await adminService.isSuperAdmin(userId)) {
      const supabase = createServiceRoleClient();
      const { data: adminRow } = await supabase
        .from("admin")
        .select("name, email")
        .eq("user_id", userId)
        .maybeSingle();
      const profile = {
        name: adminRow?.name ?? "",
        email: adminRow?.email ?? "",
        avatarUrl: null as string | null,
        phoneNumber: null as string | null,
        dateOfBirth: null as string | null,
        temporaryExpectedIncome: null as string | null,
        temporaryExpectedIncomeAmount: null as number | null,
      };
      return NextResponse.json(profile, { status: 200 });
    }

    const service = makeProfileService();
    const profile = await service.getProfile();

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    console.error("Error fetching profile:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate with partial schema for PATCH requests (all fields optional)
    const validatedData = profileUpdateSchema.parse(body);
    
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const service = makeProfileService();
    const profile = await service.updateProfile(validatedData);
    
    // Invalidate cache
    revalidateTag(`user-${userId}`, 'max');
    revalidateTag('profile', 'max');
    
    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    console.error("Error updating profile:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update profile" },
      { status: 500 }
    );
  }
}


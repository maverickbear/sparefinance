import { NextRequest, NextResponse } from "next/server";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";


export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = makeAdminService();
    
    // Check if user is super_admin
    const isSuperAdmin = await service.isSuperAdmin(userId);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await service.getFeedbacks({ limit, offset });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in feedback API:", error);
    
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


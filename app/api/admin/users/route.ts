import { NextRequest, NextResponse } from "next/server";
import { makeAdminService } from "@/src/application/admin/admin.factory";
import { AppError } from "@/src/application/shared/app-error";


export async function GET(request: NextRequest) {
  try {
    const service = makeAdminService();
    const users = await service.getAllUsers();
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch users" },
      { status: error.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}


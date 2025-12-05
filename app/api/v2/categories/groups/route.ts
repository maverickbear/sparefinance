import { NextRequest, NextResponse } from "next/server";
import { makeCategoriesService } from "@/src/application/categories/categories.factory";
import { GroupFormData } from "@/src/domain/categories/categories.validations";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";
import { AppError } from "@/src/application/shared/app-error";

/**
 * POST /api/v2/categories/groups
 * Create a new group (macro)
 * 
 * NOTE: Regular users cannot create groups. Only system groups (created by admins) are available.
 * Users can only create categories and subcategories attached to existing system groups.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: "Users cannot create groups. Only system groups are available." },
    { status: 403 }
  );
}


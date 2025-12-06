import { NextRequest, NextResponse } from "next/server";
import { makeCategoriesService } from "@/src/application/categories/categories.factory";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";
import { revalidateTag } from 'next/cache';

/**
 * DELETE /api/v2/categories/groups/[id]
 * Deletes a group (macro)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can perform write operations
    const writeGuard = await guardWriteAccess(userId);
    await throwIfNotAllowed(writeGuard);

    const { id } = await params;
    
    const service = makeCategoriesService();
    await service.deleteGroup(id);
    
    // Invalidate cache
    revalidateTag('categories', 'max');
    revalidateTag('groups', 'max');
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting group:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete group" },
      { status: 400 }
    );
  }
}


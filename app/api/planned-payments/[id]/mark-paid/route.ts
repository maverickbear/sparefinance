import { NextRequest, NextResponse } from "next/server";
import { markPlannedPaymentAsPaid } from "@/lib/api/planned-payments";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";

export async function POST(
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
    
    const result = await markPlannedPaymentAsPaid(id);
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error marking planned payment as paid:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to mark planned payment as paid";
    const statusCode = errorMessage.includes("Unauthorized") || errorMessage.includes("not found") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}


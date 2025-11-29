import { NextRequest, NextResponse } from "next/server";
import { cancelPlannedPayment } from "@/lib/api/planned-payments";
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
    
    const plannedPayment = await cancelPlannedPayment(id);
    
    return NextResponse.json(plannedPayment, { status: 200 });
  } catch (error) {
    console.error("Error cancelling planned payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to cancel planned payment";
    const statusCode = errorMessage.includes("Unauthorized") || errorMessage.includes("not found") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}


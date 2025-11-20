import { NextRequest, NextResponse } from "next/server";
import { skipPlannedPayment } from "@/lib/api/planned-payments";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/lib/api/feature-guard";

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
    
    const plannedPayment = await skipPlannedPayment(id);
    
    return NextResponse.json(plannedPayment, { status: 200 });
  } catch (error) {
    console.error("Error skipping planned payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to skip planned payment";
    const statusCode = errorMessage.includes("Unauthorized") || errorMessage.includes("not found") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}


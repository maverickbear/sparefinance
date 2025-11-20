import { NextRequest, NextResponse } from "next/server";
import { createPlannedPayment } from "@/lib/api/planned-payments";
import { PlannedPaymentFormData } from "@/lib/api/planned-payments";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/lib/api/feature-guard";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can perform write operations
    const writeGuard = await guardWriteAccess(userId);
    await throwIfNotAllowed(writeGuard);

    const data: PlannedPaymentFormData = await request.json();
    
    const plannedPayment = await createPlannedPayment(data);
    
    return NextResponse.json(plannedPayment, { status: 201 });
  } catch (error) {
    console.error("Error creating planned payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create planned payment";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}


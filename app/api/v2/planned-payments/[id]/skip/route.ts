import { NextRequest, NextResponse } from "next/server";
import { makePlannedPaymentsService } from "@/src/application/planned-payments/planned-payments.factory";
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

    const writeGuard = await guardWriteAccess(userId);
    await throwIfNotAllowed(writeGuard);

    const { id } = await params;
    
    const service = makePlannedPaymentsService();
    const plannedPayment = await service.skipPlannedPayment(id);
    
    return NextResponse.json(plannedPayment, { status: 200 });
  } catch (error) {
    console.error("Error skipping planned payment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to skip planned payment" },
      { status: 400 }
    );
  }
}


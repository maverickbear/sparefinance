import { NextRequest, NextResponse } from "next/server";
import { updateGoal, deleteGoal } from "@/lib/api/goals";
import { getCurrentUserId, guardWriteAccess, throwIfNotAllowed } from "@/src/application/shared/feature-guard";

export async function PATCH(
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
    const data = await request.json();
    
    const goal = await updateGoal(id, {
      name: data.name,
      targetAmount: data.targetAmount,
      currentBalance: data.currentBalance,
      incomePercentage: data.incomePercentage,
      priority: data.priority,
      description: data.description,
      expectedIncome: data.expectedIncome,
      targetMonths: data.targetMonths,
      accountId: data.accountId,
      holdingId: data.holdingId,
    });
    
    return NextResponse.json(goal, { status: 200 });
  } catch (error) {
    console.error("Error updating goal:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to update goal";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 
                       errorMessage.includes("not found") ? 404 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

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
    
    await deleteGoal(id);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting goal:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to delete goal";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 
                       errorMessage.includes("not found") ? 404 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}


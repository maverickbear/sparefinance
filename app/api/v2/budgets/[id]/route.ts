import { NextRequest, NextResponse } from "next/server";
import { makeBudgetsService } from "@/src/application/budgets/budgets.factory";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data: { amount: number } = await request.json();
    
    const service = makeBudgetsService();
    const budget = await service.updateBudget(id, data);
    
    return NextResponse.json(budget, { status: 200 });
  } catch (error) {
    console.error("Error updating budget:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update budget" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const service = makeBudgetsService();
    await service.deleteBudget(id);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting budget:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete budget" },
      { status: 400 }
    );
  }
}


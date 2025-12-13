import { NextRequest, NextResponse } from "next/server";
import { makeBudgetsService } from "@/src/application/budgets/budgets.factory";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { requireBudgetOwnership } from "@/src/infrastructure/utils/security";
import { AppError } from "@/src/application/shared/app-error";
import { ZodError } from "zod";
import { revalidateTag } from 'next/cache';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data: { amount: number } = await request.json();
    
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Verify budget ownership
    await requireBudgetOwnership(id);
    
    const service = makeBudgetsService();
    const budget = await service.updateBudget(id, data);
    
    // Invalidate cache
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');
    
    return NextResponse.json(budget, { status: 200 });
  } catch (error) {
    console.error("Error updating budget:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update budget" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Verify budget ownership
    await requireBudgetOwnership(id);
    
    const service = makeBudgetsService();
    await service.deleteBudget(id);
    
    // Invalidate cache
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting budget:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete budget" },
      { status: 500 }
    );
  }
}


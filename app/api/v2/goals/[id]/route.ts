import { NextRequest, NextResponse } from "next/server";
import { makeGoalsService } from "@/src/application/goals/goals.factory";
import { GoalFormData } from "@/src/domain/goals/goals.validations";
import { ZodError } from "zod";
import { AppError } from "@/src/application/shared/app-error";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { requireGoalOwnership } from "@/src/infrastructure/utils/security";
import { revalidateTag } from 'next/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    
    // Verify goal ownership
    await requireGoalOwnership(id);
    
    const service = makeGoalsService();
    const goal = await service.getGoalById(id);
    
    if (!goal) {
      return NextResponse.json(
        { error: "Goal not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(goal, { status: 200 });
  } catch (error) {
    console.error("Error fetching goal:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch goal" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Verify goal ownership
    await requireGoalOwnership(id);
    
    const service = makeGoalsService();
    const goal = await service.updateGoal(id, body);
    
    // Invalidate cache
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');
    
    return NextResponse.json(goal, { status: 200 });
  } catch (error) {
    console.error("Error updating goal:", error);
    
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
    
    const errorMessage = error instanceof Error ? error.message : "Failed to update goal";
    const statusCode = errorMessage.includes("Unauthorized") ? 401 : 400;
    
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
    const { id } = await params;
    
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Verify goal ownership
    await requireGoalOwnership(id);
    
    const service = makeGoalsService();
    await service.deleteGoal(id);
    
    // Invalidate cache
    revalidateTag(`dashboard-${userId}`, 'max');
    revalidateTag(`reports-${userId}`, 'max');
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting goal:", error);
    
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete goal" },
      { status: 500 }
    );
  }
}

